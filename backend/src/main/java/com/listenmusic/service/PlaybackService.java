package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.repository.UserDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PlaybackService {
    private static final String LOCAL_PROFILE_ID = "local";
    private final UserDataRepository userDataRepository;

    public PlaybackService(UserDataRepository userDataRepository) {
        this.userDataRepository = userDataRepository;
    }

    public void play(String trackId) {
        Map<String, Object> state = new LinkedHashMap<>(snapshot());
        state.put("trackId", trackId);
        saveState(state);
    }

    public void pause() {
        // Pausing keeps the current track so it can be restored on next launch.
    }

    public void setVolume(int value) {
        Map<String, Object> state = new LinkedHashMap<>(snapshot());
        state.put("volume", Math.max(0, Math.min(100, value)));
        saveState(state);
    }

    public Map<String, Object> snapshot() {
        return userDataRepository.findPlaybackState(LOCAL_PROFILE_ID)
            .orElseGet(() -> {
                Map<String, Object> defaults = new LinkedHashMap<>();
                defaults.put("trackId", null);
                defaults.put("positionSeconds", 0.0);
                defaults.put("volume", 72);
                defaults.put("playMode", "sequence");
                return defaults;
            });
    }

    public void saveState(Map<String, Object> state) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("trackId", state.get("trackId"));
        normalized.put("positionSeconds", number(state.get("positionSeconds"), 0.0));
        normalized.put("volume", Math.max(0, Math.min(100, (int) number(state.get("volume"), 72.0))));
        String playMode = String.valueOf(state.getOrDefault("playMode", "sequence"));
        normalized.put("playMode", List.of("shuffle", "sequence", "single", "loop").contains(playMode)
            ? playMode
            : "sequence");
        userDataRepository.savePlaybackState(LOCAL_PROFILE_ID, normalized);
    }

    public List<Track> queue() {
        return userDataRepository.findQueue(LOCAL_PROFILE_ID);
    }

    @Transactional
    public void replaceQueue(List<Track> tracks) {
        userDataRepository.replaceQueue(LOCAL_PROFILE_ID, tracks == null ? List.of() : tracks);
    }

    private double number(Object value, double fallback) {
        return value instanceof Number number ? number.doubleValue() : fallback;
    }
}
