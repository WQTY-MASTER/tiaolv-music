package com.listenmusic.auth;

public record AccountView(
    String provider,
    String userId,
    String nickname,
    String avatarUrl
) {
}
