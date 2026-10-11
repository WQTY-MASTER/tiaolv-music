package com.listenmusic.provider;

import com.listenmusic.domain.Track;

import java.util.List;

public record RecentTracksDeleteResult(List<String> deletedTrackIds, List<Track> tracks) {
    public RecentTracksDeleteResult {
        deletedTrackIds = List.copyOf(deletedTrackIds == null ? List.of() : deletedTrackIds);
        tracks = List.copyOf(tracks == null ? List.of() : tracks);
    }
}
