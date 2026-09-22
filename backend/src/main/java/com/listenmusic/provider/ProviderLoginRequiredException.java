package com.listenmusic.provider;

/** Indicates that an upstream provider rejected an account request as unauthenticated. */
public class ProviderLoginRequiredException extends IllegalStateException {
    public ProviderLoginRequiredException() {
        super("音乐源账号需要登录");
    }

    public ProviderLoginRequiredException(String message) {
        super(message);
    }
}
