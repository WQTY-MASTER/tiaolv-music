package com.listenmusic.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Stream;

@Service
public class ProviderResourceCache {
    private static final String MANAGED_DIRECTORY_NAME = ".tiaolv-music-cache";

    public enum Category {
        COVER("cover"),
        LYRICS("lyrics"),
        METADATA("metadata");

        private final String directoryName;

        Category(String directoryName) {
            this.directoryName = directoryName;
        }
    }

    public record Settings(
        String directory,
        boolean coverEnabled,
        boolean lyricsEnabled,
        boolean metadataEnabled
    ) {
    }

    public record CategoryStatistics(long bytes, long entries) {
    }

    public record Statistics(
        long totalBytes,
        long totalEntries,
        CategoryStatistics cover,
        CategoryStatistics lyrics,
        CategoryStatistics metadata
    ) {
    }

    private record CacheEnvelope(String key, JsonNode payload) {
    }

    private final ObjectMapper objectMapper;
    private final Path configFile;
    private final Path defaultDirectory;
    private Settings settings;

    @Autowired
    public ProviderResourceCache(
        ObjectMapper objectMapper,
        @Value("${listenmusic.cache.config-file:${user.home}/.tiaolv-music/cache-settings.json}") String configFile
    ) {
        this(objectMapper, Path.of(configFile));
    }

    ProviderResourceCache(ObjectMapper objectMapper, Path configFile) {
        this.objectMapper = objectMapper;
        this.configFile = configFile.toAbsolutePath().normalize();
        Path parent = this.configFile.getParent();
        this.defaultDirectory = (parent == null ? Path.of("cache") : parent.resolve("cache"))
            .toAbsolutePath()
            .normalize();
        this.settings = readSettings();
        ensureDirectory(cacheDirectory());
    }

    public synchronized Settings settings() {
        return settings;
    }

    public synchronized Settings update(Settings requested) {
        if (requested == null) {
            throw new IllegalArgumentException("缓存设置不能为空");
        }
        Path nextDirectory = normalizeDirectory(requested.directory());
        Path previousDirectory = cacheDirectory();
        if (!previousDirectory.equals(nextDirectory)) {
            migrateManagedEntries(previousDirectory, nextDirectory);
        }
        settings = new Settings(
            nextDirectory.toString(),
            requested.coverEnabled(),
            requested.lyricsEnabled(),
            requested.metadataEnabled()
        );
        persistSettings();
        return settings;
    }

    public synchronized Settings restoreDefaultDirectory() {
        return update(new Settings(
            defaultDirectory.toString(),
            settings.coverEnabled(),
            settings.lyricsEnabled(),
            settings.metadataEnabled()
        ));
    }

