package com.listenmusic.api;

import com.listenmusic.domain.Playlist;
import com.listenmusic.domain.Track;
import com.listenmusic.service.LibraryService;
import com.listenmusic.service.LibraryMetadataReparseResult;
import com.listenmusic.service.LibraryScanResult;
import com.listenmusic.service.LocalLyricsMatchResult;
import com.listenmusic.service.LocalLyricsMatchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.CacheControl;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/library")
public class LibraryController {
    private final LibraryService libraryService;
    private final LocalLyricsMatchService localLyricsMatchService;

    public LibraryController(LibraryService libraryService, LocalLyricsMatchService localLyricsMatchService) {
        this.libraryService = libraryService;
        this.localLyricsMatchService = localLyricsMatchService;
    }

    @GetMapping("/tracks")
    public List<Track> tracks() {
        return libraryService.listTracks();
    }

    @GetMapping("/roots")
    public List<String> roots() {
        return libraryService.listLibraryRoots();
    }

    @GetMapping("/ignored")
    public List<String> ignoredFiles() {
        return libraryService.listIgnoredLocalFiles();
    }

    @DeleteMapping("/tracks")
    public Map<String, Object> resetTracks() {
        libraryService.resetLocalLibrary();
        return Map.of("ok", true);
    }

    @GetMapping("/select-directory")
    public Map<String, Object> selectDirectory() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("directory", libraryService.selectMusicDirectory().orElse(null));
        return result;
    }

    @GetMapping("/playlists")
    public List<Playlist> playlists() {
        return libraryService.listPlaylists();
    }

    @GetMapping("/favorites")
    public List<Track> favorites() {
        return libraryService.listFavorites();
    }

    @PostMapping("/favorites")
    public Map<String, Object> saveFavorite(@RequestBody Track track) {
        libraryService.saveFavorite(track);
        return Map.of("ok", true);
    }

    @DeleteMapping("/favorites/{id}")
    public Map<String, Object> removeFavorite(@PathVariable String id) {
        libraryService.removeFavorite(id);
        return Map.of("ok", true);
    }

    @GetMapping("/history")
    public List<Track> history() {
        return libraryService.listHistory();
    }

    @PostMapping("/history")
    public Map<String, Object> recordHistory(@RequestBody Track track) {
        libraryService.recordHistory(track);
        return Map.of("ok", true);
    }

    @PostMapping("/scan")
    public List<Track> scan(@RequestBody Map<String, Object> body) {
        return libraryService.scanDirectory(
            requireDirectory(body),
            useFilenameMetadata(body)
        );
    }

    @PostMapping("/scan/incremental")
    public LibraryScanResult incrementalScan(@RequestBody Map<String, Object> body) {
        return libraryService.incrementalScanDirectory(
            requireDirectory(body),
            useFilenameMetadata(body)
        );
    }

    @PostMapping("/scan/all/incremental")
    public LibraryScanResult incrementalScanAll(@RequestBody Map<String, Object> body) {
        return libraryService.incrementalScanAllDirectories(useFilenameMetadata(body));
    }

    @PostMapping("/tracks/ignore")
    public List<Track> ignoreTracks(@RequestBody Map<String, Object> body) {
        Object value = body.get("trackIds");
        if (!(value instanceof List<?> values)) {
            throw new IllegalArgumentException("trackIds 必须是数组");
        }
        List<String> trackIds = values.stream()
            .map(Object::toString)
            .filter(id -> !id.isBlank())
            .toList();
        return libraryService.ignoreLocalTracks(trackIds);
    }

    @DeleteMapping("/ignored")
    public Map<String, Object> restoreIgnoredFiles() {
        return Map.of("restored", libraryService.restoreIgnoredLocalFiles());
    }

    @PostMapping("/metadata/reparse")
    public LibraryMetadataReparseResult reparseMetadata(@RequestBody Map<String, Object> body) {
        return libraryService.reparseAllMetadata(
            requireDirectory(body),
            useFilenameMetadata(body)
        );
    }

    @GetMapping("/tracks/{id}/audio")
    public ResponseEntity<ResourceRegion> audio(
        @PathVariable String id,
        @org.springframework.web.bind.annotation.RequestHeader HttpHeaders headers
    ) throws IOException {
        Track track = libraryService.requireTrack(id);
        Path path = Path.of(track.filePath());
        Resource resource = new FileSystemResource(path);
        if (!resource.exists() || !resource.isReadable()) {
            return ResponseEntity.notFound().build();
        }

        List<HttpRange> ranges = headers.getRange();
        ResourceRegion region = ranges.isEmpty()
            ? new ResourceRegion(resource, 0, resource.contentLength())
            : ranges.get(0).toResourceRegion(resource);
        MediaType mediaType = MediaTypeFactory.getMediaType(path.getFileName().toString())
            .orElse(MediaType.APPLICATION_OCTET_STREAM);
        HttpStatus status = ranges.isEmpty() ? HttpStatus.OK : HttpStatus.PARTIAL_CONTENT;
        return ResponseEntity.status(status)
            .contentType(mediaType)
            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
            .body(region);
    }

    @GetMapping("/tracks/{id}/cover")
    public ResponseEntity<byte[]> cover(@PathVariable String id) {
        byte[] cover = libraryService.readCover(id);
        if (cover == null || cover.length == 0) {
            return ResponseEntity.notFound().build();
        }
        MediaType mediaType = MediaType.parseMediaType(libraryService.readCoverMimeType(id));
        return ResponseEntity.ok()
            .contentType(mediaType)
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)))
            .body(cover);
    }

    @GetMapping("/tracks/{id}/lyrics")
    public ResponseEntity<String> lyrics(@PathVariable String id) {
        Track track = libraryService.requireTrack(id);
        if (track.lyrics() == null || track.lyrics().isBlank()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/plain;charset=UTF-8"))
            .body(track.lyrics());
    }

    @PostMapping("/tracks/{id}/lyrics/match")
    public LocalLyricsMatchResult matchLyrics(
        @PathVariable String id,
        @RequestParam(defaultValue = "false") boolean saveBesideAudio
    ) {
        return localLyricsMatchService.match(id, saveBesideAudio);
    }

    private static String requireDirectory(Map<String, Object> body) {
        Object value = body.get("directory");
        String directory = value == null ? "" : value.toString().trim();
        if (directory.isEmpty()) {
            throw new IllegalArgumentException("directory 不能为空");
        }
        return directory;
    }

    private static boolean useFilenameMetadata(Map<String, Object> body) {
        Object value = body.get("useFilenameMetadata");
        return value == null || Boolean.parseBoolean(value.toString());
    }
}
