package com.listenmusic.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import static org.junit.jupiter.api.Assertions.*;

class LocalAccessFilterTest {
    @TempDir Path directory;

    private MockHttpServletRequest request(String method, String path) {
        var request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr("127.0.0.1");
        request.setServerPort(17890);
        request.addHeader("Host", "127.0.0.1:17890");
        return request;
    }

    private boolean allowed(MockHttpServletRequest request, LocalAccessToken token, int expectedStatus) throws Exception {
        var response = new MockHttpServletResponse();
        var passed = new AtomicBoolean();
        new LocalAccessFilter(token).doFilter(request, response, (req, res) -> passed.set(true));
        assertEquals(expectedStatus, response.getStatus());
        assertFalse(response.getContentAsString().contains(token.value()));
        return passed.get();
    }

    @Test void installationTokenIsPrivateStableAndRejectsCorruption() throws Exception {
        Path file = directory.resolve("local-access.token");
        var token = LocalAccessToken.open(file);
        assertTrue(token.value().matches("[a-f0-9]{64}"));
        assertEquals(token.value(), LocalAccessToken.open(file).value());
        assertTrue(token.matches(token.value()));
        assertFalse(token.matches(null));
        assertFalse(token.matches("wrong"));
        assertFalse(token.matches(token.value() + "extra"));
        Files.writeString(file, "corrupt");
        assertThrows(IllegalStateException.class, () -> LocalAccessToken.open(file));
    }

    @Test void healthIsPublicButDataAndWritesRequireToken() throws Exception {
        var token = LocalAccessToken.open(directory.resolve("token"));
        assertTrue(allowed(request("GET", "/health"), token, 200));
        assertFalse(allowed(request("GET", "/library/tracks"), token, 401));
        assertFalse(allowed(request("POST", "/playback/play"), token, 401));
        assertFalse(allowed(request("POST", "/health"), token, 401));
        var authenticated = request("POST", "/playback/play");
        authenticated.addHeader(LocalAccessFilter.TOKEN_HEADER, token.value());
        assertTrue(allowed(authenticated, token, 200));
    }

    @Test void mediaRangeAndFileOriginNeedTheSameHeaderNotAQueryToken() throws Exception {
        var token = LocalAccessToken.open(directory.resolve("token"));
        var media = request("GET", "/library/tracks/123/audio");
        media.addHeader("Origin", "null");
        media.addHeader("Range", "bytes=0-100");
        media.addHeader(LocalAccessFilter.TOKEN_HEADER, token.value());
        assertTrue(allowed(media, token, 200));
        var query = request("GET", "/library/tracks/123/audio");
        query.setParameter("token", token.value());
        assertFalse(allowed(query, token, 401));
    }

    @Test void rejectsForeignClientsHostsAndOriginsEvenWithAValidToken() throws Exception {
        var token = LocalAccessToken.open(directory.resolve("token"));
        var remote = request("GET", "/health");
        remote.setRemoteAddr("192.168.1.20");
        remote.addHeader(LocalAccessFilter.TOKEN_HEADER, token.value());
        assertFalse(allowed(remote, token, 403));
        var rebound = request("GET", "/library/tracks");
        rebound.removeHeader("Host");
        rebound.addHeader("Host", "attacker.example:17890");
        rebound.addHeader(LocalAccessFilter.TOKEN_HEADER, token.value());
        assertFalse(allowed(rebound, token, 403));
        var hostileOrigin = request("GET", "/library/tracks");
        hostileOrigin.addHeader("Origin", "https://attacker.example");
        hostileOrigin.addHeader(LocalAccessFilter.TOKEN_HEADER, token.value());
        assertFalse(allowed(hostileOrigin, token, 403));
    }

    @Test void allowsOnlyTrustedPreflightAndNeverAuthorizesItsFollowingRequest() throws Exception {
        var token = LocalAccessToken.open(directory.resolve("token"));
        var preflight = request("OPTIONS", "/library/tracks");
        preflight.addHeader("Origin", "http://127.0.0.1:5173");
        preflight.addHeader("Access-Control-Request-Method", "GET");
        assertFalse(allowed(preflight, token, 204));
        var unauthenticated = request("GET", "/library/tracks");
        unauthenticated.addHeader("Origin", "http://127.0.0.1:5173");
        assertFalse(allowed(unauthenticated, token, 401));
        preflight.removeHeader("Origin");
        preflight.addHeader("Origin", "https://attacker.example");
        assertFalse(allowed(preflight, token, 403));
    }

    @Test void providerTokenIsOnlySentToTheTwoLocalApis() {
        var token = LocalAccessToken.open(directory.resolve("token"));
        var builder = RestClient.builder();
        new LocalAccessConfiguration().localApiAuthorization(token).customize(builder);
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://127.0.0.1:3000/search"))
            .andExpect(header(LocalAccessFilter.TOKEN_HEADER, token.value())).andRespond(withSuccess());
        server.expect(requestTo("http://127.0.0.1:3300/search"))
            .andExpect(header(LocalAccessFilter.TOKEN_HEADER, token.value())).andRespond(withSuccess());
        server.expect(requestTo("https://music.qq.com/search"))
            .andExpect(headerDoesNotExist(LocalAccessFilter.TOKEN_HEADER)).andRespond(withSuccess());
        var client = builder.build();
        client.get().uri("http://127.0.0.1:3000/search").retrieve().toBodilessEntity();
        client.get().uri("http://127.0.0.1:3300/search").retrieve().toBodilessEntity();
        client.get().uri("https://music.qq.com/search").header(LocalAccessFilter.TOKEN_HEADER, token.value()).retrieve().toBodilessEntity();
        server.verify();
    }
}
