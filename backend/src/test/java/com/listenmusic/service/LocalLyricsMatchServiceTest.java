package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import com.listenmusic.repository.AccountRepository;
import com.listenmusic.repository.TrackRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalLyricsMatchServiceTest {
    @Test
    void prefersNeteaseYrcAndPersistsItForTheLocalTrack() {
        TrackRepository tracks = mock(TrackRepository.class);
        OnlineCatalogService catalog = mock(OnlineCatalogService.class);
        LocalLyricsCache cache = mock(LocalLyricsCache.class);
        LocalLyricsSidecarWriter sidecarWriter = mock(LocalLyricsSidecarWriter.class);
        Track local = localTrack(null, null, null);
        Track match = onlineTrack("netease:123", "心月辞", "鸣潮先约电台、苏诗丁");
        LyricData lyrics = new LyricData(
            "[1000,500](1000,500,0)月", null, "YRC", "netease", List.of()
        );
        when(tracks.findById("local-1")).thenReturn(Optional.of(local));
        when(catalog.search("心月辞 鸣潮先约电台", "netease", SearchType.SONG, 10, 0))
            .thenReturn(new SearchResultPage(List.of(match), List.of(), List.of(), 1, false));
        when(catalog.loadLyrics("netease:123")).thenReturn(Optional.of(lyrics));
        when(sidecarWriter.saveIfAbsent(local, lyrics))
            .thenReturn(LocalLyricsSidecarWriter.SaveResult.SAVED);
        LocalLyricsMatchService service = new LocalLyricsMatchService(
            tracks, catalog, mock(AccountRepository.class), cache, sidecarWriter
        );

        LocalLyricsMatchResult result = service.match("local-1", true);

        assertTrue(result.matched());
        assertEquals("YRC", result.track().lyricsFormat());
        assertEquals("online-netease", result.track().lyricsSource());
        assertTrue(result.message().contains("已保存到歌曲同目录"));
        verify(cache).save("local-1", lyrics);
        verify(sidecarWriter).saveIfAbsent(local, lyrics);
        ArgumentCaptor<Track> saved = ArgumentCaptor.forClass(Track.class);
        verify(tracks).upsert(saved.capture());
        assertEquals(lyrics.lyrics(), saved.getValue().lyrics());
    }

    @Test
    void doesNotReplaceLyricsFoundBesideTheLocalAudioFile() {
        TrackRepository tracks = mock(TrackRepository.class);
        OnlineCatalogService catalog = mock(OnlineCatalogService.class);
        Track local = localTrack("[00:01.00]本地歌词", "sidecar", "LRC");
        when(tracks.findById("local-1")).thenReturn(Optional.of(local));
        LocalLyricsMatchService service = new LocalLyricsMatchService(
            tracks, catalog, mock(AccountRepository.class), mock(LocalLyricsCache.class),
            mock(LocalLyricsSidecarWriter.class)
        );

        LocalLyricsMatchResult result = service.match("local-1");

        assertTrue(result.matched());
        assertEquals("sidecar", result.track().lyricsSource());
        verify(catalog, never()).search(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt()
        );
    }

    @Test
    void rejectsAPartialTitleMatchWhenTheCandidateHasNoArtist() {
        TrackRepository tracks = mock(TrackRepository.class);
        OnlineCatalogService catalog = mock(OnlineCatalogService.class);
        Track local = localTrack(null, null, null);
        Track weakMatch = onlineTrack("netease:456", "心月辞翻唱", "");
        when(tracks.findById("local-1")).thenReturn(Optional.of(local));
        when(catalog.search("心月辞 鸣潮先约电台", "netease", SearchType.SONG, 10, 0))
            .thenReturn(new SearchResultPage(List.of(weakMatch), List.of(), List.of(), 1, false));
        when(catalog.loadLyrics("netease:456")).thenReturn(Optional.of(new LyricData(
            "[1000,500](1000,500,0)月", null, "YRC", "netease", List.of()
        )));
        LocalLyricsMatchService service = new LocalLyricsMatchService(
            tracks, catalog, mock(AccountRepository.class), mock(LocalLyricsCache.class),
            mock(LocalLyricsSidecarWriter.class)
        );

        LocalLyricsMatchResult result = service.match("local-1");

        org.junit.jupiter.api.Assertions.assertFalse(result.matched());
        verify(tracks, never()).upsert(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void keepsTheCacheAndMatchWhenTheSongDirectoryCannotBeWritten() {
        TrackRepository tracks = mock(TrackRepository.class);
        OnlineCatalogService catalog = mock(OnlineCatalogService.class);
        LocalLyricsCache cache = mock(LocalLyricsCache.class);
        LocalLyricsSidecarWriter sidecarWriter = mock(LocalLyricsSidecarWriter.class);
        Track local = localTrack(null, null, null);
        Track match = onlineTrack("netease:123", "心月辞", "鸣潮先约电台、苏诗丁");
        LyricData lyrics = new LyricData(
            "[1000,500](1000,500,0)月", null, "YRC", "netease", List.of()
        );
        when(tracks.findById("local-1")).thenReturn(Optional.of(local));
        when(catalog.search("心月辞 鸣潮先约电台", "netease", SearchType.SONG, 10, 0))
            .thenReturn(new SearchResultPage(List.of(match), List.of(), List.of(), 1, false));
        when(catalog.loadLyrics("netease:123")).thenReturn(Optional.of(lyrics));
        when(sidecarWriter.saveIfAbsent(local, lyrics))
            .thenThrow(new UncheckedIOException(new IOException("只读目录")));
        LocalLyricsMatchService service = new LocalLyricsMatchService(
            tracks, catalog, mock(AccountRepository.class), cache, sidecarWriter
        );

        LocalLyricsMatchResult result = service.match("local-1", true);

        assertTrue(result.matched());
        assertTrue(result.message().contains("无法写入歌曲目录，已保存到软件缓存"));
        verify(cache).save("local-1", lyrics);
        verify(tracks).upsert(org.mockito.ArgumentMatchers.any());
    }

    private static Track localTrack(String lyrics, String lyricsSource, String format) {
        return new Track(
            "local-1", "心月辞 (Live)", "鸣潮先约电台 feat. 苏诗丁", "本地音乐", 180L,
            "local", "G:/music/心月辞.flac", "/audio", null, lyrics, lyricsSource, format,
            null, null, null
        );
    }

    private static Track onlineTrack(String id, String title, String artist) {
        return new Track(
            id, title, artist, "心月辞", 180L, "netease", null, null,
            null, null, null, null, null, null, null
        );
    }
}
