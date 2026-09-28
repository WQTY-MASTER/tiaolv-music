package com.listenmusic.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class QqMusicAuthService {
    private static final String PROVIDER = "qq";
    private static final long QR_LIFETIME_SECONDS = 180;
    private static final Pattern USER_ID_PATTERN = Pattern.compile(
        "(?:^|;\\s*)(?:uin|wxuin)=([^;]+)", Pattern.CASE_INSENSITIVE
    );
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;

    public QqMusicAuthService(
        RestClient.Builder restClientBuilder,
        @Value("${listenmusic.providers.qq.base-url:http://127.0.0.1:3300}") String baseUrl,
        AccountRepository accountRepository,
        CredentialStore credentialStore
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
    }

    public synchronized QrLoginStartResponse startQrLogin() {
        OffsetDateTime now = OffsetDateTime.now();
        accountRepository.deleteExpiredQrSessions(now);
        accountRepository.findActive(PROVIDER).ifPresent(account -> {
            throw new AccountAlreadyActiveException(PROVIDER);
        });

        JsonNode root = get("/getQQLoginQr");
        JsonNode data = root.path("data").isObject() ? root.path("data") : root;
        String qrImage = firstText(data.path("img"), data.path("qrimg"), data.path("qrImg"));
        String qrSig = firstText(data.path("qrsig"), data.path("qrSig"));
        String qrToken = firstText(data.path("ptqrtoken"), data.path("ptqrToken"));
        if (qrImage.isBlank() || qrSig.isBlank() || qrToken.isBlank()) {
            throw new IllegalStateException("QQ 音乐没有返回完整的登录二维码");
        }

        String sessionId = UUID.randomUUID().toString();
        accountRepository.saveQrSession(new QrLoginSession(
            sessionId, PROVIDER, encodeQrKey(qrSig, qrToken), "WAITING",
            now.plusSeconds(QR_LIFETIME_SECONDS), null, now.toString(), now.toString()
        ));
        return new QrLoginStartResponse(
            sessionId, PROVIDER, "WAITING", qrImage, null, QR_LIFETIME_SECONDS
        );
    }

    public synchronized QrLoginStatusResponse checkQrLogin(String sessionId) {
        OffsetDateTime now = OffsetDateTime.now();
        QrLoginSession session = accountRepository.findQrSession(sessionId)
            .filter(candidate -> PROVIDER.equals(candidate.provider()))
            .orElseThrow(() -> new QrLoginSessionNotFoundException(sessionId));
        if (!session.expiresAt().isAfter(now)) {
            return updateStatus(session, "EXPIRED", "二维码已过期");
        }
        if ("SUCCESS".equals(session.status()) || "EXPIRED".equals(session.status())) {
            return statusFromSession(session);
        }

        QrCredentials credentials = decodeQrKey(session.qrKey());
        JsonNode root = post("/checkQQLoginQr", Map.of(
            "qrsig", credentials.qrSig(),
            "ptqrtoken", credentials.qrToken()
        ));
        if (root.path("isOk").asBoolean(false)) {
            return completeLogin(session, root.path("session"));
        }
        if (root.path("refresh").asBoolean(false)) {
            return updateStatus(session, "EXPIRED", message(root, "二维码已过期"));
        }
        return updateStatus(session, "WAITING", message(root, "等待扫码"));
    }

    public synchronized AccountView login(String rawCookie) {
        String cookie = normalizeCookie(rawCookie);
        String userId = extractUserId(cookie);
        return saveLogin(userId, cookie, loadProfile(userId, cookie));
    }

    private QrLoginStatusResponse completeLogin(QrLoginSession session, JsonNode loginSession) {
        String cookie = firstText(loginSession.path("cookie"));
        if (cookie.isBlank()) {
            return updateStatus(session, "CONFIRMING", "扫码成功，但 QQ 音乐没有返回登录凭据");
        }

        String userId = normalizeUserId(firstText(
            loginSession.path("uin"), loginSession.path("loginUin")
        ));
        if (userId.isBlank()) {
            userId = extractUserId(cookie);
        }
        AccountView account = saveLogin(userId, cookie, loadProfile(userId, cookie));
        OffsetDateTime now = OffsetDateTime.now();
        accountRepository.saveQrSession(new QrLoginSession(
            session.sessionId(), PROVIDER, session.qrKey(), "SUCCESS", session.expiresAt(),
            accountRepository.findActive(PROVIDER).map(ProviderAccount::credentialReference).orElse(null),
            session.createdAt(), now.toString()
        ));
        return new QrLoginStatusResponse(
            session.sessionId(), PROVIDER, "SUCCESS", account.userId(), account.nickname(),
            account.avatarUrl(), "登录成功"
        );
    }

    private AccountView saveLogin(String userId, String cookie, JsonNode profileRoot) {
        JsonNode response = profileRoot.path("response").isObject()
            ? profileRoot.path("response")
            : profileRoot;
        JsonNode data = response.path("data").isObject() ? response.path("data") : response;
        JsonNode creator = data.path("creator").isObject() ? data.path("creator") : data.path("profile");
        String nickname = firstText(
            creator.path("nick"), creator.path("nickname"), data.path("nick"), data.path("nickname"),
            profileRoot.path("nick"), profileRoot.path("nickname")
        );
        String avatarUrl = firstText(
            creator.path("headpic"), creator.path("avatarUrl"), creator.path("avatar"),
            data.path("headpic"), data.path("avatarUrl"), profileRoot.path("headpic")
        );
        if (nickname.isBlank()) {
            nickname = "QQ 音乐用户 " + userId;
        }
        if (avatarUrl.isBlank()) {
            avatarUrl = "https://q.qlogo.cn/headimg_dl?dst_uin=" + userId + "&spec=140";
        }

        String credentialReference = credentialStore.put(PROVIDER, cookie);
        OffsetDateTime now = OffsetDateTime.now();
        accountRepository.findActive(PROVIDER).ifPresent(existing -> {
            credentialStore.delete(existing.credentialReference());
            accountRepository.deactivateProvider(PROVIDER);
        });
        ProviderAccount account = new ProviderAccount(
            PROVIDER, userId, nickname, avatarUrl, credentialReference,
            true, now.toString(), now.toString()
        );
        accountRepository.saveAccount(account);
        return new AccountView(PROVIDER, userId, nickname, avatarUrl);
    }

    private JsonNode loadProfile(String userId, String cookie) {
        try {
            JsonNode response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/user/getUserDetail")
                    .queryParam("uin", userId)
                    .build())
                .header(HttpHeaders.COOKIE, cookie)
                .retrieve()
                .body(JsonNode.class);
            return response == null ? OBJECT_MAPPER.createObjectNode() : response;
        } catch (RestClientException ex) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    private JsonNode get(String path) {
        try {
            JsonNode response = restClient.get().uri(path).retrieve().body(JsonNode.class);
            return requireResponse(response, path);
        } catch (RestClientException ex) {
            throw unavailable(path, ex);
        }
    }

    private JsonNode post(String path, Map<String, String> body) {
        try {
            JsonNode response = restClient.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
            return requireResponse(response, path);
        } catch (RestClientException ex) {
            throw unavailable(path, ex);
        }
    }

    private static JsonNode requireResponse(JsonNode response, String path) {
        if (response == null) {
            throw new IllegalStateException("QQMusicAPI 返回为空: " + path);
        }
        return response;
    }

    private static IllegalStateException unavailable(String path, RestClientException cause) {
        return new IllegalStateException(
            "QQMusicAPI 登录接口调用失败，请确认本地服务已在 3300 端口启动: " + path,
            cause
        );
    }

    private QrLoginStatusResponse updateStatus(QrLoginSession session, String status, String message) {
        OffsetDateTime now = OffsetDateTime.now();
        QrLoginSession updated = new QrLoginSession(
            session.sessionId(), PROVIDER, session.qrKey(), status, session.expiresAt(),
            session.credentialReference(), session.createdAt(), now.toString()
        );
        accountRepository.saveQrSession(updated);
        return new QrLoginStatusResponse(session.sessionId(), PROVIDER, status, null, null, null, message);
    }

    private QrLoginStatusResponse statusFromSession(QrLoginSession session) {
        Optional<AccountView> account = accountRepository.findActive(PROVIDER).map(this::toView);
        return new QrLoginStatusResponse(
            session.sessionId(), PROVIDER, session.status(),
            account.map(AccountView::userId).orElse(null),
            account.map(AccountView::nickname).orElse(null),
            account.map(AccountView::avatarUrl).orElse(null),
            "SUCCESS".equals(session.status()) ? "登录成功" : "二维码已过期"
        );
    }

    private AccountView toView(ProviderAccount account) {
        return new AccountView(account.provider(), account.providerUserId(), account.nickname(), account.avatarUrl());
    }

    private static String encodeQrKey(String qrSig, String qrToken) {
        String encodedSig = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(qrSig.getBytes(StandardCharsets.UTF_8));
        return encodedSig + "." + qrToken;
    }

    private static QrCredentials decodeQrKey(String qrKey) {
        int separator = qrKey == null ? -1 : qrKey.lastIndexOf('.');
        if (separator <= 0 || separator == qrKey.length() - 1) {
            throw new IllegalStateException("QQ 登录二维码会话已损坏，请重新获取二维码");
        }
        try {
            String qrSig = new String(
                Base64.getUrlDecoder().decode(qrKey.substring(0, separator)), StandardCharsets.UTF_8
            );
            return new QrCredentials(qrSig, qrKey.substring(separator + 1));
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("QQ 登录二维码会话已损坏，请重新获取二维码", ex);
        }
    }

    private static String normalizeCookie(String rawCookie) {
        if (rawCookie == null || rawCookie.isBlank()) {
            throw new IllegalArgumentException("请输入 QQ 音乐 Cookie");
        }
        return rawCookie.trim().replaceAll("[\\r\\n]+", "");
    }

    private static String extractUserId(String cookie) {
        Matcher matcher = USER_ID_PATTERN.matcher(cookie);
        if (!matcher.find()) {
            throw new IllegalArgumentException("QQ 音乐登录凭据中缺少 uin");
        }
        String userId = normalizeUserId(matcher.group(1));
        if (userId.isBlank()) {
            throw new IllegalArgumentException("QQ 音乐登录凭据中的账号无效");
        }
        return userId;
    }

    private static String normalizeUserId(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private static String message(JsonNode root, String fallback) {
        String value = firstText(root.path("message"), root.path("msg"), root.path("error"));
        return value.isBlank() ? fallback : value;
    }

    private static String firstText(JsonNode... values) {
        for (JsonNode value : values) {
            if (value != null && value.isValueNode() && !value.asText().isBlank()) {
                return value.asText().trim();
            }
        }
        return "";
    }

    private record QrCredentials(String qrSig, String qrToken) {
    }
}
