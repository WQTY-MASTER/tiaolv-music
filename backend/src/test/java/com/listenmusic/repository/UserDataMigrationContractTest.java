package com.listenmusic.repository;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UserDataMigrationContractTest {
    @Test
    void migrationSeparatesEveryUsersData() throws Exception {
        String migration = Files.readString(Path.of("src/main/java/db/migration/V3__user_data.java"));
        assertTrue(migration.contains("profile_id"));
        assertTrue(migration.contains("user_tracks"));
        assertTrue(migration.contains("favorites"));
        assertTrue(migration.contains("recent_tracks"));
        assertTrue(migration.contains("playback_queue"));
        assertTrue(migration.contains("playback_state"));
    }
}
