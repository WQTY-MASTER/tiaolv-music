package com.listenmusic.config;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.web.client.RestClientAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;

class LocalApiRedirectTest {
    @TempDir Path directory;

    @Test void outboundClientNeverAutomaticallyFollowsRedirects() throws Exception {
        var api = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var target = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var targetRequests = new AtomicInteger();
        var receivedPrivateHeader = new AtomicReference<String>();
        String privateHeader = "X-Test-Private";
        String location = "http://127.0.0.1:" + target.getAddress().getPort() + "/audio";
        api.createContext("/redirect", exchange -> {
            receivedPrivateHeader.set(exchange.getRequestHeaders().getFirst(privateHeader));
            exchange.getResponseHeaders().set("Location", location);
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        target.createContext("/audio", exchange -> {
            targetRequests.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        api.start();
        target.start();
        try {
            new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(RestClientAutoConfiguration.class))
                .withUserConfiguration(LocalAccessConfiguration.class)
                .withPropertyValues("listenmusic.local-access.token-file=" + directory.resolve("token"))
                .run(context -> {
                    var client = context.getBean(RestClient.Builder.class).build();
                    var response = client.get().uri("http://127.0.0.1:" + api.getAddress().getPort() + "/redirect")
                        .header(privateHeader, "synthetic-private-value")
                        .retrieve().toBodilessEntity();
                    assertEquals(302, response.getStatusCode().value());
                    assertEquals(location, response.getHeaders().getFirst("Location"));
                    assertEquals("synthetic-private-value", receivedPrivateHeader.get());
                    assertEquals(0, targetRequests.get(), "A redirect must not forward the private header");
                });
        } finally {
            api.stop(0);
            target.stop(0);
        }
    }
}
