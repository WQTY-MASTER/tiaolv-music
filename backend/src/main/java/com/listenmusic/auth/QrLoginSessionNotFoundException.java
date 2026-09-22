package com.listenmusic.auth;

public class QrLoginSessionNotFoundException extends RuntimeException {
    public QrLoginSessionNotFoundException(String sessionId) {
        super("二维码登录会话不存在或已失效: " + sessionId);
    }
}
