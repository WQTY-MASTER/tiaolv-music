package com.listenmusic.service;

import com.listenmusic.domain.Track;

import java.util.List;

public record LibraryScanResult(
    List<Track> tracks,
    int total,
    int added,
    int removed
) {
}
