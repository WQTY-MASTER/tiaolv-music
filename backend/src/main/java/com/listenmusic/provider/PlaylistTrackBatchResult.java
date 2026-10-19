package com.listenmusic.provider;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashSet;

public record PlaylistTrackBatchResult(List<String> succeeded, List<String> failed, Map<String, String> errors) {
    public PlaylistTrackBatchResult {
        succeeded = List.copyOf(succeeded);
        failed = List.copyOf(failed);
        errors = Map.copyOf(errors);
        var ids = new HashSet<>(succeeded);
        if (ids.size() != succeeded.size() || failed.stream().anyMatch(id -> !ids.add(id)) || !failed.containsAll(errors.keySet())) {
            throw new IllegalArgumentException("无效的歌曲批量操作结果");
        }
    }

    public static PlaylistTrackBatchResult failure(List<String> ids, Throwable error) {
        Map<String, String> errors = new LinkedHashMap<>();
        String reason = PlaylistWriteFailure.reason(error);
        for (String id : ids) errors.put(id, reason);
        return new PlaylistTrackBatchResult(List.of(), ids, errors);
    }
}
