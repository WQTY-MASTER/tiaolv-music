package com.listenmusic.auth;

public record QrLoginStartResponse(
    String sessionId,
    String provider,
    String status,
    String qrimg,
    String qrurl,
    long expiresInSeconds
) {
}
