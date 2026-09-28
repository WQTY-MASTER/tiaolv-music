package com.listenmusic.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.CleanupMode;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MusicScanServiceTest {
    @TempDir(cleanup = CleanupMode.NEVER)
    Path tempDirectory;

    @Test
    void embeddedLyricsAndCoverTakePriorityOverSidecarFiles() throws Exception {
        Path audio = tempDirectory.resolve("优先级测试.flac");
        byte[] embeddedCover = new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xd9};
        String embeddedLyrics = "[00:01.00]内嵌歌词";
        Files.write(audio, flacFixture("内嵌歌曲", "内嵌歌手", "内嵌专辑", embeddedLyrics, embeddedCover));
        Files.writeString(tempDirectory.resolve("优先级测试.jpg"), "sidecar-cover", StandardCharsets.UTF_8);
        Files.writeString(tempDirectory.resolve("优先级测试.lrc"), "[00:01.00]旁边歌词", StandardCharsets.UTF_8);

        ScannedTrack track = new MusicScanService().scan(tempDirectory).get(0);

        assertEquals("内嵌歌曲", track.title());
        assertEquals("内嵌歌手", track.artist());
        assertEquals("内嵌专辑", track.album());
        assertEquals("embedded", track.metaSource());
        assertTrue(track.hasLyrics());
        assertTrue(track.hasCover());
        assertEquals(embeddedLyrics, track.embeddedLyrics());
        assertArrayEquals(embeddedCover, track.embeddedCover());
        assertEquals(embeddedLyrics, track.effectiveLyrics());
        assertArrayEquals(embeddedCover, track.effectiveCover());
    }

    @Test
    void filenameMetadataOnlyRepairsInvalidEmbeddedFields() throws Exception {
        Path audio = tempDirectory.resolve("01 - 正确歌手 - 正确歌名 - Live.flac");
        Files.write(audio, flacFixture("�", "未知歌手", "内嵌专辑", "", new byte[0]));

        ScannedTrack track = new MusicScanService().scanFiles(List.of(audio), true).get(0);

        assertEquals("正确歌名 - Live", track.title());
        assertEquals("正确歌手", track.artist());
        assertEquals("内嵌专辑", track.album());
        assertEquals("filename", track.metaSource());
    }

    @Test
    void filenameMetadataNeverOverridesValidEmbeddedFields() throws Exception {
        Path audio = tempDirectory.resolve("文件名歌手 - 文件名歌名.flac");
        Files.write(audio, flacFixture("内嵌歌名", "内嵌歌手", "内嵌专辑", "", new byte[0]));

        ScannedTrack track = new MusicScanService().scanFiles(List.of(audio), true).get(0);

        assertEquals("内嵌歌名", track.title());
        assertEquals("内嵌歌手", track.artist());
        assertEquals("embedded", track.metaSource());
    }

    @Test
    void filenameMetadataCanBeDisabled() throws Exception {
        Path audio = tempDirectory.resolve("歌手 - 歌名.flac");
        Files.write(audio, flacFixture("", "", "", "", new byte[0]));

        ScannedTrack track = new MusicScanService().scanFiles(List.of(audio), false).get(0);

        assertEquals("歌手 - 歌名", track.title());
        assertEquals("未知歌手", track.artist());
        assertEquals(null, track.metaSource());
    }

    @Test
    void sidecarLyricsAndCoverAreUsedWhenAudioHasNoEmbeddedAssets() throws Exception {
        Path audio = tempDirectory.resolve("旁边文件测试.flac");
        Files.write(audio, flacFixture("旁边文件歌曲", "测试歌手", "测试专辑", "", new byte[0]));
        byte[] sidecarCover = new byte[] {1, 2, 3};
        Files.write(tempDirectory.resolve("旁边文件测试.png"), sidecarCover);
        Files.writeString(tempDirectory.resolve("旁边文件测试.lrc"), "[00:02.00]旁边歌词", StandardCharsets.UTF_8);

        ScannedTrack track = new MusicScanService().scan(tempDirectory).get(0);

        assertTrue(track.hasLyrics());
        assertTrue(track.hasCover());
        assertEquals("[00:02.00]旁边歌词", track.sidecarLyrics());
        assertEquals("LRC", track.lyricsFormat());
        assertArrayEquals(sidecarCover, track.effectiveCover());
    }

    @Test
    void preciseSidecarLyricsTakePriorityOverPlainLrc() throws Exception {
        Path audio = tempDirectory.resolve("逐字歌词测试.flac");
        Files.write(audio, flacFixture("逐字歌词", "测试歌手", "测试专辑", "", new byte[0]));
        Files.writeString(
            tempDirectory.resolve("逐字歌词测试.qrc"),
            "[1000,1200]你(1000,500)好(1500,700)",
            StandardCharsets.UTF_8
        );
        Files.writeString(
            tempDirectory.resolve("逐字歌词测试.yrc"),
            "[1000,1200](1000,500,0)你(1500,700,0)好",
            StandardCharsets.UTF_8
        );
        Files.writeString(
            tempDirectory.resolve("逐字歌词测试.lrc"),
            "[00:01.00]你好",
            StandardCharsets.UTF_8
        );

        ScannedTrack track = new MusicScanService().scan(tempDirectory).get(0);

        assertEquals("[1000,1200]你(1000,500)好(1500,700)", track.sidecarLyrics());
        assertEquals("QRC", track.lyricsFormat());
    }

    @Test
    void embeddedLyricsFormatIsDetectedFromContent() throws Exception {
        Path audio = tempDirectory.resolve("内嵌逐字.flac");
        String yrc = "[1000,1200](1000,500,0)你(1500,700,0)好";
        Files.write(audio, flacFixture("内嵌逐字", "测试歌手", "测试专辑", yrc, new byte[0]));

        ScannedTrack track = new MusicScanService().scan(tempDirectory).get(0);

        assertEquals(yrc, track.effectiveLyrics());
        assertEquals("YRC", track.lyricsFormat());
    }

    @Test
    void unsupportedFilesAreIgnored() throws Exception {
        Files.writeString(tempDirectory.resolve("说明.txt"), "ignore", StandardCharsets.UTF_8);
        Files.write(tempDirectory.resolve("支持.flac"), flacFixture("支持", "歌手", "专辑", "", new byte[0]));

        List<ScannedTrack> tracks = new MusicScanService().scan(tempDirectory);

        assertEquals(1, tracks.size());
        assertFalse(tracks.get(0).title().isBlank());
    }

    private static byte[] flacFixture(
        String title,
        String artist,
        String album,
        String lyrics,
        byte[] picture
    ) throws Exception {
        ByteArrayOutputStream file = new ByteArrayOutputStream();
        file.write("fLaC".getBytes(StandardCharsets.US_ASCII));
        file.write(metadataBlock(0, false, streamInfo()));

        ByteArrayOutputStream comments = new ByteArrayOutputStream();
        writeLittleEndianInt(comments, "test".length());
        comments.write("test".getBytes(StandardCharsets.UTF_8));
        List<String> values = lyrics.isBlank()
            ? List.of("TITLE=" + title, "ARTIST=" + artist, "ALBUM=" + album)
            : List.of("TITLE=" + title, "ARTIST=" + artist, "ALBUM=" + album, "LYRICS=" + lyrics);
        writeLittleEndianInt(comments, values.size());
        for (String value : values) {
            byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
            writeLittleEndianInt(comments, bytes.length);
            comments.write(bytes);
        }
        file.write(metadataBlock(4, false, comments.toByteArray()));

        if (picture.length > 0) {
            ByteArrayOutputStream pictureBlock = new ByteArrayOutputStream();
            writeBigEndianInt(pictureBlock, 3);
            writeBigEndianInt(pictureBlock, "image/jpeg".length());
            pictureBlock.write("image/jpeg".getBytes(StandardCharsets.US_ASCII));
            writeBigEndianInt(pictureBlock, 0);
            writeBigEndianInt(pictureBlock, 10);
            writeBigEndianInt(pictureBlock, 10);
            writeBigEndianInt(pictureBlock, 24);
            writeBigEndianInt(pictureBlock, 0);
            writeBigEndianInt(pictureBlock, picture.length);
            pictureBlock.write(picture);
            file.write(metadataBlock(6, false, pictureBlock.toByteArray()));
        }

        file.write(metadataBlock(1, true, new byte[0]));
        return file.toByteArray();
    }

    private static byte[] streamInfo() {
        byte[] streamInfo = new byte[34];
        long sampleRate = 48_000L;
        long channelsMinusOne = 1L;
        long bitsMinusOne = 23L;
        long totalSamples = 48_000L * 180L;
        long packed = (sampleRate << 44)
            | (channelsMinusOne << 41)
            | (bitsMinusOne << 36)
            | totalSamples;
        for (int i = 0; i < 8; i++) {
            streamInfo[10 + i] = (byte) (packed >>> (56 - i * 8));
        }
        return streamInfo;
    }

    private static byte[] metadataBlock(int type, boolean last, byte[] data) {
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        result.write(last ? type | 0x80 : type);
        result.write((data.length >>> 16) & 0xff);
        result.write((data.length >>> 8) & 0xff);
        result.write(data.length & 0xff);
        result.writeBytes(data);
        return result.toByteArray();
    }

    private static void writeLittleEndianInt(ByteArrayOutputStream output, int value) {
        output.write(value & 0xff);
        output.write((value >>> 8) & 0xff);
        output.write((value >>> 16) & 0xff);
        output.write((value >>> 24) & 0xff);
    }

    private static void writeBigEndianInt(ByteArrayOutputStream output, int value) throws Exception {
        new DataOutputStream(output).writeInt(value);
    }
}
