package com.listenmusic.provider;

public record ArtistAlbum(
    String id,
    String title,
    String imageUrl,
    int trackCount,
    String releaseDate
) {
}
