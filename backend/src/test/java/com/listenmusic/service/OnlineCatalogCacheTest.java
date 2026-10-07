package com.listenmusic.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.CoverData;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.MusicProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OnlineCatalogCacheTest {
    @TempDir
    Path tempDirectory;

    @Test
    void reusesProviderMetadataLyricsAndCoversByProviderAndTrackId() {
        MusicProvider provider = mock(MusicProvider.class);
        when(provider.id()).thenReturn("netease");
        Track track = new Track(
            "netease:123", "缓存歌曲", "歌手", "专辑", 180L, "netease",
            null, null, "https://img.test/cover.jpg", null, null, null,
            null, null, null, "provider"
        );
        LyricData lyrics = new LyricData("[00:00]歌词", "[00:00]翻译", "LRC", "netease", List.of());
        CoverData cover = new CoverData(new byte[]{1, 2, 3}, "image/jpeg");
        when(provider.find("netease:123")).thenReturn(Optional.of(track));
        when(provider.loadLyrics("netease:123")).thenReturn(Optional.of(lyrics));
        when(provider.loadCover("netease:123")).thenReturn(Optional.of(cover));
        ProviderResourceCache cache = new ProviderResourceCache(
            new ObjectMapper(),
            tempDirectory.resolve("cache-settings.json")
        );
        OnlineCatalogService service = new OnlineCatalogService(List.of(provider), "netease", cache);

        assertEquals("缓存歌曲", service.find("netease:123").orElseThrow().title());
        assertEquals("缓存歌曲", service.find("netease:123").orElseThrow().title());
        assertEquals("[00:00]翻译", service.loadLyrics("netease:123").orElseThrow().translation());
        assertEquals("[00:00]翻译", service.loadLyrics("netease:123").orElseThrow().translation());
        assertArrayEquals(new byte[]{1, 2, 3}, service.loadCover("netease:123").orElseThrow().bytes());
        assertArrayEquals(new byte[]{1, 2, 3}, service.loadCover("netease:123").orElseThrow().bytes());

        verify(provider, times(1)).find("netease:123");
        verify(provider, times(1)).loadLyrics("netease:123");
        verify(provider, times(1)).loadCover("netease:123");
    }
}
