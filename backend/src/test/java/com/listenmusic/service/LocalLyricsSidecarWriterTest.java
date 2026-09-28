package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class LocalLyricsSidecarWriterTest {
    @TempDir
    Path tempDirectory;

    @Test
    void savesLyricsBesideAudioUsingTheMatchedFormat() throws Exception {
        Path audio = Files.write(tempDirectory.resolve("心月辞.flac"), new byte[] { 1 });
        Track track = localTrack(audio);
        LyricData lyrics = new LyricData("[1,500](1,500)月", null, "QRC", "qq", List.of());
        LocalLyricsSidecarWriter writer = new LocalLyricsSidecarWriter();

        LocalLyricsSidecarWriter.SaveResult result = writer.saveIfAbsent(track, lyrics);

        assertEquals(LocalLyricsSidecarWriter.SaveResult.SAVED, result);
        assertEquals(lyrics.lyrics(), Files.readString(tempDirectory.resolve("心月辞.qrc"), StandardCharsets.UTF_8));
    }

    @Test
    void doesNotOverwriteAnyExistingSidecarLyrics() throws Exception {
        Path audio = Files.write(tempDirectory.resolve("心月辞.flac"), new byte[] { 1 });
        Path existing = tempDirectory.resolve("心月辞.lrc");
        Files.writeString(existing, "原歌词", StandardCharsets.UTF_8);
        Track track = localTrack(audio);
        LyricData lyrics = new LyricData("[1,500](1,500,0)月", null, "YRC", "netease", List.of());
        LocalLyricsSidecarWriter writer = new LocalLyricsSidecarWriter();

        LocalLyricsSidecarWriter.SaveResult result = writer.saveIfAbsent(track, lyrics);

        assertEquals(LocalLyricsSidecarWriter.SaveResult.SKIPPED_EXISTING, result);
        assertEquals("原歌词", Files.readString(existing, StandardCharsets.UTF_8));
        assertFalse(Files.exists(tempDirectory.resolve("心月辞.yrc")));
    }

    private static Track localTrack(Path audio) {
        return new Track(
            "local-1", "心月辞", "鸣潮先约电台", "本地音乐", 180L,
            "local", audio.toString(), "/audio", null, null, null, null,
            null, null, null
        );
    }
}
