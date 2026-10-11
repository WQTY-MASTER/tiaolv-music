package com.listenmusic.service;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.CoverData;
import com.listenmusic.provider.HomepageData;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.PlaylistCategoryData;
import com.listenmusic.provider.PlaylistDiscoveryPage;
import com.listenmusic.provider.PlaybackQuality;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import com.listenmusic.provider.ArtistAlbum;
import com.listenmusic.provider.ArtistDetail;
import com.listenmusic.provider.ArtistSongPage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

@Service
public class OnlineCatalogService {
    private final List<MusicProvider> providers;
    private final String activeProvider;
    private final ProviderResourceCache resourceCache;

    public OnlineCatalogService(
        List<MusicProvider> providers,
        @Value("${listenmusic.catalog.provider:netease}") String providerName,
        ProviderResourceCache resourceCache
    ) {
        this.providers = providers;
        this.activeProvider = providerName.toLowerCase();
        this.resourceCache = resourceCache;
    }

    public List<Track> search(String query) {
        return provider().search(query);
    }

    public SearchResultPage search(String query, String providerId, SearchType type, int limit, int offset) {
        return provider(providerId).search(query, type, limit, offset);
    }

    public Optional<Track> find(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> cached(
            ProviderResourceCache.Category.METADATA,
            provider,
            trackId,
            Track.class,
            () -> provider.find(trackId)
        ));
    }

    public Optional<String> resolveAudioUrl(String trackId) {
        return resolveAudioUrl(trackId, PlaybackQuality.AUTO);
    }

    public Optional<String> resolveAudioUrl(String trackId, PlaybackQuality quality) {
        return providerForTrack(trackId).flatMap(provider -> provider.resolveAudioUrl(trackId, quality));
    }

    public Optional<LyricData> loadLyrics(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> cached(
            ProviderResourceCache.Category.LYRICS,
            provider,
            trackId,
            LyricData.class,
            () -> provider.loadLyrics(trackId)
        ));
    }

    public Optional<LyricData> loadLyricsFresh(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> {
            Optional<LyricData> loaded = provider.loadLyrics(trackId);
            loaded.ifPresent(value -> resourceCache.write(
                ProviderResourceCache.Category.LYRICS,
                provider.id(),
                trackId,
                value
            ));
            return loaded;
        });
    }

    public List<Track> loadPlaylist(String playlistId) {
        return providerForTrack(playlistId)
            .map(provider -> provider.loadPlaylist(playlistId))
            .orElseGet(List::of);
    }

    public ArtistDetail loadArtistDetail(String artistId, String providerId) {
        return provider(providerId).loadArtistDetail(artistId);
    }

    public List<Track> loadArtistTopSongs(String artistId, String providerId) {
        return provider(providerId).loadArtistTopSongs(artistId);
    }

    public ArtistSongPage loadArtistSongs(String artistId, String providerId, String order, int limit, int offset) {
        return provider(providerId).loadArtistSongs(artistId, order, limit, offset);
    }

    public List<ArtistAlbum> loadArtistAlbums(String artistId, String providerId, int limit, int offset) {
        return provider(providerId).loadArtistAlbums(artistId, limit, offset);
    }

    public Optional<CoverData> loadCover(String trackId) {
        return providerForTrack(trackId).flatMap(provider -> cached(
            ProviderResourceCache.Category.COVER,
            provider,
            trackId,
            CoverData.class,
            () -> provider.loadCover(trackId)
        ));
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

    public PlaylistCategoryData loadPlaylistCategories(String providerId) {
        return provider(providerId).loadPlaylistCategories();
    }

    public PlaylistDiscoveryPage loadPlaylists(String category, String order, int limit, int offset) {
        return provider().loadPlaylists(category, order, limit, offset);
    }

    public PlaylistDiscoveryPage loadPlaylists(String providerId, String category, String order, int limit, int offset) {
        return provider(providerId).loadPlaylists(category, order, limit, offset);
    }

    public PlaylistDiscoveryPage loadHighQualityPlaylists(String category, int limit, String before) {
        return provider().loadHighQualityPlaylists(category, limit, before);
    }

    public PlaylistDiscoveryPage loadHighQualityPlaylists(String providerId, String category, int limit, String before) {
        return provider(providerId).loadHighQualityPlaylists(category, limit, before);
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

    private <T> Optional<T> cached(
        ProviderResourceCache.Category category,
        MusicProvider provider,
        String resourceId,
        Class<T> type,
        Supplier<Optional<T>> loader
    ) {
        Optional<T> stored = resourceCache.read(category, provider.id(), resourceId, type);
        if (stored.isPresent()) {
            return stored;
        }
        Optional<T> loaded = loader.get();
        loaded.ifPresent(value -> resourceCache.write(category, provider.id(), resourceId, value));
        return loaded;
    }
}
