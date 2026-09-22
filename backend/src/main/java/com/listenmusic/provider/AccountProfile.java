package com.listenmusic.provider;

public record AccountProfile(
    String provider,
    String userId,
    String nickname,
    String avatarUrl,
    String signature,
    int follows,
    int followers
) {
}
