package com.listenmusic.api;

import com.listenmusic.auth.AccountView;
import com.listenmusic.domain.Track;
import com.listenmusic.domain.QqListeningDataSummary;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.AccountProfile;
import com.listenmusic.provider.AccountSocialUser;
import com.listenmusic.provider.FavoriteOperationException;
import com.listenmusic.provider.PlaylistOrderConflictException;
import com.listenmusic.provider.PlaylistOrderRateLimitException;
import com.listenmusic.provider.RecentTracksDeleteResult;
import com.listenmusic.provider.RecentPlayReportException;
import com.listenmusic.service.AccountCatalogService;
import com.listenmusic.service.AccountLoginRequiredException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/account")
public class AccountController {
    private final AccountCatalogService accountCatalogService;

    public AccountController(AccountCatalogService accountCatalogService) {
        this.accountCatalogService = accountCatalogService;
    }

    public record RecentPlayReportRequest(String accountId, String trackId, String sessionId, long listenedSeconds, long totalSeconds) {}

    @PostMapping("/qq/recent-play-reports")
    public Map<String, Object> reportRecentPlay(@RequestBody RecentPlayReportRequest request) {
        List<Track> tracks = accountCatalogService.reportRecentPlay(
            request.accountId(), request.trackId(), request.sessionId(), request.listenedSeconds(), request.totalSeconds()
        );
        return Map.of("ok", true, "tracks", tracks);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(RecentPlayReportException.class)
    public ResponseEntity<Map<String, String>> recentPlayReportFailed(RecentPlayReportException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(Map.of("code", "RECENT_PLAY_REPORT_FAILED", "message", ex.getMessage()));
    }

    @GetMapping("/current")
    public ResponseEntity<AccountView> current() {
        return accountCatalogService.currentAccount()
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{provider}/recommendations")
    public List<Track> recommendations(@PathVariable String provider) {
        return accountCatalogService.loadRecommendations(provider);
    }

    @GetMapping("/{provider}/private-radar")
    public List<Track> privateRadar(@PathVariable String provider) {
        return accountCatalogService.loadPrivateRadar(provider);
    }

    @GetMapping("/{provider}/roaming")
    public List<Track> privateRoaming(
        @PathVariable String provider,
        @RequestParam(defaultValue = "DEFAULT") String mode,
        @RequestParam(required = false) String scene
    ) {
        return accountCatalogService.loadPrivateRoaming(provider, mode, scene);
    }

    @GetMapping("/{provider}/favorites")
    public List<Track> favorites(@PathVariable String provider) {
        return accountCatalogService.loadFavorites(provider);
    }

    @GetMapping("/{provider}/profile")
    public AccountProfile profile(@PathVariable String provider) {
        return accountCatalogService.loadProfile(provider);
    }

    @GetMapping("/{provider}/users/{userId}")
    public AccountProfile userProfile(@PathVariable String provider, @PathVariable String userId) {
        return accountCatalogService.loadUserProfile(provider, userId);
    }

    @GetMapping("/{provider}/following")
    public List<AccountSocialUser> following(
        @PathVariable String provider,
        @RequestParam(defaultValue = "30") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return accountCatalogService.loadFollowing(provider, limit, offset);
    }

    @GetMapping("/{provider}/followers")
    public List<AccountSocialUser> followers(
        @PathVariable String provider,
        @RequestParam(defaultValue = "30") int limit,
        @RequestParam(defaultValue = "0") int offset
    ) {
        return accountCatalogService.loadFollowers(provider, limit, offset);
    }

    @GetMapping("/{provider}/recent-tracks")
    public List<Track> recentTracks(@PathVariable String provider) {
        return accountCatalogService.loadRecentTracks(provider);
    }

    public record RecentTracksDeleteRequest(List<String> trackIds) {}

    @DeleteMapping("/{provider}/recent-tracks")
    public RecentTracksDeleteResult deleteRecentTracks(
        @PathVariable String provider,
        @RequestBody RecentTracksDeleteRequest request
    ) {
        return accountCatalogService.deleteRecentTracks(provider, request.trackIds());
    }

    @GetMapping("/{provider}/listening-rank")
    public List<?> listeningRank(
        @PathVariable String provider,
        @RequestParam(defaultValue = "week") String period,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        return accountCatalogService.loadListeningRank(provider, period, from, to);
    }

    @PostMapping("/{provider}/listening-stats")
    public Map<String, Object> recordListeningStats(
        @PathVariable String provider,
        @RequestBody QqListeningDeltaRequest request
    ) {
        accountCatalogService.recordQqListeningDelta(
            provider, request.accountId(), request.accountNickname(), request.accountAvatarUrl(),
            request.track(), request.listenedSeconds(), request.playCount()
        );
        return Map.of("ok", true);
    }

    @GetMapping("/qq/listening-stats/accounts")
    public List<QqListeningDataSummary> qqListeningDataSummaries() {
        return accountCatalogService.loadQqListeningDataSummaries();
    }

    @DeleteMapping("/qq/listening-stats/{accountId}")
    public Map<String, Object> deleteQqListeningStats(
        @PathVariable String accountId,
        @RequestParam(defaultValue = "false") boolean all,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        accountCatalogService.deleteQqListeningStats(accountId, all, from, to);
        return Map.of("ok", true);
    }

    @PostMapping("/{provider}/listening-scrobbles")
    public Map<String, Object> scrobble(
        @PathVariable String provider,
        @RequestBody ListeningScrobbleRequest request
    ) {
        accountCatalogService.scrobble(
            provider,
            request.trackId(),
            request.title(),
            request.artist(),
            request.listenedSeconds(),
            request.totalSeconds()
        );
        return Map.of("ok", true);
    }

    @GetMapping("/{provider}/playlists")
    public List<HomepagePlaylist> playlists(@PathVariable String provider) {
        return accountCatalogService.loadPlaylists(provider);
    }

    @PostMapping("/{provider}/playlists")
    public HomepagePlaylist createPlaylist(
        @PathVariable String provider,
        @RequestBody CreatePlaylistRequest request
    ) {
        return accountCatalogService.createPlaylist(provider, request.name());
    }

    @GetMapping("/{provider}/featured-playlists")
    public List<HomepagePlaylist> featuredPlaylists(@PathVariable String provider) {
        return accountCatalogService.loadFeaturedPlaylists(provider);
    }

    @DeleteMapping("/{provider}/playlists/{id}")
    public Map<String, Boolean> deletePlaylist(@PathVariable String provider, @PathVariable String id) {
        accountCatalogService.deletePlaylist(provider, id);
        return Map.of("ok", true);
    }

    @DeleteMapping("/{provider}/playlists/{id}/tracks/{trackId}")
    public Map<String, Boolean> removePlaylistTrack(@PathVariable String provider, @PathVariable String id, @PathVariable String trackId) {
        accountCatalogService.removePlaylistTrack(provider, id, trackId);
        return Map.of("ok", true);
    }

    public record PlaylistTrackOrderRequest(List<String> trackIds, List<String> previousTrackIds) {}
    public record PlaylistTracksRequest(List<String> trackIds) {}

    @PostMapping("/{provider}/playlists/{id}/tracks")
    public Map<String, Boolean> addPlaylistTracks(
        @PathVariable String provider,
        @PathVariable String id,
        @RequestBody PlaylistTracksRequest request
    ) {
        accountCatalogService.addPlaylistTracks(provider, id, request.trackIds());
        return Map.of("ok", true);
    }

    @PostMapping("/{provider}/playlists/{id}/order")
    public Map<String, Boolean> reorderPlaylistTracks(@PathVariable String provider, @PathVariable String id, @RequestBody PlaylistTrackOrderRequest request) {
        accountCatalogService.reorderPlaylistTracks(provider, id, request.trackIds(), request.previousTrackIds());
        return Map.of("ok", true);
    }

    @GetMapping("/{provider}/playlists/{id}")
    public List<Track> playlist(@PathVariable String provider, @PathVariable String id) {
        return accountCatalogService.loadPlaylist(provider, id);
    }

    @PostMapping("/{provider}/playlists/{id}/subscription")
    public Map<String, Boolean> setPlaylistSubscription(
        @PathVariable String provider,
        @PathVariable String id,
        @RequestParam boolean subscribed
    ) {
        boolean synced = accountCatalogService.setPlaylistSubscribed(provider, id, subscribed);
        return Map.of("subscribed", subscribed, "synced", synced);
    }

    @PostMapping("/{provider}/favorites")
    public Map<String, Object> addFavorite(@PathVariable String provider, @RequestBody Track track) {
        accountCatalogService.addFavorite(provider, track);
        return Map.of("ok", true);
    }

    @DeleteMapping("/{provider}/favorites/{id}")
    public Map<String, Object> removeFavorite(@PathVariable String provider, @PathVariable String id) {
        accountCatalogService.removeFavorite(provider, id);
        return Map.of("ok", true);
    }

    @GetMapping("/{provider}/artists/{artistId}/subscription")
    public Map<String, Boolean> artistSubscription(
        @PathVariable String provider,
        @PathVariable String artistId
    ) {
        return Map.of("subscribed", accountCatalogService.isArtistSubscribed(provider, artistId));
    }

    @PostMapping("/{provider}/artists/{artistId}/subscription")
    public Map<String, Boolean> setArtistSubscription(
        @PathVariable String provider,
        @PathVariable String artistId,
        @RequestParam boolean subscribed
    ) {
        accountCatalogService.setArtistSubscribed(provider, artistId, subscribed);
        return Map.of("subscribed", subscribed);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(AccountLoginRequiredException.class)
    public ResponseEntity<Map<String, String>> loginRequired(AccountLoginRequiredException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("code", "LOGIN_REQUIRED", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(PlaylistOrderConflictException.class)
    public ResponseEntity<Map<String, String>> playlistOrderConflict(PlaylistOrderConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("code", "PLAYLIST_ORDER_CONFLICT", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(PlaylistOrderRateLimitException.class)
    public ResponseEntity<Map<String, String>> playlistOrderRateLimited(PlaylistOrderRateLimitException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .body(Map.of("code", "PLAYLIST_ORDER_RATE_LIMITED", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(FavoriteOperationException.class)
    public ResponseEntity<Map<String, String>> favoriteWriteFailed(FavoriteOperationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(Map.of("code", "FAVORITE_WRITE_FAILED", "message", ex.getMessage()));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
    }

}
