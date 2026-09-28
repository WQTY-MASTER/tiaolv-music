package com.listenmusic.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.provider.LyricData;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

@Service
public class LocalLyricsCache {
    private final ObjectMapper objectMapper;
    private final Path directory;

    public LocalLyricsCache(
        ObjectMapper objectMapper,
        @Value("${listenmusic.lyrics.cache-directory:${user.home}/.tiaolv-music/lyric-cache}") String directory
    ) {
        this.objectMapper = objectMapper;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public Optional<LyricData> load(String trackId) {
        Path file = cacheFile(trackId);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(file.toFile(), LyricData.class));
        } catch (IOException ex) {
            return Optional.empty();
        }
    }

    public void save(String trackId, LyricData lyrics) {
        try {
            Files.createDirectories(directory);
            Path target = cacheFile(trackId);
            Path temporary = Files.createTempFile(directory, "lyrics-", ".tmp");
            objectMapper.writeValue(temporary.toFile(), lyrics);
            try {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException ex) {
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new UncheckedIOException("缓存歌词失败: " + trackId, ex);
        }
    }

    private Path cacheFile(String trackId) {
        String safeId = trackId == null ? "unknown" : trackId.replaceAll("[^a-zA-Z0-9._-]", "_");
        return directory.resolve(safeId + ".json");
    }
}
