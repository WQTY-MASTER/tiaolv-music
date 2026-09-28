package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.List;

@Service
public class LocalLyricsSidecarWriter {
    public enum SaveResult {
        SAVED,
        SKIPPED_EXISTING
    }

    public SaveResult saveIfAbsent(Track track, LyricData lyrics) {
        if (track.filePath() == null || track.filePath().isBlank()) {
            throw new IllegalArgumentException("本地歌曲缺少文件路径");
        }
        if (lyrics.lyrics() == null || lyrics.lyrics().isBlank()) {
            throw new IllegalArgumentException("歌词内容为空");
        }

        Path audioFile = Path.of(track.filePath()).toAbsolutePath().normalize();
        Path parent = audioFile.getParent();
        if (parent == null || !Files.isDirectory(parent)) {
            throw new IllegalArgumentException("歌曲目录不存在: " + track.filePath());
        }
        String stem = fileStem(audioFile.getFileName().toString());
        for (String extension : List.of(".qrc", ".yrc", ".lrc")) {
            if (Files.isRegularFile(parent.resolve(stem + extension))) {
                return SaveResult.SKIPPED_EXISTING;
            }
        }

        Path target = parent.resolve(stem + extensionFor(lyrics.format()));
        try {
            Files.writeString(
                target,
                lyrics.lyrics(),
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE
            );
            return SaveResult.SAVED;
        } catch (IOException ex) {
            throw new UncheckedIOException("保存歌词到歌曲目录失败: " + target, ex);
        }
    }

    private static String fileStem(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private static String extensionFor(String format) {
        if ("QRC".equalsIgnoreCase(format)) {
            return ".qrc";
        }
        if ("YRC".equalsIgnoreCase(format)) {
            return ".yrc";
        }
        return ".lrc";
    }
}
