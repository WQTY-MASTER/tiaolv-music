package com.listenmusic.auth;

import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class QqMusicAuthServiceTest {
    private MockRestServiceServer server;
    private AccountRepository accountRepository;
    private CredentialStore credentialStore;
    private QqMusicAuthService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        accountRepository = mock(AccountRepository.class);
        credentialStore = mock(CredentialStore.class);
        service = new QqMusicAuthService(builder, "http://qq-api.test", accountRepository, credentialStore);
    }

    @Test
    void validatesCookieAndStoresOnlyAnEncryptedReference() {
        String cookie = "uin=o123456; qm_keyst=secret";
        server.expect(requestTo(containsString("http://qq-api.test/user/getUserDetail?uin=123456")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"result":100,"data":{"creator":{"nick":"QQ用户","headpic":"https://img.test/qq.jpg"}}}
                """, MediaType.APPLICATION_JSON));
        when(credentialStore.put("qq", cookie)).thenReturn("credential-qq");

        AccountView account = service.login(cookie);

        assertEquals("qq", account.provider());
        assertEquals("123456", account.userId());
        assertEquals("QQ用户", account.nickname());
        verify(credentialStore).put("qq", cookie);
        verify(accountRepository).saveAccount(any(ProviderAccount.class));
        server.verify();
    }

    @Test
    void rejectsCookieWithoutAUserIdentifierBeforeCallingTheApi() {
        assertThrows(IllegalArgumentException.class, () -> service.login("qm_keyst=secret"));
    }

    @Test
    void startsQrLoginAndKeepsQrCredentialsOnTheBackend() {
        server.expect(requestTo("http://qq-api.test/getQQLoginQr"))
            .andRespond(withSuccess("""
                {"img":"data:image/png;base64,abc","ptqrtoken":123,"qrsig":"sig"}
                """, MediaType.APPLICATION_JSON));

        QrLoginStartResponse response = service.startQrLogin();

        assertEquals("qq", response.provider());
        assertEquals("WAITING", response.status());
        assertEquals("data:image/png;base64,abc", response.qrimg());
        verify(accountRepository).saveQrSession(any(QrLoginSession.class));
        server.verify();
    }

    @Test
    void completesQrLoginAndStoresTheReturnedCookie() {
        QrLoginSession session = new QrLoginSession(
            "session-qq", "qq", "c2ln.123", "WAITING",
            OffsetDateTime.now().plusMinutes(2), null,
            OffsetDateTime.now().toString(), OffsetDateTime.now().toString()
        );
        when(accountRepository.findQrSession("session-qq")).thenReturn(Optional.of(session));
        when(credentialStore.put("qq", "uin=o123456; qm_keyst=secret")).thenReturn("credential-qq");
        server.expect(requestTo("http://qq-api.test/checkQQLoginQr"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().json("{\"qrsig\":\"sig\",\"ptqrtoken\":\"123\"}"))
            .andRespond(withSuccess("""
                {"isOk":true,"message":"登录成功","session":{
                  "uin":"o123456","cookie":"uin=o123456; qm_keyst=secret"
                }}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://qq-api.test/user/getUserDetail?uin=123456"))
            .andExpect(header(HttpHeaders.COOKIE, "uin=o123456; qm_keyst=secret"))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"creator":{
                  "nick":"扫码用户","headpic":"https://img.test/qr.jpg"
                }}}}
                """, MediaType.APPLICATION_JSON));

        QrLoginStatusResponse response = service.checkQrLogin("session-qq");

        assertEquals("SUCCESS", response.status());
        assertEquals("123456", response.userId());
        assertEquals("扫码用户", response.nickname());
        verify(credentialStore).put("qq", "uin=o123456; qm_keyst=secret");
        verify(accountRepository).saveAccount(any(ProviderAccount.class));
        server.verify();
    }
}
