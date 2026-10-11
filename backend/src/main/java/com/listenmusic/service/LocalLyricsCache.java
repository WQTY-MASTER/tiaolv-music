package com.listenmusic.service;

import com.listenmusic.provider.LyricData;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class LocalLyricsCache {
    private static final String MATCH_PROVIDER = "local-match";
    private static final String LEGACY_PROVIDER = "local";

    public record Lookup(boolean matched, LyricData lyrics) {
    }

    private final ProviderResourceCache resourceCache;

    public LocalLyricsCache(ProviderResourceCache resourceCache) {
        this.resourceCache = resourceCache;
    }

    public Optional<LyricData> load(String trackId) {
        return lookup(trackId)
            .filter(Lookup::matched)
            .map(Lookup::lyrics);
    }

    public Optional<Lookup> lookup(String trackId) {
        Optional<Lookup> current = resourceCache.read(
            ProviderResourceCache.Category.LYRICS,
            MATCH_PROVIDER,
            trackId,
            Lookup.class
        );
        if (current.isPresent()) {
            return current;
        }
        return resourceCache.read(
            ProviderResourceCache.Category.LYRICS,
            LEGACY_PROVIDER,
            trackId,
            LyricData.class
        ).map(lyrics -> new Lookup(true, lyrics));
    }

    public void save(String trackId, LyricData lyrics) {
        resourceCache.write(
            ProviderResourceCache.Category.LYRICS,
            MATCH_PROVIDER,
            trackId,
            new Lookup(true, lyrics)
        );
    }

    public void saveNotFound(String trackId) {
        resourceCache.write(
            ProviderResourceCache.Category.LYRICS,
            MATCH_PROVIDER,
            trackId,
            new Lookup(false, null)
        );
    }
}
