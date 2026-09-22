package com.listenmusic.service;

import com.listenmusic.domain.Playlist;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.PlaylistRepository;
import com.listenmusic.repository.TrackRepository;
import com.listenmusic.repository.UserDataRepository;
import org.springframework.stereotype.Service;

import java.awt.GraphicsEnvironment;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.UIManager;

@Service
public class LibraryService {
    private final TrackRepository trackRepository;
    private final PlaylistRepository playlistRepository;
    private final MusicScanService musicScanService;
    private final UserDataRepository userDataRepository;
    private static final String LOCAL_PROFILE_ID = "local";

    public LibraryService(
        TrackRepository trackRepository,
        PlaylistRepository playlistRepository,
        MusicScanService musicScanService,
        UserDataRepository userDataRepository
    ) {
        this.trackRepository = trackRepository;
        this.playlistRepository = playlistRepository;
        this.musicScanService = musicScanService;
        this.userDataRepository = userDataRepository;
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
        Path path = Path.of(directory).toAbsolutePath().normalize();
        List<Track> tracks = musicScanService.scan(path).stream()
            .map(scanned -> {
                String lyrics = scanned.effectiveLyrics();
                String lyricsSource = scanned.embeddedLyrics() != null && !scanned.embeddedLyrics().isBlank()
                    ? "embedded"
                    : lyrics == null || lyrics.isBlank() ? null : "sidecar";
                String coverMimeType = scanned.effectiveCoverMimeType();
                return new Track(
                    scanned.id(),
                    scanned.title(),
                    scanned.artist(),
                    scanned.album(),
                    scanned.durationSeconds(),
                    "local",
                    scanned.filePath().toString(),
                    "/library/tracks/" + scanned.id() + "/audio",
                    scanned.hasCover() ? "/library/tracks/" + scanned.id() + "/cover" : null,
                    lyrics,
                    lyricsSource,
                    coverMimeType,
                    null,
                    OffsetDateTime.now().toString()
                );
            })
            .toList();
        trackRepository.removeLocalTracksNotIn(tracks.stream().map(Track::id).toList());
        tracks.forEach(trackRepository::upsert);
        return tracks;
    }

    public void resetLocalLibrary() {
        trackRepository.clearLocalTracks();
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
