package com.listenmusic.domain;

import java.util.List;

public record ListeningStatsSummary(
    long revision,
    int trackCount,
    int activeDays,
    double listenedSeconds,
    List<Integer> years,
    List<String> months,
    int rangeTrackCount,
    int rangeActiveDays,
    double rangeListenedSeconds
) {
}
