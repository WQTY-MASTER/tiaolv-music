package com.listenmusic.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            // File-based Electron pages still require LocalAccessFilter's private token.
            .allowedOrigins("http://127.0.0.1:5173", "http://localhost:5173", "null")
            .allowedMethods("GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("Content-Type", "X-Tiaolv-Token");
    }
}
