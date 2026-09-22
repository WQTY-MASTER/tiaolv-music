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
    String coverMimeType,
    String createdAt,
    String updatedAt
) {
}
