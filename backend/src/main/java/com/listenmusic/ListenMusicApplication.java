package com.listenmusic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.nio.file.Files;
import java.util.Map;

@SpringBootApplication
public class ListenMusicApplication {
    public static void main(String[] args) {
        var dataDirectory = ApplicationDirectories.prepareDataDirectory();
        var databasePath = Files.exists(dataDirectory.resolve("listenmusic.db"))
            ? dataDirectory.resolve("listenmusic.db")
            : dataDirectory.resolve("tiaolv-music.db");

        SpringApplication app = new SpringApplication(ListenMusicApplication.class);
        app.setHeadless(false);
        app.setDefaultProperties(Map.of(
            "spring.application.name", "tiaolv-music-backend",
            "spring.datasource.url", "jdbc:sqlite:" + databasePath,
            "spring.datasource.driver-class-name", "org.sqlite.JDBC",
            "spring.flyway.enabled", "true",
            "logging.level.com.listenmusic", "INFO"
        ));
        app.run(args);
    }
}
