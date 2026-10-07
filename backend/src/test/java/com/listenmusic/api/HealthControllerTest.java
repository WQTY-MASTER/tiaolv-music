package com.listenmusic.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class HealthControllerTest {
    @SuppressWarnings("unchecked")
    @Test
    void reportsApplicationAndRuntimeVersionsWhenDatabaseIsUnavailable() {
        ObjectProvider<DataSource> dataSources = mock(ObjectProvider.class);
        HealthController controller = new HealthController(dataSources);

        var health = controller.health();

        assertThat(health).containsEntry("ok", true);
        assertThat(health).containsKeys("backendVersion", "springBootVersion", "javaVersion", "database");
        @SuppressWarnings("unchecked")
        var database = (java.util.Map<String, String>) health.get("database");
        assertThat(database)
            .containsEntry("product", "Unavailable")
            .containsEntry("version", "Unavailable");
    }
}
