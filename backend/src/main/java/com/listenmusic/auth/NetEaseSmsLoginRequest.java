package com.listenmusic.auth;

public record NetEaseSmsLoginRequest(String phone, String captcha) {
}
