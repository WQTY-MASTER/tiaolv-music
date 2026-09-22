package com.listenmusic.provider;

import java.util.List;

public record PlaylistDiscoveryPage(
    List<PlaylistDiscoveryItem> playlists,
    long total,
    boolean hasMore,
    String cursor
) {}
