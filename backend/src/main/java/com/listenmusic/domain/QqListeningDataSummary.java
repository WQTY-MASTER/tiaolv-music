package com.listenmusic.domain;

public record QqListeningDataSummary(
    String accountId,
    String nickname,
    String avatarUrl,
    long trackCount,
    double listenedSeconds,
    String firstDate,
    String lastDate
) {
}
