package com.listenmusic.auth;

import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Optional;
import java.time.OffsetDateTime;

import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class NetEaseAuthServiceTest {
    private MockRestServiceServer server;
    private AccountRepository accountRepository;
    private CredentialStore credentialStore;
    private NetEaseSessionStore sessionStore;
    private NetEaseAuthService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        accountRepository = mock(AccountRepository.class);
        credentialStore = mock(CredentialStore.class);
        sessionStore = mock(NetEaseSessionStore.class);
        service = new NetEaseAuthService(builder, "http://api.test", accountRepository, credentialStore, sessionStore);
    }

    @Test
    void startsQrLoginWithFreshCacheBustingTimestamps() {
        when(accountRepository.findActive("netease")).thenReturn(Optional.empty());
        server.expect(requestTo(startsWith("http://api.test/login/qr/key?timestamp=")))
            .andRespond(withSuccess("{\"code\":200,\"data\":{\"unikey\":\"key-1\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/login/qr/create?key=key-1&qrimg=true&timestamp=")))
            .andRespond(withSuccess("{\"code\":200,\"data\":{\"qrimg\":\"data:image/png;base64,abc\",\"qrurl\":\"https://qr.test/1\"}}", org.springframework.http.MediaType.APPLICATION_JSON));

        QrLoginStartResponse response = service.startQrLogin("netease");

        assertEquals("WAITING", response.status());
        assertEquals("data:image/png;base64,abc", response.qrimg());
        verify(accountRepository).saveQrSession(any());
        server.verify();
    }

    @Test
    void mapsWaitingAndSuccessAndStoresCookieOutsideTheResponse() {
        when(accountRepository.findQrSession("session-1")).thenReturn(Optional.of(new QrLoginSession(
            "session-1", "netease", "key-1", "WAITING",
            java.time.OffsetDateTime.now().plusMinutes(5), null,
            "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        )));
        server.expect(requestTo(startsWith("http://api.test/login/qr/check?key=key-1&timestamp=")))
            .andRespond(withSuccess("{\"code\":801,\"message\":\"等待扫码\"}", org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/login/qr/check?key=key-1&timestamp=")))
            .andRespond(withSuccess("{\"code\":803,\"cookie\":\"MUSIC_U=secret\"}", org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/login/status?cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("{\"data\":{\"account\":{\"id\":100},\"profile\":{\"nickname\":\"测试用户\",\"avatarUrl\":\"https://img.test/avatar.jpg\"}}}", org.springframework.http.MediaType.APPLICATION_JSON));
        when(credentialStore.put("netease", "MUSIC_U=secret")).thenReturn("credential-1");

        assertEquals("WAITING", service.checkQrLogin("session-1").status());

        QrLoginStatusResponse response = service.checkQrLogin("session-1");

        assertEquals("SUCCESS", response.status());
        assertEquals("100", response.userId());
        verify(credentialStore).put("netease", "MUSIC_U=secret");
        verify(sessionStore).save("100", "MUSIC_U=secret");
        verify(accountRepository).saveAccount(any());
        server.verify();
    }

    @Test
    void restoresAndValidatesPersistedCookieAndUidOnStartup() {
        when(sessionStore.read()).thenReturn(Optional.of(
            new NetEaseSessionStore.Session("100", "MUSIC_U=secret", "2026-09-21T10:00:00Z")
        ));
        when(accountRepository.findActive("netease")).thenReturn(Optional.empty());
        when(credentialStore.put("netease", "MUSIC_U=secret")).thenReturn("credential-restored");
        server.expect(requestTo(startsWith("http://api.test/login/status?cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("{\"code\":200,\"data\":{\"account\":{\"id\":100},\"profile\":{\"userId\":100,\"nickname\":\"恢复用户\"}}}", org.springframework.http.MediaType.APPLICATION_JSON));

        service.restorePersistedSession();

        verify(credentialStore).put("netease", "MUSIC_U=secret");
        verify(accountRepository).saveAccount(org.mockito.ArgumentMatchers.argThat(
            account -> "100".equals(account.providerUserId()) && "credential-restored".equals(account.credentialReference())
        ));
        server.verify();
    }

    @Test
    void rejectsLoginThatDoesNotReturnARealUid() {
        when(accountRepository.findQrSession("session-unknown")).thenReturn(Optional.of(new QrLoginSession(
            "session-unknown", "netease", "key-unknown", "WAITING",
            java.time.OffsetDateTime.now().plusMinutes(5), null,
            "2026-09-21T10:00:00Z", "2026-09-21T10:00:00Z"
        )));
        server.expect(requestTo(startsWith("http://api.test/login/qr/check?key=key-unknown&timestamp=")))
            .andRespond(withSuccess("{\"code\":803,\"cookie\":\"MUSIC_U=secret\"}", org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/login/status?cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("{\"code\":301,\"data\":{}}", org.springframework.http.MediaType.APPLICATION_JSON));

        QrLoginStatusResponse response = service.checkQrLogin("session-unknown");

        assertEquals("CONFIRMING", response.status());
        org.mockito.Mockito.verify(credentialStore, org.mockito.Mockito.never()).put(eq("netease"), any());
        org.mockito.Mockito.verify(sessionStore, org.mockito.Mockito.never()).save(any(), any());
        org.mockito.Mockito.verify(accountRepository, org.mockito.Mockito.never()).saveAccount(any());
        server.verify();
    }

    @Test
    void clearsLegacyUnknownAccountWhenNoSessionFileExists() {
        ProviderAccount unknownAccount = new ProviderAccount(
            "netease", "unknown", "旧登录", null, "credential-old", true,
            "2026-09-20T10:00:00Z", "2026-09-20T10:00:00Z"
        );
        when(sessionStore.read()).thenReturn(Optional.empty());
        when(accountRepository.findActive("netease")).thenReturn(Optional.of(unknownAccount));

        service.restorePersistedSession();

        verify(credentialStore).delete("credential-old");
        verify(accountRepository).deactivateProvider("netease");
        verify(sessionStore).delete();
    }

    @Test
    void reportsExpiredQrSessionBeforeCleanupCanRemoveIt() {
        QrLoginSession expired = new QrLoginSession(
            "expired-session", "netease", "expired-key", "WAITING",
            OffsetDateTime.now().minusSeconds(1), null,
            "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        );
        when(accountRepository.findQrSession("expired-session"))
            .thenReturn(Optional.of(expired))
            .thenReturn(Optional.empty());
        org.mockito.Mockito.doAnswer(invocation -> {
            when(accountRepository.findQrSession("expired-session")).thenReturn(Optional.empty());
            return null;
        }).when(accountRepository).deleteExpiredQrSessions(org.mockito.ArgumentMatchers.any());

        QrLoginStatusResponse response = service.checkQrLogin("expired-session");

        assertEquals("EXPIRED", response.status());
        assertEquals("二维码已过期", response.message());
        verify(accountRepository).saveQrSession(org.mockito.ArgumentMatchers.any());
    }
}
