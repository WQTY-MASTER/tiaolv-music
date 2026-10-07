package com.listenmusic.domain;

import java.util.Map;

public record ListeningStats(
    long revision,
    Map<String, TrackStat> tracks,
    Map<String, DayStat> days
) {
    public ListeningStats(Map<String, TrackStat> tracks, Map<String, DayStat> days) {
        this(0, tracks, days);
    }

    public ListeningStats {
        tracks = tracks == null ? Map.of() : Map.copyOf(tracks);
        days = days == null ? Map.of() : Map.copyOf(days);
    }

    public record TrackStat(
        String trackId,
        int playCount,
        double listenedSeconds,
        String lastListenedAt,
        String lastListenedDate
    ) {
        public TrackStat(String trackId, int playCount, double listenedSeconds, String lastListenedAt) {
            this(trackId, playCount, listenedSeconds, lastListenedAt, null);
        }
    }

    public record DayStat(String date, double listenedSeconds) {
    }
}
