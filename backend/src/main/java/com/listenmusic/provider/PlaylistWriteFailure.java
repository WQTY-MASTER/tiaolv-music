package com.listenmusic.provider;

import java.net.SocketTimeoutException;
import java.util.regex.Pattern;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

public final class PlaylistWriteFailure {
    private static final Pattern CODE = Pattern.compile("(?:返回错误|调用失败)\\s*[:：]\\s*(-?\\d{1,9})(?!\\d)");

    private PlaylistWriteFailure() {}

    public static String reason(Throwable error) {
        String reason = "平台未确认操作结果，请刷新歌单后重试；仍失败时请导出诊断包。";
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof RestClientResponseException response) return "接口返回 HTTP " + response.getStatusCode().value() + "，请稍后重试。";
            if (cause instanceof SocketTimeoutException) return "连接超时，请检查网络后重试。";
            if (cause instanceof ResourceAccessException) reason = "无法连接平台接口，请检查网络后重试。";
            String detail = cause.getMessage();
            if (detail == null) continue;
            var code = CODE.matcher(detail);
            if (code.find()) reason = "平台返回错误码 " + code.group(1) + "，请稍后重试。";
            else if (detail.contains("尚未确认")) reason = "平台尚未确认操作结果，请刷新歌单后再检查。";
        }
        return reason;
    }
}