    public synchronized <T> Optional<T> read(
        Category category,
        String provider,
        String resourceId,
        Class<T> type
    ) {
        String key = cacheKey(category, provider, resourceId);
        Path file = cacheFile(category, key);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            CacheEnvelope envelope = objectMapper.readValue(file.toFile(), CacheEnvelope.class);
            if (!key.equals(envelope.key()) || envelope.payload() == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.treeToValue(envelope.payload(), type));
        } catch (IOException | RuntimeException exception) {
            return Optional.empty();
        }
    }

    public synchronized void write(Category category, String provider, String resourceId, Object value) {
        if (value == null || !isWriteEnabled(category)) {
            return;
        }
        String key = cacheKey(category, provider, resourceId);
        Path directory = categoryDirectory(category);
        try {
            Files.createDirectories(directory);
            Path temporary = Files.createTempFile(directory, "cache-", ".tmp");
            objectMapper.writeValue(temporary.toFile(), new CacheEnvelope(key, objectMapper.valueToTree(value)));
            moveReplacing(temporary, cacheFile(category, key));
        } catch (IOException ignored) {
            // Cache failures must never interrupt search, playback, or lyrics loading.
        }
    }

    public synchronized Statistics statistics() {
        CategoryStatistics cover = statistics(Category.COVER);
        CategoryStatistics lyrics = statistics(Category.LYRICS);
        CategoryStatistics metadata = statistics(Category.METADATA);
        return new Statistics(
            cover.bytes() + lyrics.bytes() + metadata.bytes(),
            cover.entries() + lyrics.entries() + metadata.entries(),
            cover,
            lyrics,
            metadata
        );
    }

    public synchronized Statistics clear() {
        for (Category category : Category.values()) {
            deleteTree(categoryDirectory(category));
        }
        ensureDirectory(cacheDirectory());
        return statistics();
    }

    private Settings readSettings() {
        if (Files.isRegularFile(configFile)) {
            try {
                Settings stored = objectMapper.readValue(configFile.toFile(), Settings.class);
                return new Settings(
                    normalizeDirectory(stored.directory()).toString(),
                    stored.coverEnabled(),
                    stored.lyricsEnabled(),
                    stored.metadataEnabled()
                );
            } catch (IOException | RuntimeException ignored) {
                // Fall through to safe defaults when the settings file is missing or malformed.
            }
        }
        return new Settings(defaultDirectory.toString(), true, true, true);
    }

    private void persistSettings() {
        try {
            Path parent = configFile.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Path temporary = Files.createTempFile(
                parent == null ? Path.of(".") : parent,
                "cache-settings-",
                ".tmp"
            );
            objectMapper.writeValue(temporary.toFile(), settings);
            moveReplacing(temporary, configFile);
        } catch (IOException exception) {
            throw new UncheckedIOException("保存缓存设置失败", exception);
        }
    }

    private Path normalizeDirectory(String directory) {
        if (directory == null || directory.isBlank()) {
            throw new IllegalArgumentException("缓存目录不能为空");
        }
        return Path.of(directory.trim()).toAbsolutePath().normalize();
    }

    private Path cacheDirectory() {
        return Path.of(settings.directory()).toAbsolutePath().normalize();
    }

    private Path categoryDirectory(Category category) {
        return managedDirectory(cacheDirectory()).resolve(category.directoryName).normalize();
    }

    private static Path managedDirectory(Path root) {
        return root.resolve(MANAGED_DIRECTORY_NAME).normalize();
    }

    private Path cacheFile(Category category, String key) {
        return categoryDirectory(category).resolve(sha256(key) + ".json");
    }

    private boolean isWriteEnabled(Category category) {
        return switch (category) {
            case COVER -> settings.coverEnabled();
            case LYRICS -> settings.lyricsEnabled();
            case METADATA -> settings.metadataEnabled();
        };
    }

    private String cacheKey(Category category, String provider, String resourceId) {
        String normalizedProvider = provider == null || provider.isBlank()
            ? "unknown"
            : provider.trim().toLowerCase(Locale.ROOT);
        String normalizedResourceId = resourceId == null || resourceId.isBlank()
            ? "unknown"
            : resourceId.trim();
        return category.directoryName + ":" + normalizedProvider + ":" + normalizedResourceId;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private CategoryStatistics statistics(Category category) {
        Path directory = categoryDirectory(category);
        if (!Files.isDirectory(directory)) {
            return new CategoryStatistics(0, 0);
        }
        try (Stream<Path> paths = Files.walk(directory)) {
            long[] totals = paths
                .filter(Files::isRegularFile)
                .map(path -> new long[]{fileSize(path), 1})
                .reduce(new long[2], (left, right) -> new long[]{
                    left[0] + right[0], left[1] + right[1]
                });
            return new CategoryStatistics(totals[0], totals[1]);
        } catch (IOException exception) {
            return new CategoryStatistics(0, 0);
        }
    }

    private static long fileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException exception) {
            return 0;
        }
    }

    private void migrateManagedEntries(Path sourceRoot, Path targetRoot) {
        ensureDirectory(targetRoot);
        for (Category category : Category.values()) {
            Path source = managedDirectory(sourceRoot).resolve(category.directoryName).normalize();
            Path target = managedDirectory(targetRoot).resolve(category.directoryName).normalize();
            if (!Files.isDirectory(source)) {
                continue;
            }
            try (Stream<Path> paths = Files.walk(source)) {
                for (Path path : paths.sorted().toList()) {
                    Path relative = source.relativize(path);
                    Path destination = target.resolve(relative).normalize();
                    if (Files.isDirectory(path)) {
                        Files.createDirectories(destination);
                    } else if (Files.isRegularFile(path)) {
                        Files.createDirectories(destination.getParent());
                        try {
                            Files.move(path, destination, StandardCopyOption.REPLACE_EXISTING);
                        } catch (IOException moveError) {
                            Files.copy(path, destination, StandardCopyOption.REPLACE_EXISTING);
                            Files.deleteIfExists(path);
                        }
                    }
                }
            } catch (IOException exception) {
                throw new UncheckedIOException("迁移缓存目录失败", exception);
            }
            deleteTree(source);
        }
    }

    private static void ensureDirectory(Path directory) {
        try {
            Files.createDirectories(directory);
        } catch (IOException exception) {
            throw new UncheckedIOException("创建缓存目录失败", exception);
        }
    }

    private static void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void deleteTree(Path root) {
        if (!Files.exists(root)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        } catch (IOException exception) {
            throw new UncheckedIOException("清理缓存失败", exception);
        }
    }
}
