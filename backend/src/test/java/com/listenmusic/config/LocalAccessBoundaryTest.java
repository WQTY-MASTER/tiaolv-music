package com.listenmusic.config;

import com.listenmusic.api.HealthController;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@Import({LocalAccessConfiguration.class, WebConfig.class, LocalAccessBoundaryTest.Routes.class})
class LocalAccessBoundaryTest {
    private static final Path TOKEN_FILE = Path.of(System.getProperty("java.io.tmpdir"), "tiaolv-access-" + java.util.UUID.randomUUID() + ".token");
    @Autowired MockMvc mvc;
    @Autowired LocalAccessToken token;

    @DynamicPropertySource static void configuration(DynamicPropertyRegistry registry) {
        registry.add("listenmusic.local-access.token-file", () -> TOKEN_FILE.toString());
    }

    @AfterAll static void cleanup() throws Exception { Files.deleteIfExists(TOKEN_FILE); }

    private MockHttpServletRequestBuilder local(String path) {
        return get(path).header("Host", "127.0.0.1:17890").with(request -> {
            request.setServerPort(17890);
            request.setRemoteAddr("127.0.0.1");
            return request;
        });
    }

    @Test void filterIsInstalledAndFileOriginIsNotAuthentication() throws Exception {
        mvc.perform(local("/health")).andExpect(status().isOk());
        mvc.perform(local("/private").header("Origin", "null")).andExpect(status().isUnauthorized());
        mvc.perform(local("/private").header("Origin", "null").header(LocalAccessFilter.TOKEN_HEADER, token.value()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true))
            .andExpect(header().string("Access-Control-Allow-Origin", "null"));
        mvc.perform(local("/private").header("Origin", "https://attacker.example").header(LocalAccessFilter.TOKEN_HEADER, token.value()))
            .andExpect(status().isForbidden());
    }

    @RestController static class Routes {
        @GetMapping("/private") Map<String, Boolean> privateData() { return Map.of("ok", true); }
    }
}
