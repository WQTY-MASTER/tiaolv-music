package com.listenmusic.provider;

import com.listenmusic.domain.Track;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class JamendoProvider implements MusicProvider {
    @Override
    public String id() {
        return "jamendo";
    }

    @Override
    public List<Track> search(String query) {
        return List.of();
    }

    @Override
    public java.util.Optional<Track> find(String trackId) {
        return java.util.Optional.empty();
    }

    @Override
    public java.util.Optional<String> resolveAudioUrl(String trackId) {
        return java.util.Optional.empty();
    }

    @Override
    public java.util.Optional<LyricData> loadLyrics(String trackId) {
        return java.util.Optional.empty();
    }
}
