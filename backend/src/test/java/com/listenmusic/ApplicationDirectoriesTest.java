package com.listenmusic;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ApplicationDirectoriesTest {
    @Test
    void createsDataDirectoryWhenItDoesNotExist() throws Exception {
        Path dataDirectory = Files.createTempDirectory("listen-music-test")
            .resolve("nested")
            .resolve(".listen-music");

        ApplicationDirectories.ensureDataDirectory(dataDirectory);

        assertTrue(Files.isDirectory(dataDirectory));
    }
}
