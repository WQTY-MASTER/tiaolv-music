package com.listenmusic.api;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringBootVersion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
public class HealthController {
    private final ObjectProvider<DataSource> dataSources;

    public HealthController(ObjectProvider<DataSource> dataSources) {
        this.dataSources = dataSources;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("backendVersion", Optional.ofNullable(
            HealthController.class.getPackage().getImplementationVersion()
        ).orElse("0.1.0"));
        result.put("springBootVersion", SpringBootVersion.getVersion());
        result.put("javaVersion", System.getProperty("java.version", "Unknown"));
        result.put("database", databaseInfo());
        return result;
    }

    private Map<String, String> databaseInfo() {
        DataSource dataSource = dataSources.getIfAvailable();
        if (dataSource == null) {
            return unavailableDatabase();
        }
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metadata = connection.getMetaData();
            return Map.of(
                "product", metadata.getDatabaseProductName(),
                "version", metadata.getDatabaseProductVersion()
            );
        } catch (Exception ignored) {
            return unavailableDatabase();
        }
    }

    private Map<String, String> unavailableDatabase() {
        return Map.of("product", "Unavailable", "version", "Unavailable");
    }
}
