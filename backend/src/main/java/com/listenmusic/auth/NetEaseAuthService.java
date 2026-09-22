package com.listenmusic.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NetEaseAuthService {
    private static final Logger LOGGER = LoggerFactory.getLogger(NetEaseAuthService.class);
    private static final String PROVIDER = "netease";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final long QR_LIFETIME_SECONDS = 300;

    private final RestClient restClient;
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;
    private final NetEaseSessionStore sessionStore;

    public NetEaseAuthService(
        RestClient.Builder restClientBuilder,
        @Value("${listenmusic.providers.netease.base-url:http://127.0.0.1:3000}") String baseUrl,
        AccountRepository accountRepository,
        CredentialStore credentialStore,
        NetEaseSessionStore sessionStore
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
        this.sessionStore = sessionStore;
    }

    @EventListener(ApplicationReadyEvent.class)
    public synchronized void restorePersistedSession() {
        Optional<NetEaseSessionStore.Session> persistedSession = sessionStore.read();
        Optional<NetEaseSessionStore.Session> candidate = persistedSession.isPresent()
            ? persistedSession
            : legacySession();
        if (candidate.isEmpty()) {
            return;
        }
        NetEaseSessionStore.Session session = candidate.orElseThrow();
        try {
            JsonNode status = loadLoginStatus(session.cookie());
            LoginIdentity identity = loginIdentity(status);
            if (!identity.valid()) {
                invalidatePersistedSession();
                return;
            }
            String credentialReference = reusableCredential(identity.userId(), session.cookie())
                .orElseGet(() -> credentialStore.put(PROVIDER, session.cookie()));
            saveAccount(identity, credentialReference);
            if (persistedSession.isEmpty() || !identity.userId().equals(session.uid())) {
                sessionStore.save(identity.userId(), session.cookie());
            }
        } catch (IllegalStateException ex) {
            LOGGER.warn("网易云登录状态启动校验暂不可用，保留本地会话等待下次重试", ex);
        }
    }

    private Optional<NetEaseSessionStore.Session> legacySession() {
        Optional<ProviderAccount> activeAccount = accountRepository.findActive(PROVIDER);
        if (activeAccount.isEmpty()) {
            return Optional.empty();
        }
        ProviderAccount account = activeAccount.orElseThrow();
        if (!isUsableUid(account.providerUserId())) {
            invalidatePersistedSession();
            return Optional.empty();
        }
        return credentialStore.get(account.credentialReference())
            .map(cookie -> new NetEaseSessionStore.Session(account.providerUserId(), cookie, ""));
    }

    public synchronized QrLoginStartResponse startQrLogin(String provider) {
        requireNetease(provider);
        accountRepository.deleteExpiredQrSessions(OffsetDateTime.now());
        accountRepository.findActive(PROVIDER).ifPresent(account -> {
            throw new AccountAlreadyActiveException(account.provider());
        });

        JsonNode keyResponse = get("/login/qr/key", uriBuilder -> uriBuilder
            .path("/login/qr/key")
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), null);
        String qrKey = firstText(keyResponse.path("data").path("unikey"), keyResponse.path("unikey"));
        if (qrKey.isBlank()) {
            throw new IllegalStateException("网易云没有返回二维码 key");
        }

        JsonNode qrResponse = get("/login/qr/create", uriBuilder -> uriBuilder
            .path("/login/qr/create")
            .queryParam("key", qrKey)
            .queryParam("qrimg", true)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), null);
        JsonNode qrData = qrResponse.path("data").isObject() ? qrResponse.path("data") : qrResponse;
        String qrimg = firstText(qrData.path("qrimg"), qrData.path("qrImg"));
        String qrurl = firstText(qrData.path("qrurl"), qrData.path("qrUrl"));
        if (qrimg.isBlank() && qrurl.isBlank()) {
            throw new IllegalStateException("网易云没有返回二维码内容");
        }

        OffsetDateTime now = OffsetDateTime.now();
        String sessionId = UUID.randomUUID().toString();
        accountRepository.saveQrSession(new QrLoginSession(
            sessionId, PROVIDER, qrKey, "WAITING", now.plusSeconds(QR_LIFETIME_SECONDS),
            null, now.toString(), now.toString()
        ));
        return new QrLoginStartResponse(sessionId, PROVIDER, "WAITING", qrimg, qrurl, QR_LIFETIME_SECONDS);
    }

    public synchronized QrLoginStatusResponse checkQrLogin(String sessionId) {
        OffsetDateTime now = OffsetDateTime.now();
        // Read the requested session before bulk cleanup so an expired QR code
        // can return a useful EXPIRED state instead of becoming a misleading 404.
        QrLoginSession session = accountRepository.findQrSession(sessionId)
            .orElseThrow(() -> new QrLoginSessionNotFoundException(sessionId));
        if (!session.expiresAt().isAfter(now)) {
            return updateStatus(session, "EXPIRED", "二维码已过期");
        }
        accountRepository.deleteExpiredQrSessions(now);
        if ("SUCCESS".equals(session.status()) || "EXPIRED".equals(session.status())) {
            return statusFromSession(session);
        }

        ResponseEntity<JsonNode> response = getEntity("/login/qr/check", uriBuilder -> uriBuilder
            .path("/login/qr/check")
            .queryParam("key", session.qrKey())
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), null);
        JsonNode root = response.getBody() == null ? OBJECT_MAPPER.createObjectNode() : response.getBody();
        int code = root.path("code").asInt(-1);
        if (code == 502) {
            root = get("/login/qr/check", uriBuilder -> uriBuilder
                .path("/login/qr/check")
                .queryParam("key", session.qrKey())
                .queryParam("noCookie", true)
                .queryParam("timestamp", System.currentTimeMillis())
                .build(), null);
            code = root.path("code").asInt(-1);
        }

        return switch (code) {
            case 800 -> updateStatus(session, "EXPIRED", message(root, "二维码已过期"));
            case 801 -> updateStatus(session, "WAITING", message(root, "等待扫码"));
            case 802 -> updateStatus(session, "CONFIRMING", message(root, "等待确认"));
            case 803 -> completeLogin(session, root, response.getHeaders());
            default -> updateStatus(session, session.status(), message(root, "正在等待扫码"));
        };
    }

    public Optional<AccountView> currentAccount() {
        return accountRepository.findActive(PROVIDER).map(this::toView);
    }

    public Optional<AccountView> account(String provider) {
        requireNetease(provider);
        return accountRepository.findActive(PROVIDER).map(this::toView);
    }

    public synchronized void logout(String provider) {
        requireNetease(provider);
        accountRepository.findActive(PROVIDER).ifPresent(account -> {
            credentialStore.delete(account.credentialReference());
            accountRepository.deactivateProvider(PROVIDER);
        });
        sessionStore.delete();
    }

    public Optional<String> activeCredential(String provider) {
        requireNetease(provider);
        return accountRepository.findActive(PROVIDER)
            .flatMap(account -> credentialStore.get(account.credentialReference()));
    }

    private QrLoginStatusResponse completeLogin(
        QrLoginSession session,
        JsonNode root,
        HttpHeaders responseHeaders
    ) {
        String cookie = firstText(
            root.path("cookie"),
            root.path("data").path("cookie"),
            root.path("data").path("cookies")
        );
        if (cookie.isBlank()) {
            cookie = cookieHeader(responseHeaders);
        }
        if (cookie.isBlank()) {
            return updateStatus(session, "CONFIRMING", "登录成功，但网易云没有返回会话凭据");
        }

        JsonNode status = loadLoginStatus(cookie);
        LoginIdentity identity = loginIdentity(status);
        if (!identity.valid()) {
            return updateStatus(session, "CONFIRMING", "登录状态无效，请重新扫码登录");
        }

        String credentialReference = credentialStore.put(PROVIDER, cookie);
        OffsetDateTime now = OffsetDateTime.now();
        saveAccount(identity, credentialReference);
        sessionStore.save(identity.userId(), cookie);
        QrLoginSession completed = new QrLoginSession(
            session.sessionId(), session.provider(), session.qrKey(), "SUCCESS", session.expiresAt(),
            credentialReference, session.createdAt(), now.toString()
        );
        accountRepository.saveQrSession(completed);
        return new QrLoginStatusResponse(
            session.sessionId(), PROVIDER, "SUCCESS", identity.userId(), identity.nickname(),
            blankToNull(identity.avatarUrl()), "登录成功"
        );
    }

    private JsonNode loadLoginStatus(String cookie) {
        return get("/login/status", uriBuilder -> uriBuilder
            .path("/login/status")
            .queryParam("cookie", cookie)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), cookie);
    }

    private LoginIdentity loginIdentity(JsonNode status) {
        if (status.path("code").asInt(200) != 200) {
            return LoginIdentity.invalid();
        }
        JsonNode data = status.path("data");
        JsonNode account = data.path("account").isObject() ? data.path("account") : status.path("account");
        JsonNode profile = data.path("profile").isObject() ? data.path("profile") : status.path("profile");
        String userId = firstText(account.path("id"), profile.path("userId"), profile.path("user_id"));
        if (!isUsableUid(userId)) {
            return LoginIdentity.invalid();
        }
        String nickname = firstText(
            profile.path("nickname"), account.path("userName"), account.path("username"), "网易云用户"
        );
        String avatarUrl = firstText(profile.path("avatarUrl"), profile.path("avatar_url"));
        return new LoginIdentity(userId, nickname, avatarUrl, true);
    }

    private Optional<String> reusableCredential(String userId, String cookie) {
        return accountRepository.findActive(PROVIDER)
            .filter(account -> userId.equals(account.providerUserId()))
            .filter(account -> credentialStore.get(account.credentialReference()).filter(cookie::equals).isPresent())
            .map(ProviderAccount::credentialReference);
    }

    private void saveAccount(LoginIdentity identity, String credentialReference) {
        OffsetDateTime now = OffsetDateTime.now();
        accountRepository.deactivateProvider(PROVIDER);
        accountRepository.saveAccount(new ProviderAccount(
            PROVIDER, identity.userId(), identity.nickname(), blankToNull(identity.avatarUrl()),
            credentialReference, true, now.toString(), now.toString()
        ));
    }

    private void invalidatePersistedSession() {
        accountRepository.findActive(PROVIDER).ifPresent(account -> credentialStore.delete(account.credentialReference()));
        accountRepository.deactivateProvider(PROVIDER);
        sessionStore.delete();
    }

    private QrLoginStatusResponse updateStatus(QrLoginSession session, String status, String message) {
        OffsetDateTime now = OffsetDateTime.now();
        QrLoginSession updated = new QrLoginSession(
            session.sessionId(), session.provider(), session.qrKey(), status, session.expiresAt(),
            session.credentialReference(), session.createdAt(), now.toString()
        );
        accountRepository.saveQrSession(updated);
        return new QrLoginStatusResponse(session.sessionId(), session.provider(), status, null, null, null, message);
    }

    private QrLoginStatusResponse statusFromSession(QrLoginSession session) {
        Optional<AccountView> account = currentAccount();
        return new QrLoginStatusResponse(
            session.sessionId(), session.provider(), session.status(),
            account.map(AccountView::userId).orElse(null),
            account.map(AccountView::nickname).orElse(null),
            account.map(AccountView::avatarUrl).orElse(null),
            "SUCCESS".equals(session.status()) ? "登录成功" : "二维码已过期"
        );
    }

    private AccountView toView(ProviderAccount account) {
        return new AccountView(account.provider(), account.providerUserId(), account.nickname(), account.avatarUrl());
    }

    private JsonNode get(
        String path,
        java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFactory,
        String cookie
    ) {
        ResponseEntity<JsonNode> response = getEntity(path, uriFactory, cookie);
        return response.getBody() == null ? OBJECT_MAPPER.createObjectNode() : response.getBody();
    }

    private ResponseEntity<JsonNode> getEntity(
        String path,
        java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFactory,
        String cookie
    ) {
        try {
            var request = restClient.get().uri(uriFactory);
            if (cookie != null && !cookie.isBlank()) {
                request.header(HttpHeaders.COOKIE, cookie);
            }
            ResponseEntity<JsonNode> response = request.retrieve().toEntity(JsonNode.class);
            if (response.getBody() == null) {
                throw new IllegalStateException("网易云 API 返回为空: " + path);
            }
            return response;
        } catch (RestClientException ex) {
            throw new IllegalStateException("网易云登录接口调用失败，请确认音乐 API 已启动: " + path, ex);
        }
    }

    private static String cookieHeader(HttpHeaders headers) {
        List<String> cookies = headers.get(HttpHeaders.SET_COOKIE);
        if (cookies == null) {
            return "";
        }
        return cookies.stream()
            .map(cookie -> cookie.split(";", 2)[0])
            .filter(cookie -> !cookie.isBlank())
            .reduce((left, right) -> left + "; " + right)
            .orElse("");
    }

    private static String firstText(JsonNode... values) {
        for (JsonNode value : values) {
            if (value != null && value.isValueNode() && !value.asText().isBlank()) {
                return value.asText().trim();
            }
        }
        return "";
    }

    private static String firstText(JsonNode first, JsonNode second, JsonNode third, String fallback) {
        String value = firstText(first, second, third);
        return value.isBlank() ? fallback : value;
    }

    private static String firstText(JsonNode first, JsonNode second, String fallback) {
        String value = firstText(first, second);
        return value.isBlank() ? fallback : value;
    }

    private static String message(JsonNode root, String fallback) {
        return firstText(root.path("message"), root.path("msg"), fallback);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static boolean isUsableUid(String userId) {
        return userId != null && !userId.isBlank() && !"unknown".equalsIgnoreCase(userId.trim());
    }

    private record LoginIdentity(String userId, String nickname, String avatarUrl, boolean valid) {
        private static LoginIdentity invalid() {
            return new LoginIdentity("", "", "", false);
        }
    }

    private static void requireNetease(String provider) {
        if (!PROVIDER.equalsIgnoreCase(provider)) {
            throw new IllegalArgumentException("暂不支持的平台: " + provider);
        }
    }
}
