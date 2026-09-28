package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.repository.PlaylistRepository;
import com.listenmusic.repository.TrackRepository;
import com.listenmusic.repository.UserDataRepository;
import com.listenmusic.repository.LocalLibraryRepository;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LibraryServiceTest {
    @Test
    void scanPreservesTheDetectedLyricsFormat() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        when(scanner.scan(directory, true)).thenReturn(List.of(new ScannedTrack(
            "local-1", "歌曲", "歌手", "专辑", 180, directory.resolve("歌曲.flac"),
            null, null, null, "[1000,500]歌(1000,500)", "QRC", null, null
        )));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), mock(LocalLibraryRepository.class)
        );

        List<Track> result = service.scanDirectory(directory.toString());

        assertEquals("QRC", result.get(0).lyricsFormat());
        verify(tracks).upsert(result.get(0));
    }

    @Test
    void scanRestoresCachedOnlineLyricsWhenNoLocalFileExists() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        LocalLyricsCache cache = mock(LocalLyricsCache.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        when(scanner.scan(directory, true)).thenReturn(List.of(new ScannedTrack(
            "local-1", "歌曲", "歌手", "专辑", 180, directory.resolve("歌曲.flac"),
            null, null, null, null, null, null, null
        )));
        when(cache.load("local-1")).thenReturn(Optional.of(new LyricData(
            "[1000,500]歌(1000,500)", null, "QRC", "qq", List.of()
        )));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class), cache,
            mock(LocalLibraryRepository.class)
        );

        Track result = service.scanDirectory(directory.toString()).get(0);

        assertEquals("QRC", result.lyricsFormat());
        assertEquals("cache-qq", result.lyricsSource());
    }

    @Test
    void scanPersistsTheMetadataSourceReportedByTheScanner() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        when(scanner.scan(directory, true)).thenReturn(List.of(new ScannedTrack(
            "local-1", "歌曲", "歌手", "专辑", 180, directory.resolve("歌手 - 歌曲.flac"),
            null, null, null, null, null, null, null, "filename"
        )));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), mock(LocalLibraryRepository.class)
        );

        Track result = service.scanDirectory(directory.toString(), true).get(0);

        assertEquals("filename", result.metaSource());
        verify(tracks).upsert(result);
    }

    @Test
    void incrementalScanOnlyParsesNewFilesAndRemovesMissingTracks() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        Path retainedFile = directory.resolve("保留.flac");
        Path addedFile = directory.resolve("新增.flac");
        Track retained = localTrack("local-retained", retainedFile);
        Track removed = localTrack("local-removed", directory.resolve("已删除.flac"));
        ScannedTrack added = new ScannedTrack(
            "local-added", "新增", "歌手", "专辑", 180, addedFile,
            null, null, null, null, null, null, null
        );
        when(tracks.findLocalTracks()).thenReturn(List.of(retained, removed));
        when(scanner.findAudioFiles(directory)).thenReturn(List.of(retainedFile, addedFile));
        when(scanner.scanFiles(List.of(addedFile), true)).thenReturn(List.of(added));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), mock(LocalLibraryRepository.class)
        );

        LibraryScanResult result = service.incrementalScanDirectory(directory.toString());

        assertEquals(2, result.total());
        assertEquals(1, result.added());
        assertEquals(1, result.removed());
        assertEquals(List.of("local-retained", "local-added"), result.tracks().stream().map(Track::id).toList());
        verify(scanner).scanFiles(List.of(addedFile), true);
        verify(tracks).removeLocalTracksByIds(List.of("local-removed"));
        verify(tracks).upsert(result.tracks().get(1));
    }

    @Test
    void reparsesEveryTrackAndReportsFilenameMetadataUsage() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        when(scanner.scan(directory, true)).thenReturn(List.of(
            scannedTrack("local-1", directory.resolve("歌手 - 歌曲.flac"), "filename"),
            scannedTrack("local-2", directory.resolve("歌曲二.flac"), "embedded")
        ));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), mock(LocalLibraryRepository.class)
        );

        LibraryMetadataReparseResult result = service.reparseAllMetadata(directory.toString(), true);

        assertEquals(2, result.total());
        assertEquals(1, result.filenameResolved());
        assertEquals(List.of("local-1", "local-2"), result.tracks().stream().map(Track::id).toList());
        verify(scanner).scan(directory, true);
    }

    @Test
    void scanningOneRootKeepsTracksFromOtherRoots() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        LocalLibraryRepository localLibrary = mock(LocalLibraryRepository.class);
        Path firstRoot = Path.of("G:/music").toAbsolutePath().normalize();
        Path secondRoot = Path.of("G:/backup").toAbsolutePath().normalize();
        Track retained = localTrack("local-backup", secondRoot.resolve("歌曲.flac"));
        ScannedTrack scanned = scannedTrack("local-music", firstRoot.resolve("歌曲.flac"), "embedded");
        when(tracks.findLocalTracks()).thenReturn(List.of(retained));
        when(scanner.scan(firstRoot, true)).thenReturn(List.of(scanned));
        when(localLibrary.findIgnoredPathKeys()).thenReturn(Set.of());
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), localLibrary
        );

        List<Track> result = service.scanDirectory(firstRoot.toString(), true);

        assertEquals(Set.of("local-backup", "local-music"),
            result.stream().map(Track::id).collect(java.util.stream.Collectors.toSet()));
        verify(localLibrary).addRoot(firstRoot);
        verify(tracks, never()).clearLocalTracks();
    }

    @Test
    void fullScanReusesExistingTrackIdentityForTheSameAbsolutePath() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        LocalLibraryRepository localLibrary = mock(LocalLibraryRepository.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        Path file = directory.resolve("歌曲.flac");
        Track existing = localTrack("local-existing", file);
        ScannedTrack rescanned = scannedTrack("local-different-id", file, "embedded");
        when(tracks.findLocalTracks()).thenReturn(List.of(existing));
        when(scanner.scan(directory, true)).thenReturn(List.of(rescanned));
        when(localLibrary.findIgnoredPathKeys()).thenReturn(Set.of());
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), localLibrary
        );

        List<Track> result = service.scanDirectory(directory.toString(), true);

        assertEquals(List.of("local-existing"), result.stream().map(Track::id).toList());
        verify(tracks).upsert(result.get(0));
    }

    @Test
    void ignoredPathsAreNotAddedBackDuringScan() {
        TrackRepository tracks = mock(TrackRepository.class);
        MusicScanService scanner = mock(MusicScanService.class);
        LocalLibraryRepository localLibrary = mock(LocalLibraryRepository.class);
        Path directory = Path.of("G:/music").toAbsolutePath().normalize();
        Path ignoredFile = directory.resolve("重复.flac");
        when(scanner.scan(directory, true)).thenReturn(List.of(
            scannedTrack("local-ignored", ignoredFile, "embedded")
        ));
        when(localLibrary.findIgnoredPathKeys()).thenReturn(Set.of(LocalPathKey.of(ignoredFile)));
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), scanner, mock(UserDataRepository.class),
            mock(LocalLyricsCache.class), localLibrary
        );

        List<Track> result = service.scanDirectory(directory.toString(), true);

        assertEquals(List.of(), result);
        verify(tracks, never()).upsert(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void removingDuplicateCandidatesOnlyIgnoresDatabaseRecords() {
        TrackRepository tracks = mock(TrackRepository.class);
        LocalLibraryRepository localLibrary = mock(LocalLibraryRepository.class);
        Path duplicate = Path.of("G:/backup/歌曲.flac").toAbsolutePath().normalize();
        Track track = localTrack("local-duplicate", duplicate);
        when(tracks.findById("local-duplicate")).thenReturn(Optional.of(track));
        when(tracks.findLocalTracks()).thenReturn(List.of());
        LibraryService service = new LibraryService(
            tracks, mock(PlaylistRepository.class), mock(MusicScanService.class),
            mock(UserDataRepository.class), mock(LocalLyricsCache.class), localLibrary
        );

        List<Track> result = service.ignoreLocalTracks(List.of("local-duplicate"));

        assertEquals(List.of(), result);
        verify(localLibrary).ignorePaths(List.of(duplicate.toString()));
        verify(tracks).removeLocalTracksByIds(List.of("local-duplicate"));
    }

    private Track localTrack(String id, Path file) {
        return new Track(
            id, "歌曲", "歌手", "专辑", 180L, "local", file.toString(),
            "/audio", null, null, null, null, null, null, null
        );
    }

    private ScannedTrack scannedTrack(String id, Path file, String metaSource) {
        return new ScannedTrack(
            id, "歌曲", "歌手", "专辑", 180, file,
            null, null, null, null, null, null, null, metaSource
        );
    }
}
