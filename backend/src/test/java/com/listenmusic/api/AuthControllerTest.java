package com.listenmusic.api;

import com.listenmusic.auth.AccountView;
import com.listenmusic.auth.AccountAuthService;
import com.listenmusic.auth.NetEaseAuthService;
import com.listenmusic.auth.QrLoginStartResponse;
import com.listenmusic.auth.QrLoginStatusResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(com.listenmusic.config.WebConfig.class)
class AuthControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NetEaseAuthService authService;

    @MockBean
    private AccountAuthService accountAuthService;

    @Test
    void startsQrLoginWithoutReturningCredentials() throws Exception {
        given(authService.startQrLogin("netease")).willReturn(new QrLoginStartResponse(
            "session-1", "netease", "WAITING", "data:image/png;base64,abc", "https://qr.test/1", 300
        ));

        mockMvc.perform(get("/auth/netease/qr/start"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessionId").value("session-1"))
            .andExpect(jsonPath("$.status").value("WAITING"))
            .andExpect(jsonPath("$.qrimg").value("data:image/png;base64,abc"))
            .andExpect(jsonPath("$.cookie").doesNotExist());
    }

    @Test
    void exposesQrStateAndOnlyPublicAccountFieldsOnSuccess() throws Exception {
        given(authService.checkQrLogin("session-1")).willReturn(new QrLoginStatusResponse(
            "session-1", "netease", "SUCCESS", "100", "测试用户", "https://img.test/avatar.jpg", ""
        ));

        mockMvc.perform(get("/auth/netease/qr/status").param("sessionId", "session-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUCCESS"))
            .andExpect(jsonPath("$.nickname").value("测试用户"))
            .andExpect(jsonPath("$.cookie").doesNotExist());
    }

    @Test
    void returnsCurrentAccountWithoutCredentialReference() throws Exception {
        given(authService.currentAccount()).willReturn(Optional.of(new AccountView(
            "netease", "100", "测试用户", "https://img.test/avatar.jpg"
        )));

        mockMvc.perform(get("/auth/current"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.provider").value("netease"))
            .andExpect(jsonPath("$.nickname").value("测试用户"))
            .andExpect(jsonPath("$.credentialReference").doesNotExist());
    }

    @Test
    void logsOutTheRequestedProvider() throws Exception {
        mockMvc.perform(post("/auth/netease/logout").contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(accountAuthService).logout("netease");
    }

    @Test
    void returnsAllActiveProvidersWithoutCredentials() throws Exception {
        given(accountAuthService.accounts()).willReturn(List.of(
            new AccountView("netease", "100", "网易用户", null),
            new AccountView("qq", "200", "QQ用户", "https://img.test/qq.jpg")
        ));

        mockMvc.perform(get("/auth/accounts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].provider").value("netease"))
            .andExpect(jsonPath("$[1].provider").value("qq"))
            .andExpect(jsonPath("$[1].credentialReference").doesNotExist());
    }

    @Test
    void logsInQqWithCookieWithoutEchoingTheSecret() throws Exception {
        given(accountAuthService.loginQq("uin=o200; qm_keyst=secret")).willReturn(
            new AccountView("qq", "200", "QQ用户", "https://img.test/qq.jpg")
        );

        mockMvc.perform(post("/auth/qq/cookie")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cookie\":\"uin=o200; qm_keyst=secret\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.provider").value("qq"))
            .andExpect(jsonPath("$.nickname").value("QQ用户"))
            .andExpect(jsonPath("$.cookie").doesNotExist())
            .andExpect(jsonPath("$.credentialReference").doesNotExist());
    }
}
