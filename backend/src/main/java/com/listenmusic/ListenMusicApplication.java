package com.listenmusic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.Map;

@SpringBootApplication
public class ListenMusicApplication {
    public static void main(String[] args) {
        ApplicationDirectories.ensureDataDirectory(ApplicationDirectories.dataDirectory());

        SpringApplication app = new SpringApplication(ListenMusicApplication.class);
        app.setHeadless(false);
        app.setDefaultProperties(Map.of(
            "spring.datasource.url", "jdbc:sqlite:${user.home}/.listen-music/listenmusic.db",
            "spring.datasource.driver-class-name", "org.sqlite.JDBC",
            "spring.flyway.enabled", "true",
            "logging.level.com.listenmusic", "INFO"
        ));
        app.run(args);
    }
}
