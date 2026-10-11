package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.SearchType;
import com.listenmusic.repository.AccountRepository;
import com.listenmusic.repository.TrackRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Optional;

@Service
public class LocalLyricsMatchService {
    private final TrackRepository trackRepository;
    private final OnlineCatalogService catalogService;
    private final AccountRepository accountRepository;
    private final LocalLyricsCache cache;
    private final LocalLyricsSidecarWriter sidecarWriter;

    public LocalLyricsMatchService(
        TrackRepository trackRepository,
        OnlineCatalogService catalogService,
        AccountRepository accountRepository,
        LocalLyricsCache cache,
        LocalLyricsSidecarWriter sidecarWriter
    ) {
        this.trackRepository = trackRepository;
        this.catalogService = catalogService;
        this.accountRepository = accountRepository;
        this.cache = cache;
        this.sidecarWriter = sidecarWriter;
    }

    public LocalLyricsMatchResult match(String trackId) {
        return match(trackId, false, false);
    }

    public LocalLyricsMatchResult match(String trackId, boolean saveBesideAudio) {
        return match(trackId, saveBesideAudio, false);
    }

    public LocalLyricsMatchResult match(String trackId, boolean saveBesideAudio, boolean force) {
        Track track = trackRepository.findById(trackId)
            .orElseThrow(() -> new NoSuchElementException("歌曲不存在: " + trackId));
        if (!"local".equalsIgnoreCase(track.source())) {
            throw new IllegalArgumentException("联网匹配歌词仅支持本地歌曲");
        }
        boolean localLyricsAvailable = hasLocalLyrics(track);
        if (!force) {
            Optional<LocalLyricsCache.Lookup> cached = cache.lookup(trackId);
            if (cached.isPresent()) {
                return fromCache(track, localLyricsAvailable, cached.get());
            }
        }
        if (localLyricsAvailable && accountRepository.findActive("qq").isEmpty()) {
            return new LocalLyricsMatchResult(true, track, localLyricsMessage(track.lyricsFormat()));
        }

        String title = cleanTitle(track.title());
        String artist = cleanArtist(track.artist());
        String query = (title + " " + artist).trim();
        // Only QQ word timing can supersede lyrics carried by the local file.
        for (String provider : localLyricsAvailable ? List.of("qq") : List.of("qq", "netease")) {
            try {
                Optional<Track> candidate = bestMatch(
                    catalogService.search(query, provider, SearchType.SONG, 10, 0).songs(),
                    title,
                    artist
                );
                if (candidate.isEmpty()) {
                    continue;
                }
                Optional<LyricData> lyrics = force
                    ? catalogService.loadLyricsFresh(candidate.get().id())
                    : catalogService.loadLyrics(candidate.get().id());
                if (lyrics.isEmpty() || lyrics.get().lyrics() == null || lyrics.get().lyrics().isBlank()) {
                    continue;
                }
                Candidate loaded = new Candidate(provider, lyrics.get());
                if (!localLyricsAvailable || hasWordTiming(lyrics.get())) {
                    return persist(track, loaded, saveBesideAudio);
                }
            } catch (RuntimeException ignored) {
                // A failed provider must not interrupt local playback or the next provider fallback.
            }
        }
        if (localLyricsAvailable) {
            cache.saveNotFound(track.id());
            return new LocalLyricsMatchResult(true, track, localLyricsMessage(track.lyricsFormat()));
        }
        cache.saveNotFound(track.id());
        return new LocalLyricsMatchResult(false, track, "联网匹配歌词失败，使用本地文件");
    }

    private static boolean hasWordTiming(LyricData lyrics) {
        return isPrecise(lyrics.format())
            && java.util.regex.Pattern.compile("\\(\\d+,\\d+(?:,\\d+)?\\)").matcher(lyrics.lyrics()).find();
    }

