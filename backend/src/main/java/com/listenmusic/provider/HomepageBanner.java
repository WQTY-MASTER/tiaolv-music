package com.listenmusic.provider;

public record HomepageBanner(
    String title,
    String subtitle,
    String imageUrl,
    String targetId,
    Integer targetType,
    String targetUrl
) {
}
