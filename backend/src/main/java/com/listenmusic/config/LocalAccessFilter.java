package com.listenmusic.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

public final class LocalAccessFilter extends OncePerRequestFilter {
    public static final String TOKEN_HEADER = "X-Tiaolv-Token";
    private static final Set<String> ORIGINS = Set.of("null", "http://127.0.0.1:5173", "http://localhost:5173");
    private static final Set<String> METHODS = Set.of("GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS");
    private final LocalAccessToken token;

    public LocalAccessFilter(LocalAccessToken token) {
        this.token = token;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String host = request.getHeader("Host");
        String origin = request.getHeader("Origin");
        int port = request.getServerPort();
        boolean localClient = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1").contains(request.getRemoteAddr());
        boolean localHost = Set.of("127.0.0.1:" + port, "localhost:" + port, "[::1]:" + port).contains(host == null ? "" : host);
        if (!localClient || !localHost || (origin != null && !ORIGINS.contains(origin))) {
            deny(response, 403);
            return;
        }
        response.setHeader("Cache-Control", "no-store");
        if ("OPTIONS".equals(request.getMethod())) {
            if (origin == null || !METHODS.contains(request.getHeader("Access-Control-Request-Method"))) {
                deny(response, 403);
                return;
            }
            response.setStatus(204);
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Vary", "Origin");
            response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tiaolv-Token");
            return;
        }
        boolean publicHealth = "GET".equals(request.getMethod()) && "/health".equals(request.getRequestURI());
        if (!publicHealth && (Collections.list(request.getHeaders(TOKEN_HEADER)).size() != 1
            || !token.matches(request.getHeader(TOKEN_HEADER)))) {
            deny(response, 401);
            return;
        }
        chain.doFilter(request, response);
    }

    private void deny(HttpServletResponse response, int status) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"message\":\"Local API access denied\"}");
    }
}
