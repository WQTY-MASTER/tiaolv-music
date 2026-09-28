package com.listenmusic.service;

import java.nio.file.Path;
import java.util.Locale;

public final class LocalPathKey {
    private LocalPathKey() {
    }

    public static String of(Path path) {
        String normalized = path.toAbsolutePath().normalize().toString();
        return isWindows() ? normalized.toLowerCase(Locale.ROOT) : normalized;
    }

    public static String of(String path) {
        return of(Path.of(path));
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
    }
}
