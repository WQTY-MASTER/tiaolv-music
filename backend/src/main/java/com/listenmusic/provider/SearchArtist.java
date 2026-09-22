package com.listenmusic.provider;

public record SearchArtist(
    String id,
    String name,
    String imageUrl,
    int albumCount,
    int trackCount,
    String source
) {}
