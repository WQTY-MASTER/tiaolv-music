package com.listenmusic.repository;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountMigrationContractTest {
    @Test
    void migrationDefinesAccountAndQrSessionTables() throws Exception {
        String migration = Files.readString(Path.of("src/main/java/db/migration/V4__provider_accounts.java"));
        assertTrue(migration.contains("provider_accounts"));
        assertTrue(migration.contains("provider_user_id"));
        assertTrue(migration.contains("credential_reference"));
        assertTrue(migration.contains("qr_login_sessions"));
        assertTrue(migration.contains("expires_at"));
    }
}
