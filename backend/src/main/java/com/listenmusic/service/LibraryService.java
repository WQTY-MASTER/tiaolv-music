package com.listenmusic.service;

import com.listenmusic.domain.Playlist;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.repository.LocalLibraryRepository;
import com.listenmusic.repository.PlaylistRepository;
import com.listenmusic.repository.TrackRepository;
import com.listenmusic.repository.UserDataRepository;
import org.springframework.stereotype.Service;

import java.awt.GraphicsEnvironment;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.UIManager;

@Service
public class LibraryService {
    private final TrackRepository trackRepository;
    private final PlaylistRepository playlistRepository;
    private final MusicScanService musicScanService;
    private final UserDataRepository userDataRepository;
    private final LocalLyricsCache localLyricsCache;
    private final LocalLibraryRepository localLibraryRepository;
    private static final String LOCAL_PROFILE_ID = "local";

    public LibraryService(
        TrackRepository trackRepository,
        PlaylistRepository playlistRepository,
        MusicScanService musicScanService,
        UserDataRepository userDataRepository,
        LocalLyricsCache localLyricsCache,
        LocalLibraryRepository localLibraryRepository
    ) {
        this.trackRepository = trackRepository;
        this.playlistRepository = playlistRepository;
        this.musicScanService = musicScanService;
        this.userDataRepository = userDataRepository;
        this.localLyricsCache = localLyricsCache;
        this.localLibraryRepository = localLibraryRepository;
    }

    public List<Track> listTracks() {
        return trackRepository.findAll();
    }

    public List<Playlist> listPlaylists() {
        return playlistRepository.findAll();
    }

    public List<Track> listFavorites() {
        return userDataRepository.findFavorites(LOCAL_PROFILE_ID);
    }

    public void saveFavorite(Track track) {
        userDataRepository.saveFavorite(LOCAL_PROFILE_ID, track);
    }

    public void removeFavorite(String trackId) {
        userDataRepository.removeFavorite(LOCAL_PROFILE_ID, trackId);
    }

    public List<Track> listHistory() {
        return userDataRepository.findHistory(LOCAL_PROFILE_ID);
    }

    public void recordHistory(Track track) {
        userDataRepository.recordHistory(LOCAL_PROFILE_ID, track);
    }

    public List<Track> scanDirectory(String directory) {
        return scanDirectory(directory, true);
    }

    public List<Track> scanDirectory(String directory, boolean useFilenameMetadata) {
        Path path = Path.of(directory).toAbsolutePath().normalize();
        localLibraryRepository.addRoot(path);
        Set<String> ignoredPathKeys = localLibraryRepository.findIgnoredPathKeys();
        List<Track> existingTracks = trackRepository.findLocalTracks();
        Map<String, Track> existingByPath = existingTracks.stream()
            .filter(track -> track.filePath() != null && !track.filePath().isBlank())
            .collect(Collectors.toMap(
                track -> LocalPathKey.of(track.filePath()),
                Function.identity(),
                (first, ignored) -> first,
                LinkedHashMap::new
            ));
        List<Track> tracks = musicScanService.scan(path, useFilenameMetadata).stream()
            .filter(scanned -> !ignoredPathKeys.contains(LocalPathKey.of(scanned.filePath())))
            .map(scanned -> {
                Track existing = existingByPath.get(LocalPathKey.of(scanned.filePath()));
                return toTrack(scanned, existing == null ? scanned.id() : existing.id());
            })
            .toList();
        Set<String> scannedPathKeys = tracks.stream()
            .map(Track::filePath)
            .filter(filePath -> filePath != null && !filePath.isBlank())
            .map(LocalPathKey::of)
            .collect(Collectors.toSet());
        List<String> removedIds = existingTracks.stream()
            .filter(track -> belongsToDirectory(track, path))
            .filter(track -> track.filePath() == null
                || track.filePath().isBlank()
                || !scannedPathKeys.contains(LocalPathKey.of(track.filePath())))
            .map(Track::id)
            .toList();
        trackRepository.removeLocalTracksByIds(removedIds);
        tracks.forEach(trackRepository::upsert);
        return mergeTracks(
            existingTracks.stream().filter(track -> !belongsToDirectory(track, path)).toList(),
            tracks
        );
    }

    public LibraryScanResult incrementalScanDirectory(String directory) {
        return incrementalScanDirectory(directory, true);
    }

