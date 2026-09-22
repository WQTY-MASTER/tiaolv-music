package com.listenmusic.api;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.HomepageData;
import com.listenmusic.provider.DailyRecommendationsLoginRequiredException;
import com.listenmusic.provider.PlaylistCategoryData;
import com.listenmusic.provider.PlaylistDiscoveryPage;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import com.listenmusic.service.OnlineCatalogService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/catalog")
public class CatalogController {
    private final OnlineCatalogService onlineCatalogService;

    public CatalogController(OnlineCatalogService onlineCatalogService) {
        this.onlineCatalogService = onlineCatalogService;
    }

    @GetMapping("/search")
    public List<Track> search(@RequestParam("q") String query) {
        return onlineCatalogService.search(query);
    }

    @GetMapping("/cloudsearch")
    public SearchResultPage cloudSearch(
        @RequestParam String keywords,
        @RequestParam(defaultValue = "netease") String provider,
        @RequestParam(defaultValue = "1") int type,
        @RequestParam(defaultValue = "8") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return onlineCatalogService.search(keywords, provider, SearchType.fromApiValue(type), limit, offset);
    }

    @GetMapping("/provider")
    public Map<String, String> provider() {
        return Map.of("id", onlineCatalogService.activeProvider());
    }

    @GetMapping("/homepage")
    public HomepageData homepage(
        @RequestParam(defaultValue = "false") boolean refresh,
        @RequestParam(required = false) String cursor
    ) {
        return onlineCatalogService.loadHomepage(refresh, cursor);
    }

    @GetMapping("/discovery")
    public HomepageData discovery(
        @RequestParam(defaultValue = "false") boolean refresh,
        @RequestParam(required = false) String cursor
    ) {
        return onlineCatalogService.loadDiscovery(refresh, cursor);
    }

    @GetMapping("/playlist-categories")
    public PlaylistCategoryData playlistCategories() {
        return onlineCatalogService.loadPlaylistCategories();
    }

    @GetMapping("/playlists")
    public PlaylistDiscoveryPage playlists(
        @RequestParam(defaultValue = "全部") String category,
        @RequestParam(defaultValue = "hot") String order,
        @RequestParam(defaultValue = "30") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return onlineCatalogService.loadPlaylists(category, order, limit, offset);
    }

    @GetMapping("/playlists/high-quality")
    public PlaylistDiscoveryPage highQualityPlaylists(
        @RequestParam(defaultValue = "全部") String category,
        @RequestParam(defaultValue = "30") int limit,
        @RequestParam(required = false) String before
    ) {
        return onlineCatalogService.loadHighQualityPlaylists(category, limit, before);
    }

    @PostMapping("/playlists/{id}/play-count")
    public Map<String, Boolean> updatePlaylistPlayCount(@PathVariable String id) {
        onlineCatalogService.updatePlaylistPlayCount(id);
        return Map.of("ok", true);
    }

    @GetMapping("/daily-recommendations")
    public ResponseEntity<?> dailyRecommendations() {
        try {
            return ResponseEntity.ok(onlineCatalogService.loadDailyRecommendations());
        } catch (DailyRecommendationsLoginRequiredException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", "LOGIN_REQUIRED", "message", ex.getMessage()));
        }
    }

    @GetMapping("/tracks/{id}")
    public ResponseEntity<Track> track(@PathVariable String id) {
        return onlineCatalogService.find(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.<Track>notFound().build());
    }

    @GetMapping("/tracks/{id}/audio")
    public ResponseEntity<Void> audio(@PathVariable String id) {
        return onlineCatalogService.resolveAudioUrl(id)
            .map(url -> {
                HttpHeaders headers = new HttpHeaders();
                headers.setLocation(URI.create(url));
                return new ResponseEntity<Void>(headers, HttpStatus.FOUND);
            })
            .orElseGet(() -> ResponseEntity.<Void>notFound().build());
    }

    @GetMapping("/tracks/{id}/lyrics")
    public ResponseEntity<LyricData> lyrics(@PathVariable String id) {
        return onlineCatalogService.loadLyrics(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/playlists/{id}")
    public List<Track> playlist(@PathVariable String id) {
        return onlineCatalogService.loadPlaylist(id);
    }

    @GetMapping("/tracks/{id}/cover")
    public ResponseEntity<byte[]> cover(@PathVariable String id) {
        return onlineCatalogService.loadCover(id)
            .map(cover -> ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(cover.contentType()))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)))
                .body(cover.bytes()))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
