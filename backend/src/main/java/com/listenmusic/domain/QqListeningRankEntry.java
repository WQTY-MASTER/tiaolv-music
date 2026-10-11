package com.listenmusic.domain;

public record QqListeningRankEntry(
    Track track,
    long playCount,
    double listenedSeconds,
    String lastListenedAt
) {
}
