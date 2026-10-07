package com.listenmusic.service;

import com.listenmusic.provider.LyricData;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class LocalLyricsCache {
    private final ProviderResourceCache resourceCache;

    public LocalLyricsCache(ProviderResourceCache resourceCache) {
        this.resourceCache = resourceCache;
    }

    public Optional<LyricData> load(String trackId) {
        return resourceCache.read(
            ProviderResourceCache.Category.LYRICS,
            "local",
            trackId,
            LyricData.class
        );
    }

    public void save(String trackId, LyricData lyrics) {
        resourceCache.write(ProviderResourceCache.Category.LYRICS, "local", trackId, lyrics);
    }
}