    public LibraryScanResult incrementalScanDirectory(String directory, boolean useFilenameMetadata) {
        Path path = Path.of(directory).toAbsolutePath().normalize();
        localLibraryRepository.addRoot(path);
        Set<String> ignoredPathKeys = localLibraryRepository.findIgnoredPathKeys();
        List<Path> currentFiles = musicScanService.findAudioFiles(path).stream()
            .filter(file -> !ignoredPathKeys.contains(LocalPathKey.of(file)))
            .toList();
        List<Track> existingTracks = trackRepository.findLocalTracks();
        List<Track> existingTracksInRoot = existingTracks.stream()
            .filter(track -> belongsToDirectory(track, path))
            .toList();
        Map<String, Track> existingByPath = existingTracksInRoot.stream()
            .filter(track -> track.filePath() != null && !track.filePath().isBlank())
            .collect(Collectors.toMap(
                track -> LocalPathKey.of(track.filePath()),
                Function.identity(),
                (first, ignored) -> first,
                LinkedHashMap::new
            ));

        List<Path> newFiles = currentFiles.stream()
            .filter(file -> !existingByPath.containsKey(LocalPathKey.of(file)))
            .toList();
        List<Track> addedTracks = musicScanService.scanFiles(newFiles, useFilenameMetadata).stream()
            .map(this::toTrack)
            .toList();
        Map<String, Track> addedByPath = addedTracks.stream()
            .collect(Collectors.toMap(
                track -> LocalPathKey.of(track.filePath()),
                Function.identity(),
                (first, ignored) -> first,
                LinkedHashMap::new
            ));

        List<Track> currentTracks = currentFiles.stream()
            .map(file -> {
                String key = LocalPathKey.of(file);
                Track existing = existingByPath.get(key);
                return existing != null ? existing : addedByPath.get(key);
            })
            .filter(track -> track != null)
            .toList();
        Set<String> currentPathKeys = currentFiles.stream()
            .map(LocalPathKey::of)
            .collect(Collectors.toSet());
        List<String> removedIds = existingTracksInRoot.stream()
            .filter(track -> track.filePath() == null
                || track.filePath().isBlank()
                || !currentPathKeys.contains(LocalPathKey.of(track.filePath())))
            .map(Track::id)
            .toList();

        trackRepository.removeLocalTracksByIds(removedIds);
        addedTracks.forEach(trackRepository::upsert);
        List<Track> allTracks = mergeTracks(
            existingTracks.stream().filter(track -> !belongsToDirectory(track, path)).toList(),
            currentTracks
        );
        return new LibraryScanResult(
            allTracks,
            allTracks.size(),
            addedTracks.size(),
            removedIds.size()
        );
    }

    public LibraryScanResult incrementalScanAllDirectories(boolean useFilenameMetadata) {
        int added = 0;
        int removed = 0;
        List<Track> tracks = trackRepository.findLocalTracks();
        for (String directory : localLibraryRepository.findRoots()) {
            Path path = Path.of(directory).toAbsolutePath().normalize();
            if (!Files.isDirectory(path)) {
                continue;
            }
            LibraryScanResult result = incrementalScanDirectory(directory, useFilenameMetadata);
            tracks = result.tracks();
            added += result.added();
            removed += result.removed();
        }
        return new LibraryScanResult(tracks, tracks.size(), added, removed);
    }

    public List<String> listLibraryRoots() {
        return localLibraryRepository.findRoots();
    }

    public List<String> listIgnoredLocalFiles() {
        return localLibraryRepository.findIgnoredPaths();
    }

    public List<Track> ignoreLocalTracks(List<String> trackIds) {
        if (trackIds == null || trackIds.isEmpty()) {
            return trackRepository.findLocalTracks();
        }
        List<Track> ignoredTracks = trackIds.stream()
            .map(trackRepository::findById)
            .flatMap(Optional::stream)
            .filter(track -> "local".equals(track.source()))
            .filter(track -> track.filePath() != null && !track.filePath().isBlank())
            .toList();
        localLibraryRepository.ignorePaths(ignoredTracks.stream().map(Track::filePath).toList());
        trackRepository.removeLocalTracksByIds(ignoredTracks.stream().map(Track::id).toList());
        return trackRepository.findLocalTracks();
    }

    public int restoreIgnoredLocalFiles() {
        int count = localLibraryRepository.findIgnoredPaths().size();
        localLibraryRepository.clearIgnoredPaths();
        return count;
    }

