package com.listenmusic.config;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;

class LocalAccessConfigurationTest {
    @TempDir Path directory;

    @Test void providerTransportHasBoundedConnectionAndReadWaits() {
        var builder = RestClient.builder();
        var token = LocalAccessToken.open(directory.resolve("token"));
        new LocalAccessConfiguration().localApiAuthorization(token).customize(builder);
        var factory = assertInstanceOf(JdkClientHttpRequestFactory.class,
            ReflectionTestUtils.getField(builder, "requestFactory"));
        var client = assertInstanceOf(HttpClient.class, ReflectionTestUtils.getField(factory, "httpClient"));
        var connectTimeout = client.connectTimeout().orElseThrow(() -> new AssertionError("Connection wait is unbounded"));
        var readTimeout = assertInstanceOf(Duration.class, ReflectionTestUtils.getField(factory, "readTimeout"));
        assertTrue(connectTimeout.isPositive() && connectTimeout.compareTo(Duration.ofSeconds(5)) <= 0);
        assertTrue(readTimeout.isPositive() && readTimeout.compareTo(Duration.ofSeconds(30)) <= 0);
        assertEquals(HttpClient.Redirect.NEVER, client.followRedirects());
    }
}
