package com.listenmusic.service;

/** Returned at the application boundary when account-scoped content has no valid session. */
public class AccountLoginRequiredException extends IllegalStateException {
    public AccountLoginRequiredException() {
        super("请先登录音乐源账号");
    }
}
