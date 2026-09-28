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
import java.util.Optional;
import java.util.stream.Stream;

@Service
public class MusicScanService {
    private static final List<String> AUDIO_EXTENSIONS = List.of(
        ".flac", ".mp3", ".wav", ".ogg", ".opus", ".m4a"
    );

    private final FlacMetadataParser flacMetadataParser;
    private final LocalFilenameMetadataParser filenameMetadataParser;

    public MusicScanService() {
        this(new FlacMetadataParser(), new LocalFilenameMetadataParser());
    }

    public MusicScanService(FlacMetadataParser flacMetadataParser) {
        this(flacMetadataParser, new LocalFilenameMetadataParser());
    }

    public MusicScanService(
        FlacMetadataParser flacMetadataParser,
        LocalFilenameMetadataParser filenameMetadataParser
    ) {
        this.flacMetadataParser = flacMetadataParser;
        this.filenameMetadataParser = filenameMetadataParser;
    }

    public List<ScannedTrack> scan(Path directory) {
        return scan(directory, true);
    }

    public List<ScannedTrack> scan(Path directory, boolean useFilenameMetadata) {
        return scanFiles(findAudioFiles(directory), useFilenameMetadata);
    }

    public List<Path> findAudioFiles(Path directory) {
        if (directory == null || !Files.isDirectory(directory)) {
            throw new IllegalArgumentException("音乐目录不存在: " + directory);
        }

        try (Stream<Path> paths = Files.walk(directory)) {
            return paths
                .filter(Files::isRegularFile)
                .filter(this::isSupportedAudio)
                .sorted(Comparator.comparing(path -> path.getFileName().toString(), String.CASE_INSENSITIVE_ORDER))
                .map(path -> path.toAbsolutePath().normalize())
                .toList();
        } catch (IOException ex) {
            throw new UncheckedIOException("扫描音乐目录失败: " + directory, ex);
        }
    }

    public List<ScannedTrack> scanFiles(List<Path> files) {
        return scanFiles(files, true);
    }

    public List<ScannedTrack> scanFiles(List<Path> files, boolean useFilenameMetadata) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        return files.stream().map(file -> scanFile(file, useFilenameMetadata)).toList();
    }

    private ScannedTrack scanFile(Path file, boolean useFilenameMetadata) {
        String fallbackTitle = stripExtension(file.getFileName().toString());
        String title = fallbackTitle;
        String artist = "未知歌手";
        String album = "本地音乐";
        String metaSource = null;
        boolean embeddedTitleValid = false;
        boolean embeddedArtistValid = false;
        long durationSeconds = 0;
        String embeddedLyrics = null;
        byte[] embeddedCover = null;
        String embeddedCoverMimeType = null;

        if (extension(file).equals(".flac")) {
            FlacMetadata metadata = flacMetadataParser.parse(file);
            embeddedTitleValid = isValidMetadata(metadata.title(), "title");
            embeddedArtistValid = isValidMetadata(metadata.artist(), "artist");
            title = embeddedTitleValid ? metadata.title().trim() : fallbackTitle;
            artist = embeddedArtistValid ? metadata.artist().trim() : artist;
            album = valueOr(metadata.album(), album);
            metaSource = embeddedTitleValid || embeddedArtistValid ? "embedded" : null;
            durationSeconds = metadata.durationSeconds();
            embeddedLyrics = metadata.lyrics();
            embeddedCover = metadata.cover();
            embeddedCoverMimeType = metadata.coverMimeType();
        }

        if (useFilenameMetadata) {
            Optional<LocalFilenameMetadataParser.ParsedMetadata> parsed = filenameMetadataParser
                .parse(file.getFileName().toString());
            if (parsed.isPresent()) {
                boolean replaced = false;
                if (!embeddedTitleValid) {
                    title = parsed.get().title();
                    replaced = true;
                }
                if (!embeddedArtistValid) {
                    artist = parsed.get().artist();
                    replaced = true;
                }
                if (replaced) {
                    metaSource = "filename";
                }
            }
        }

        Path lyricsFile = findSidecarLyrics(file);
        String sidecarLyrics = embeddedLyrics == null || embeddedLyrics.isBlank()
            ? readTextIfExists(lyricsFile)
            : null;
        String lyricsFormat = embeddedLyrics != null && !embeddedLyrics.isBlank()
            ? detectLyricsFormat(embeddedLyrics)
            : lyricsFormatFromPath(lyricsFile);
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
            lyricsFormat,
            sidecarCover,
            coverPath,
            metaSource
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

    private static Path findSidecarLyrics(Path file) {
        for (String extension : List.of(".qrc", ".yrc", ".lrc")) {
            Path candidate = sibling(file, extension);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private static String lyricsFormatFromPath(Path file) {
        if (file == null) {
            return null;
        }
        return switch (extension(file)) {
            case ".qrc" -> "QRC";
            case ".yrc" -> "YRC";
            default -> "LRC";
        };
    }

    private static String detectLyricsFormat(String lyrics) {
        if (lyrics == null || lyrics.isBlank()) {
            return null;
        }
        if (lyrics.matches("(?s).*\\[\\d+,\\d+]\\(\\d+,\\d+,\\d+\\).*")) {
            return "YRC";
        }
        if (lyrics.matches("(?s).*\\[\\d+,\\d+].*\\(\\d+,\\d+\\).*")) {
            return "QRC";
        }
        return "LRC";
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

    private static boolean isValidMetadata(String value, String kind) {
        if (value == null || value.isBlank() || value.indexOf('\uFFFD') >= 0) {
            return false;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if ("artist".equals(kind)) {
            return !List.of("未知歌手", "未知艺术家", "unknown artist", "unknown").contains(normalized);
        }
        return !List.of("未知歌曲", "未知标题", "unknown title", "unknown").contains(normalized);
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