    public LibraryMetadataReparseResult reparseAllMetadata(
        String directory,
        boolean useFilenameMetadata
    ) {
        List<Track> tracks = scanDirectory(directory, useFilenameMetadata);
        int filenameResolved = (int) tracks.stream()
            .filter(track -> "filename".equals(track.metaSource()))
            .count();
        return new LibraryMetadataReparseResult(tracks, tracks.size(), filenameResolved);
    }

    private Track toTrack(ScannedTrack scanned) {
        return toTrack(scanned, scanned.id());
    }

    private Track toTrack(ScannedTrack scanned, String trackId) {
        String lyrics = scanned.effectiveLyrics();
        String lyricsSource = scanned.embeddedLyrics() != null && !scanned.embeddedLyrics().isBlank()
            ? "embedded"
            : lyrics == null || lyrics.isBlank() ? null : "sidecar";
        String lyricsFormat = scanned.lyricsFormat();
        if (lyrics == null || lyrics.isBlank()) {
            Optional<LyricData> cached = localLyricsCache.load(trackId);
            if (cached.isPresent()) {
                lyrics = cached.get().lyrics();
                lyricsFormat = cached.get().format();
                lyricsSource = "cache-" + cached.get().source();
            }
        }
        return new Track(
            trackId,
            scanned.title(),
            scanned.artist(),
            scanned.album(),
            scanned.durationSeconds(),
            "local",
            scanned.filePath().toString(),
            "/library/tracks/" + trackId + "/audio",
            scanned.hasCover() ? "/library/tracks/" + trackId + "/cover" : null,
            lyrics,
            lyricsSource,
            lyricsFormat,
            scanned.effectiveCoverMimeType(),
            null,
            OffsetDateTime.now().toString(),
            scanned.metaSource()
        );
    }

    private static boolean belongsToDirectory(Track track, Path directory) {
        if (track.filePath() == null || track.filePath().isBlank()) {
            return false;
        }
        return Path.of(track.filePath()).toAbsolutePath().normalize().startsWith(directory);
    }

    private static List<Track> mergeTracks(List<Track> retained, List<Track> scanned) {
        Map<String, Track> merged = new LinkedHashMap<>();
        retained.forEach(track -> merged.put(track.id(), track));
        scanned.forEach(track -> merged.put(track.id(), track));
        return List.copyOf(merged.values());
    }

    public void resetLocalLibrary() {
        trackRepository.clearLocalTracks();
        localLibraryRepository.clearRoots();
        localLibraryRepository.clearIgnoredPaths();
        userDataRepository.replaceQueue(LOCAL_PROFILE_ID, List.of());
        Map<String, Object> resetState = new LinkedHashMap<>();
        resetState.put("trackId", null);
        resetState.put("positionSeconds", 0.0);
        resetState.put("volume", 72);
        resetState.put("playMode", "sequence");
        userDataRepository.savePlaybackState(LOCAL_PROFILE_ID, resetState);
    }

    public Optional<String> selectMusicDirectory() {
        if (GraphicsEnvironment.isHeadless()) {
            return Optional.empty();
        }
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // Keep the picker usable even if the platform look and feel is unavailable.
        }
        JFileChooser chooser = new JFileChooser();
        chooser.setDialogTitle("选择本地音乐库文件夹");
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        chooser.setAcceptAllFileFilterUsed(false);
        JFrame owner = new JFrame();
        try {
            owner.setUndecorated(true);
            owner.setAlwaysOnTop(true);
            owner.setType(java.awt.Window.Type.UTILITY);
            owner.setLocationRelativeTo(null);
            owner.setVisible(true);
            owner.toFront();
            int result = chooser.showOpenDialog(owner);
            if (result != JFileChooser.APPROVE_OPTION || chooser.getSelectedFile() == null) {
                return Optional.empty();
            }
            return Optional.of(chooser.getSelectedFile().toPath().toAbsolutePath().normalize().toString());
        } finally {
            owner.dispose();
        }
    }

    public Track requireTrack(String id) {
        return trackRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("歌曲不存在: " + id));
    }

    public byte[] readCover(String id) {
        Track track = requireTrack(id);
        return musicScanService.readEffectiveCover(Path.of(track.filePath()));
    }

    public String readCoverMimeType(String id) {
        Track track = requireTrack(id);
        return musicScanService.readEffectiveCoverMimeType(Path.of(track.filePath()));
    }
}
