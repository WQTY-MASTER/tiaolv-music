package com.listenmusic.provider;

public record CloudTrack(
    String id,
    String title,
    String artist,
    String album,
    long duration,
    String originalFileName,
    String format,
    long sizeBytes,
    String uploadedAt,
    String audioUrl,
    String coverUrl
) {
}
