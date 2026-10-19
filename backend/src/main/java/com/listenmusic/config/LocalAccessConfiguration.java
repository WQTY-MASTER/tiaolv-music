package com.listenmusic.config;

import java.nio.file.Path;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.client.JdkClientHttpRequestFactory;

@Configuration
public class LocalAccessConfiguration {
    @Bean
    LocalAccessToken localAccessToken(@Value("${listenmusic.local-access.token-file:${user.home}/.tiaolv-music/local-access.token}") String path) {
        return LocalAccessToken.open(Path.of(path));
    }

    @Bean
    FilterRegistrationBean<LocalAccessFilter> localAccessFilter(LocalAccessToken token) {
        var registration = new FilterRegistrationBean<>(new LocalAccessFilter(token));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Bean
    RestClientCustomizer localApiAuthorization(LocalAccessToken token) {
        // A transport redirect must not forward the installation token to a music CDN.
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(30));
        return builder -> builder.requestFactory(factory).requestInterceptor((request, body, execution) -> {
            var uri = request.getURI();
            request.getHeaders().remove(LocalAccessFilter.TOKEN_HEADER);
            if ("http".equals(uri.getScheme()) && Set.of("127.0.0.1", "localhost", "[::1]").contains(uri.getHost())
                && (uri.getPort() == 3000 || uri.getPort() == 3300)) {
                request.getHeaders().set(LocalAccessFilter.TOKEN_HEADER, token.value());
            }
            return execution.execute(request, body);
        });
    }
}
