package com.listenmusic.provider;

public class RecentPlayReportException extends IllegalStateException {
    public RecentPlayReportException(String message) {
        super(message);
    }

    public RecentPlayReportException(String message, Throwable cause) {
        super(message, cause);
    }
}
