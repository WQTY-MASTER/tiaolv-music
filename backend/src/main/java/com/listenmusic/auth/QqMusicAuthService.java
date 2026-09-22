package com.listenmusic.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.OffsetDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class QqMusicAuthService {
    private static final String PROVIDER = "qq";
    private static final Pattern USER_ID_PATTERN = Pattern.compile("(?:^|;\\s*)(?:uin|wxuin)=([^;]+)", Pattern.CASE_INSENSITIVE);
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

    public synchronized AccountView login(String rawCookie) {
        String cookie = normalizeCookie(rawCookie);
        String userId = extractUserId(cookie);
        JsonNode root = loadProfile(userId, cookie);
        int result = root.path("result").asInt(100);
        if (result != 100) {
            String message = firstText(root.path("message"), root.path("msg"));
            throw new IllegalArgumentException(message.isBlank() ? "QQ 音乐 Cookie 已失效或无法验证" : message);
        }

        JsonNode data = root.path("data").isObject() ? root.path("data") : root;
        JsonNode creator = data.path("creator").isObject() ? data.path("creator") : data.path("profile");
        String nickname = firstText(
            creator.path("nick"), creator.path("nickname"), data.path("nick"), data.path("nickname")
        );
        String avatarUrl = firstText(
            creator.path("headpic"), creator.path("avatarUrl"), creator.path("avatar"),
            data.path("headpic"), data.path("avatarUrl")
        );
        if (nickname.isBlank()) {
            nickname = "QQ 音乐用户 " + userId;
        }

        String credentialReference = credentialStore.put(PROVIDER, cookie);
        OffsetDateTime now = OffsetDateTime.now();
        accountRepository.findActive(PROVIDER).ifPresent(existing -> {
            credentialStore.delete(existing.credentialReference());
            accountRepository.deactivateProvider(PROVIDER);
        });
        ProviderAccount account = new ProviderAccount(
            PROVIDER, userId, nickname, avatarUrl.isBlank() ? null : avatarUrl,
            credentialReference, true, now.toString(), now.toString()
        );
        accountRepository.saveAccount(account);
        return new AccountView(PROVIDER, userId, nickname, account.avatarUrl());
    }

    private JsonNode loadProfile(String userId, String cookie) {
        try {
            JsonNode response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/user/detail")
                    .queryParam("id", userId)
                    .queryParam("ownCookie", 1)
                    .build())
                .header(HttpHeaders.COOKIE, cookie)
                .retrieve()
                .body(JsonNode.class);
            return response == null ? OBJECT_MAPPER.createObjectNode() : response;
        } catch (RestClientException ex) {
            throw new IllegalStateException("QQMusicAPI 连接失败，请确认本地服务已在 3300 端口启动", ex);
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
            throw new IllegalArgumentException("Cookie 中缺少 uin 或 wxuin");
        }
        String userId = matcher.group(1).replaceAll("\\D", "");
        if (userId.isBlank()) {
            throw new IllegalArgumentException("Cookie 中的 QQ 账号无效");
        }
        return userId;
    }

    private static String firstText(JsonNode... values) {
        for (JsonNode value : values) {
            if (value != null && value.isValueNode() && !value.asText().isBlank()) {
                return value.asText().trim();
            }
        }
        return "";
    }
}
