package com.listenmusic.provider;

public record AccountSocialUser(
    String provider,
    String userId,
    String nickname,
    String avatarUrl,
    String signature
) {
}
