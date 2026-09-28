package com.listenmusic;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApplicationDirectoriesTest {
    @Test
    void createsDataDirectoryWhenItDoesNotExist() throws Exception {
        Path dataDirectory = Files.createTempDirectory("tiaolv-music-test")
            .resolve("nested")
            .resolve(".tiaolv-music");

        ApplicationDirectories.ensureDataDirectory(dataDirectory);

        assertTrue(Files.isDirectory(dataDirectory));
    }

    @Test
    void migratesLegacyDataDirectoryWithoutLosingExistingFiles() throws Exception {
        Path home = Files.createTempDirectory("tiaolv-music-migration-test");
        Path legacyDirectory = Files.createDirectories(home.resolve(".listen-music"));
        Files.writeString(legacyDirectory.resolve("listenmusic.db"), "existing-library");

        Path dataDirectory = ApplicationDirectories.prepareDataDirectory(home);

        assertEquals(home.resolve(".tiaolv-music"), dataDirectory);
        assertEquals("existing-library", Files.readString(dataDirectory.resolve("listenmusic.db")));
        assertFalse(Files.exists(legacyDirectory));
    }
}
