package com.listenmusic.provider;

public record ArtistDetail(
    String provider,
    String id,
    String name,
    String avatarUrl,
    String signature,
    int albumCount,
    int trackCount
) {
}
