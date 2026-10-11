package com.listenmusic.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.provider.LyricData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalLyricsCacheTest {
    @TempDir
    Path tempDirectory;

    @Test
    void writesAndReadsMatchedLyrics() {
        ProviderResourceCache resourceCache = new ProviderResourceCache(
            new ObjectMapper(),
            tempDirectory.resolve("cache-settings.json")
        );
        LocalLyricsCache cache = new LocalLyricsCache(resourceCache);
        LyricData expected = new LyricData("[1,500](1,500,0)你", "翻译", "YRC", "netease", List.of());

        cache.save("local:test/path", expected);

        assertTrue(cache.load("local:test/path").isPresent());
        assertEquals(expected, cache.load("local:test/path").orElseThrow());
        assertTrue(cache.lookup("local:test/path").orElseThrow().matched());
    }

    @Test
    void persistsANotFoundMarker() {
        ProviderResourceCache resourceCache = new ProviderResourceCache(
            new ObjectMapper(),
            tempDirectory.resolve("cache-settings.json")
        );
        LocalLyricsCache cache = new LocalLyricsCache(resourceCache);

        cache.saveNotFound("local:missing/path");

        LocalLyricsCache.Lookup lookup = cache.lookup("local:missing/path").orElseThrow();
        assertTrue(!lookup.matched());
        assertTrue(cache.load("local:missing/path").isEmpty());
    }

    @Test
    void managedCacheClearRemovesMatchesAndNotFoundMarkers() {
        ProviderResourceCache resourceCache = new ProviderResourceCache(
            new ObjectMapper(),
            tempDirectory.resolve("cache-settings.json")
        );
        LocalLyricsCache cache = new LocalLyricsCache(resourceCache);
        cache.save("local:matched", new LyricData("[00:01.00]歌词", null, "LRC", "qq", List.of()));
        cache.saveNotFound("local:missing");

        resourceCache.clear();

        assertTrue(cache.lookup("local:matched").isEmpty());
        assertTrue(cache.lookup("local:missing").isEmpty());
    }
}
