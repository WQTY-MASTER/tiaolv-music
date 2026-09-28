package com.listenmusic.service;

import com.listenmusic.domain.Track;

public record LocalLyricsMatchResult(
    boolean matched,
    Track track,
    String message
) {
}
