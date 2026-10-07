package com.listenmusic.provider;

import java.util.Arrays;

public enum PlaybackQuality {
    AUTO,
    HIRES,
    LOSSLESS,
    EXHIGH,
    HIGH,
    STANDARD;

    public static PlaybackQuality parse(String value) {
        if (value == null || value.isBlank()) {
            return AUTO;
        }
        return Arrays.stream(values())
            .filter(candidate -> candidate.name().equalsIgnoreCase(value.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported playback quality: " + value));
    }
}
