package com.listenmusic.domain;

public record Track(
    String id,
    String title,
    String artist,
    String album,
    Long duration,
    String source,
    String filePath,
    String url,
    String coverUrl,
    String lyrics,
    String lyricsSource,
    String lyricsFormat,
    String coverMimeType,
    String createdAt,
    String updatedAt,
    String metaSource
) {
    public Track(
        String id,
        String title,
        String artist,
        String album,
        Long duration,
        String source,
        String filePath,
        String url,
        String coverUrl,
        String lyrics,
        String lyricsSource,
        String lyricsFormat,
        String coverMimeType,
        String createdAt,
        String updatedAt
    ) {
        this(
            id, title, artist, album, duration, source, filePath, url, coverUrl,
            lyrics, lyricsSource, lyricsFormat, coverMimeType, createdAt, updatedAt, null
        );
    }

    public Track(
        String id,
        String title,
        String artist,
        String album,
        Long duration,
        String source,
        String filePath,
        String url,
        String coverUrl,
        String lyrics,
        String lyricsSource,
        String coverMimeType,
        String createdAt,
        String updatedAt
    ) {
        this(
            id, title, artist, album, duration, source, filePath, url, coverUrl,
            lyrics, lyricsSource, null, coverMimeType, createdAt, updatedAt, null
        );
    }
}
