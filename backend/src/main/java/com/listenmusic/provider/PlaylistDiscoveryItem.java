package com.listenmusic.provider;

public record PlaylistDiscoveryItem(
    String id,
    String title,
    String subtitle,
    String imageUrl,
    int count,
    long playCount
) {}
