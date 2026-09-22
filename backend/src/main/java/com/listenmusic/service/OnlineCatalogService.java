package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.CoverData;
import com.listenmusic.provider.HomepageData;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.PlaylistCategoryData;
import com.listenmusic.provider.PlaylistDiscoveryPage;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OnlineCatalogService {
    private final List<MusicProvider> providers;
    private final String activeProvider;

    public OnlineCatalogService(
        List<MusicProvider> providers,
        @Value("${listenmusic.catalog.provider:netease}") String providerName
    ) {
        this.providers = providers;
        this.activeProvider = providerName.toLowerCase();
    }

    public List<Track> search(String query) {
        return provider().search(query);
    }

    public SearchResultPage search(String query, String providerId, SearchType type, int limit, int offset) {
        return provider(providerId).search(query, type, limit, offset);
    }

    public Optional<Track> find(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> provider.find(trackId));
    }

    public Optional<String> resolveAudioUrl(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> provider.resolveAudioUrl(trackId));
    }

    public Optional<LyricData> loadLyrics(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> provider.loadLyrics(trackId));
    }

    public List<Track> loadPlaylist(String playlistId) {
        return providerForTrack(playlistId)
            .map(provider -> provider.loadPlaylist(playlistId))
            .orElseGet(List::of);
    }

    public Optional<CoverData> loadCover(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> provider.loadCover(trackId));
    }

    public HomepageData loadHomepage(boolean refresh, String cursor) {
        return provider().loadHomepage(refresh, cursor);
    }

    public HomepageData loadDiscovery(boolean refresh, String cursor) {
        return provider().loadDiscovery(refresh, cursor);
    }

    public PlaylistCategoryData loadPlaylistCategories() {
        return provider().loadPlaylistCategories();
    }

    public PlaylistDiscoveryPage loadPlaylists(String category, String order, int limit, int offset) {
        return provider().loadPlaylists(category, order, limit, offset);
    }

    public PlaylistDiscoveryPage loadHighQualityPlaylists(String category, int limit, String before) {
        return provider().loadHighQualityPlaylists(category, limit, before);
    }

    public void updatePlaylistPlayCount(String playlistId) {
        providerForTrack(playlistId).ifPresent(provider -> provider.updatePlaylistPlayCount(playlistId));
    }

    public List<Track> loadDailyRecommendations() {
        return provider().loadDailyRecommendations();
    }

    public String activeProvider() {
        return activeProvider;
    }

    private MusicProvider provider() {
        return provider(activeProvider);
    }

    private MusicProvider provider(String providerId) {
        String requestedProvider = providerId == null || providerId.isBlank()
            ? activeProvider
            : providerId.trim().toLowerCase();
        return providers.stream()
            .filter(candidate -> candidate.id().equalsIgnoreCase(requestedProvider))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("未找到音乐源: " + requestedProvider));
    }

    private Optional<MusicProvider> providerForTrack(String trackId) {
        if (trackId == null || trackId.isBlank()) {
            return Optional.empty();
        }
        int separator = trackId.indexOf(':');
        String source = separator > 0 ? trackId.substring(0, separator) : activeProvider;
        return providers.stream()
            .filter(provider -> provider.id().equalsIgnoreCase(source))
            .findFirst();
    }
}
