package com.listenmusic.provider;

public class FavoriteOperationException extends IllegalStateException {
    public FavoriteOperationException(String message) {
        super(message);
    }

    public FavoriteOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
