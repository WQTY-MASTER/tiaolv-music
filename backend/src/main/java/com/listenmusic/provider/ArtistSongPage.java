package com.listenmusic.provider;

import com.listenmusic.domain.Track;

import java.util.List;

public record ArtistSongPage(
    List<Track> songs,
    long total,
    boolean hasMore
) {
}
