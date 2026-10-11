package com.listenmusic.provider;

public class PlaylistOrderRateLimitException extends IllegalStateException {
    public PlaylistOrderRateLimitException(String message, Throwable cause) {
        super(message, cause);
    }
}
