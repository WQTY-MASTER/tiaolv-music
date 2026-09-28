package com.listenmusic.api;

public record ListeningScrobbleRequest(
    String trackId,
    String title,
    String artist,
    long listenedSeconds,
    long totalSeconds
) {
}