    private LocalLyricsMatchResult persist(Track original, Candidate candidate, boolean saveBesideAudio) {
        LyricData lyrics = candidate.lyrics();
        cache.save(original.id(), lyrics);
        String storageMessage = "";
        if (saveBesideAudio) {
            try {
                LocalLyricsSidecarWriter.SaveResult saveResult = sidecarWriter.saveIfAbsent(original, lyrics);
                storageMessage = saveResult == LocalLyricsSidecarWriter.SaveResult.SAVED
                    ? "，已保存到歌曲同目录"
                    : "，歌曲同目录已有歌词，未覆盖";
            } catch (RuntimeException ignored) {
                storageMessage = "；无法写入歌曲目录，已保存到软件缓存";
            }
        }
        Track updated = withOnlineLyrics(original, candidate.provider(), lyrics);
        if (!hasLocalLyrics(original)) {
            trackRepository.upsert(updated);
        }
        String message = isPrecise(lyrics.format())
            ? "联网匹配到逐字歌词（来自" + providerLabel(candidate.provider()) + "）"
            : "未找到逐字歌词，加载普通整行歌词";
        return new LocalLyricsMatchResult(true, updated, message + storageMessage, lyrics);
    }

    private LocalLyricsMatchResult fromCache(
        Track original,
        boolean localLyricsAvailable,
        LocalLyricsCache.Lookup cached
    ) {
        LyricData lyrics = cached.lyrics();
        if (!cached.matched() || lyrics == null || lyrics.lyrics() == null || lyrics.lyrics().isBlank()) {
            return localLyricsAvailable
                ? new LocalLyricsMatchResult(true, original, localLyricsMessage(original.lyricsFormat()))
                : new LocalLyricsMatchResult(false, original, "缓存中未找到匹配歌词");
        }
        boolean cachedQqWordLyrics = "qq".equalsIgnoreCase(lyrics.source()) && hasWordTiming(lyrics);
        if (localLyricsAvailable && !cachedQqWordLyrics) {
            return new LocalLyricsMatchResult(true, original, localLyricsMessage(original.lyricsFormat()));
        }
        Track updated = withOnlineLyrics(original, lyrics.source(), lyrics);
        String message = isPrecise(lyrics.format())
            ? "已从缓存加载逐字歌词（来自" + providerLabel(lyrics.source()) + "）"
            : "已从缓存加载普通整行歌词";
        return new LocalLyricsMatchResult(true, updated, message, lyrics);
    }

    private static Track withOnlineLyrics(Track original, String provider, LyricData lyrics) {
        return new Track(
            original.id(), original.title(), original.artist(), original.album(), original.duration(),
            original.source(), original.filePath(), original.url(), original.coverUrl(),
            lyrics.lyrics(), "online-" + provider, lyrics.format(), original.coverMimeType(),
            original.createdAt(), original.updatedAt(), original.metaSource()
        );
    }

    private static Optional<Track> bestMatch(List<Track> tracks, String title, String artist) {
        return tracks.stream()
            .max(Comparator.comparingInt(track -> matchScore(track, title, artist)))
            .filter(track -> matchScore(track, title, artist) >= 4);
    }

    private static int matchScore(Track track, String expectedTitle, String expectedArtist) {
        String title = normalize(track.title());
        String artist = normalize(track.artist());
        String normalizedExpectedTitle = normalize(expectedTitle);
        String normalizedExpectedArtist = normalize(expectedArtist);
        int score = title.equals(normalizedExpectedTitle) ? 6 : title.contains(normalizedExpectedTitle) ? 3 : 0;
        if (!normalizedExpectedArtist.isBlank()
            && !artist.isBlank()
            && (artist.contains(normalizedExpectedArtist) || normalizedExpectedArtist.contains(artist))) {
            score += 3;
        }
        return score;
    }

    private static boolean hasLocalLyrics(Track track) {
        return track.lyrics() != null
            && !track.lyrics().isBlank()
            && ("embedded".equals(track.lyricsSource()) || "sidecar".equals(track.lyricsSource()));
    }

    private static boolean isPrecise(String format) {
        return "YRC".equalsIgnoreCase(format) || "QRC".equalsIgnoreCase(format);
    }

    private static String cleanTitle(String value) {
        return value == null ? "" : value
            .replaceAll("[（(\\[].*?[）)\\]]", " ")
            .replaceAll("(?i)\\s+(feat\\.?|ft\\.?)\\s+.*$", " ")
            .trim();
    }

    private static String cleanArtist(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("(?i)\\s+(feat\\.?|ft\\.?)\\s+.*$", " ").trim();
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return cleanTitle(value).toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private static String localLyricsMessage(String format) {
        return isPrecise(format) ? "已加载本地逐字歌词" : "已加载本地歌词";
    }

    private static String providerLabel(String provider) {
        return "qq".equalsIgnoreCase(provider) ? "QQ音乐" : "网易云";
    }

    private record Candidate(String provider, LyricData lyrics) {
    }
}
