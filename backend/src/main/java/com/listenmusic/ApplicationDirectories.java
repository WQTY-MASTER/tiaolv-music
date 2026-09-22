package com.listenmusic;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ApplicationDirectories {
    private ApplicationDirectories() {
    }

    public static Path dataDirectory() {
        return Path.of(System.getProperty("user.home"), ".listen-music");
    }

    public static void ensureDataDirectory(Path dataDirectory) {
        try {
            Files.createDirectories(dataDirectory);
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to create data directory: " + dataDirectory, ex);
        }
    }
}
