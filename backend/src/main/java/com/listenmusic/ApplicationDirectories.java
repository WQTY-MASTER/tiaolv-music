package com.listenmusic;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ApplicationDirectories {
    private ApplicationDirectories() {
    }

    public static Path dataDirectory() {
        return Path.of(System.getProperty("user.home"), ".tiaolv-music");
    }

    static Path prepareDataDirectory(Path homeDirectory) {
        Path dataDirectory = homeDirectory.resolve(".tiaolv-music");
        Path legacyDirectory = homeDirectory.resolve(".listen-music");
        try {
            if (Files.notExists(dataDirectory) && Files.isDirectory(legacyDirectory)) {
                Files.move(legacyDirectory, dataDirectory);
            }
            ensureDataDirectory(dataDirectory);
            return dataDirectory;
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to migrate data directory: " + legacyDirectory, ex);
        }
    }

    public static Path prepareDataDirectory() {
        return prepareDataDirectory(Path.of(System.getProperty("user.home")));
    }

    public static void ensureDataDirectory(Path dataDirectory) {
        try {
            Files.createDirectories(dataDirectory);
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to create data directory: " + dataDirectory, ex);
        }
    }
}
