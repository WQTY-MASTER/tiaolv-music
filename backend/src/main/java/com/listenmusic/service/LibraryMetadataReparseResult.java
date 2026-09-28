package com.listenmusic.service;

import com.listenmusic.domain.Track;

import java.util.List;

public record LibraryMetadataReparseResult(
    List<Track> tracks,
    int total,
    int filenameResolved
) {
}
