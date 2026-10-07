package com.listenmusic.service;

public class StaleListeningStatsException extends RuntimeException {
    public StaleListeningStatsException(long expectedRevision, long actualRevision) {
        super("聆听统计已更新，请刷新后重试。当前修订号：" + actualRevision);
    }
}
