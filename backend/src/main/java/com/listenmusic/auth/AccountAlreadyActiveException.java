package com.listenmusic.auth;

public class AccountAlreadyActiveException extends RuntimeException {
    public AccountAlreadyActiveException(String provider) {
        super("已有登录中的音乐平台账号，请先退出 " + provider);
    }
}
