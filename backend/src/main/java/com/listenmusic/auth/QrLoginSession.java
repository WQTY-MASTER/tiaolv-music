package com.listenmusic.auth;

import java.time.OffsetDateTime;

public record QrLoginSession(
    String sessionId,
    String provider,
    String qrKey,
    String status,
    OffsetDateTime expiresAt,
    String credentialReference,
    String createdAt,
    String updatedAt
) {
}
