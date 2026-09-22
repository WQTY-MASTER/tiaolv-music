package com.listenmusic.auth;

public record QrLoginStatusResponse(
    String sessionId,
    String provider,
    String status,
    String userId,
    String nickname,
    String avatarUrl,
    String message
) {
}
