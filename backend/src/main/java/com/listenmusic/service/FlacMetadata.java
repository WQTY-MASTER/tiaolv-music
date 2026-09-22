package com.listenmusic.service;

public record FlacMetadata(
    String title,
    String artist,
    String album,
    long durationSeconds,
    String lyrics,
    byte[] cover,
    String coverMimeType
) {
    public boolean hasLyrics() {
        return lyrics != null && !lyrics.isBlank();
    }

    public boolean hasCover() {
        return cover != null && cover.length > 0;
    }
}
