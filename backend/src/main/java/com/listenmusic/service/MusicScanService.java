package com.listenmusic.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

@Service
public class MusicScanService {
    private static final List<String> AUDIO_EXTENSIONS = List.of(
        ".flac", ".mp3", ".wav", ".ogg", ".opus", ".m4a"
    );

    private final FlacMetadataParser flacMetadataParser;

    public MusicScanService() {
        this(new FlacMetadataParser());
    }

    public MusicScanService(FlacMetadataParser flacMetadataParser) {
        this.flacMetadataParser = flacMetadataParser;
    }

    public List<ScannedTrack> scan(Path directory) {
        if (directory == null || !Files.isDirectory(directory)) {
            throw new IllegalArgumentException("音乐目录不存在: " + directory);
        }

        try (Stream<Path> paths = Files.walk(directory)) {
            return paths
                .filter(Files::isRegularFile)
                .filter(this::isSupportedAudio)
                .sorted(Comparator.comparing(path -> path.getFileName().toString(), String.CASE_INSENSITIVE_ORDER))
                .map(this::scanFile)
                .toList();
        } catch (IOException ex) {
            throw new UncheckedIOException("扫描音乐目录失败: " + directory, ex);
        }
    }

    private ScannedTrack scanFile(Path file) {
        String fallbackTitle = stripExtension(file.getFileName().toString());
        String title = fallbackTitle;
        String artist = "未知歌手";
        String album = "本地音乐";
        long durationSeconds = 0;
        String embeddedLyrics = null;
        byte[] embeddedCover = null;
        String embeddedCoverMimeType = null;

        if (extension(file).equals(".flac")) {
            FlacMetadata metadata = flacMetadataParser.parse(file);
            title = valueOr(metadata.title(), fallbackTitle);
            artist = valueOr(metadata.artist(), artist);
            album = valueOr(metadata.album(), album);
            durationSeconds = metadata.durationSeconds();
            embeddedLyrics = metadata.lyrics();
            embeddedCover = metadata.cover();
            embeddedCoverMimeType = metadata.coverMimeType();
        }

        Path lyricsFile = sibling(file, ".lrc");
        String sidecarLyrics = embeddedLyrics == null || embeddedLyrics.isBlank()
            ? readTextIfExists(lyricsFile)
            : null;
        Path coverPath = findSidecarCover(file);
        byte[] sidecarCover = embeddedCover == null || embeddedCover.length == 0
            ? readBytesIfExists(coverPath)
            : null;

        return new ScannedTrack(
            stableId(file),
            title,
            artist,
            album,
            durationSeconds,
            file.toAbsolutePath().normalize(),
            embeddedLyrics,
            embeddedCover,
            embeddedCoverMimeType,
            sidecarLyrics,
            sidecarCover,
            coverPath
        );
    }

    public byte[] readEffectiveCover(Path file) {
        if (file == null || !Files.isRegularFile(file)) {
            return null;
        }
        if (extension(file).equals(".flac")) {
            FlacMetadata metadata = flacMetadataParser.parse(file);
            if (metadata.hasCover()) {
                return metadata.cover();
            }
        }
        return readBytesIfExists(findSidecarCover(file));
    }

    public String readEffectiveCoverMimeType(Path file) {
        if (file == null || !Files.isRegularFile(file)) {
            return null;
        }
        if (extension(file).equals(".flac")) {
            FlacMetadata metadata = flacMetadataParser.parse(file);
            if (metadata.hasCover()) {
                return metadata.coverMimeType();
            }
        }
        Path cover = findSidecarCover(file);
        if (cover == null) {
            return null;
        }
        String name = cover.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".png")) {
            return "image/png";
        }
        if (name.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    private boolean isSupportedAudio(Path file) {
        return AUDIO_EXTENSIONS.contains(extension(file));
    }

    private static String extension(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot);
    }

    private static String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static Path sibling(Path file, String extension) {
        return file.resolveSibling(stripExtension(file.getFileName().toString()) + extension);
    }

    private static Path findSidecarCover(Path file) {
        for (String extension : List.of(".jpg", ".jpeg", ".png", ".webp")) {
            Path candidate = sibling(file, extension);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private static String readTextIfExists(Path file) {
        if (file == null || !Files.isRegularFile(file)) {
            return null;
        }
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException("读取歌词失败: " + file, ex);
        }
    }

    private static byte[] readBytesIfExists(Path file) {
        if (file == null || !Files.isRegularFile(file)) {
            return null;
        }
        try {
            return Files.readAllBytes(file);
        } catch (IOException ex) {
            throw new UncheckedIOException("读取封面失败: " + file, ex);
        }
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String stableId(Path file) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(file.toAbsolutePath().normalize().toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder("local-");
            for (int i = 0; i < 12; i++) {
                result.append(String.format("%02x", digest[i]));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }
}
