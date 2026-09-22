package com.listenmusic.provider;

import com.listenmusic.domain.Track;

import java.util.List;

public record HomepageData(
    List<HomepageBanner> banners,
    List<HomepagePlaylist> playlists,
    List<Track> songs,
    String cursor,
    boolean hasMore
) {
    public HomepageData {
        banners = List.copyOf(banners == null ? List.of() : banners);
        playlists = List.copyOf(playlists == null ? List.of() : playlists);
        songs = List.copyOf(songs == null ? List.of() : songs);
    }

    public static HomepageData empty() {
        return new HomepageData(List.of(), List.of(), List.of(), null, false);
    }
}
