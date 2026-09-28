package com.listenmusic.provider;

public record AccountSocialUser(
    String provider,
    String userId,
    String nickname,
    String avatarUrl,
    String signature,
    String type,
    int albumCount,
    int trackCount
) {
    public AccountSocialUser(
        String provider,
        String userId,
        String nickname,
        String avatarUrl,
        String signature
    ) {
        this(provider, userId, nickname, avatarUrl, signature, "user", 0, 0);
    }
}
