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
        LocalLyricsCache cache = new LocalLyricsCache(new ObjectMapper(), tempDirectory.toString());
        LyricData expected = new LyricData("[1,500](1,500,0)你", "翻译", "YRC", "netease", List.of());

        cache.save("local:test/path", expected);

        assertTrue(cache.load("local:test/path").isPresent());
        assertEquals(expected, cache.load("local:test/path").orElseThrow());
    }
}
