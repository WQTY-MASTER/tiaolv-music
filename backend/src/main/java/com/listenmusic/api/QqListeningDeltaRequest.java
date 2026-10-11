package com.listenmusic.api;

import com.listenmusic.domain.Track;

public record QqListeningDeltaRequest(
    String accountId,
    String accountNickname,
    String accountAvatarUrl,
    Track track,
    double listenedSeconds,
    int playCount
) {
}
