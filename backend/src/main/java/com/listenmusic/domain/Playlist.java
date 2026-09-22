package com.listenmusic.domain;

public record Playlist(
    String id,
    String name,
    String source,
    String createdAt,
    String updatedAt
) {
}
