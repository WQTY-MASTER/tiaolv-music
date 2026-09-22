package com.listenmusic.provider;

import com.listenmusic.domain.Track;

import java.util.List;

public record SearchResultPage(
    List<Track> songs,
    List<PlaylistDiscoveryItem> playlists,
    List<SearchArtist> artists,
    long total,
    boolean hasMore
) {
    public static SearchResultPage empty() {
        return new SearchResultPage(List.of(), List.of(), List.of(), 0, false);
    }
}
