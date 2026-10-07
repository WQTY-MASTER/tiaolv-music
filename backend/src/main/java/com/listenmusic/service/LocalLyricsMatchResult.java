package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;

public record LocalLyricsMatchResult(
    boolean matched,
    Track track,
    String message,
    LyricData lyricData
) {
    public LocalLyricsMatchResult(boolean matched, Track track, String message) {
        this(matched, track, message, null);
    }
}
