package com.listenmusic.api;

import com.listenmusic.auth.AccountView;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.AccountProfile;
import com.listenmusic.provider.AccountSocialUser;
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

    @GetMapping("/{provider}/listening-rank")
    public List<Track> listeningRank(@PathVariable String provider) {
        return accountCatalogService.loadListeningRank(provider);
    }

    @GetMapping("/{provider}/playlists")
    public List<HomepagePlaylist> playlists(@PathVariable String provider) {
        return accountCatalogService.loadPlaylists(provider);
    }

    @GetMapping("/{provider}/featured-playlists")
    public List<HomepagePlaylist> featuredPlaylists(@PathVariable String provider) {
        return accountCatalogService.loadFeaturedPlaylists(provider);
    }

    @GetMapping("/{provider}/playlists/{id}")
    public List<Track> playlist(@PathVariable String provider, @PathVariable String id) {
        return accountCatalogService.loadPlaylist(provider, id);
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

    @org.springframework.web.bind.annotation.ExceptionHandler(AccountLoginRequiredException.class)
    public ResponseEntity<Map<String, String>> loginRequired(AccountLoginRequiredException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("code", "LOGIN_REQUIRED", "message", ex.getMessage()));
    }

}
