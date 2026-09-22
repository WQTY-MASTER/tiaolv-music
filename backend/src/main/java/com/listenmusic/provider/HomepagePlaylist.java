package com.listenmusic.provider;

public record HomepagePlaylist(
    String id,
    String title,
    String subtitle,
    String imageUrl,
    int count
) {
}
