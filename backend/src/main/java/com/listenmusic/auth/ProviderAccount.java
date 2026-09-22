package com.listenmusic.auth;

public record ProviderAccount(
    String provider,
    String providerUserId,
    String nickname,
    String avatarUrl,
    String credentialReference,
    boolean active,
    String createdAt,
    String updatedAt
) {
}
