package com.listenmusic.auth;

import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
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
        server.expect(requestTo(containsString("http://qq-api.test/user/detail?id=123456&ownCookie=1")))
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
}
