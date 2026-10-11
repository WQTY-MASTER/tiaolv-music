package com.listenmusic.provider;

public class PlaylistOrderConflictException extends IllegalStateException {
    public PlaylistOrderConflictException(String message) {
        super(message);
    }

    public PlaylistOrderConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
