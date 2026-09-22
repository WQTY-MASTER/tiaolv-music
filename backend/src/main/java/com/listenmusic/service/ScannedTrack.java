package com.listenmusic.service;

import java.nio.file.Path;

public record ScannedTrack(
    String id,
    String title,
    String artist,
    String album,
    long durationSeconds,
    Path filePath,
    String embeddedLyrics,
    byte[] embeddedCover,
    String embeddedCoverMimeType,
    String sidecarLyrics,
    byte[] sidecarCover,
    Path sidecarCoverPath
) {
    public boolean hasLyrics() {
        return effectiveLyrics() != null && !effectiveLyrics().isBlank();
    }

    public boolean hasCover() {
        byte[] cover = effectiveCover();
        return cover != null && cover.length > 0;
    }

    public String effectiveLyrics() {
        return embeddedLyrics != null && !embeddedLyrics.isBlank()
            ? embeddedLyrics
            : sidecarLyrics;
    }

    public byte[] effectiveCover() {
        return embeddedCover != null && embeddedCover.length > 0
            ? embeddedCover
            : sidecarCover;
    }

    public String effectiveCoverMimeType() {
        if (embeddedCover != null && embeddedCover.length > 0) {
            return embeddedCoverMimeType == null ? "image/jpeg" : embeddedCoverMimeType;
        }
        if (sidecarCoverPath == null) {
            return null;
        }
        String name = sidecarCoverPath.getFileName().toString().toLowerCase();
        if (name.endsWith(".png")) {
            return "image/png";
        }
        if (name.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }
}
