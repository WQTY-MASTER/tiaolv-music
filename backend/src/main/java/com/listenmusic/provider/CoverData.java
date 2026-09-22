package com.listenmusic.provider;

public record CoverData(
    byte[] bytes,
    String contentType
) {
}
