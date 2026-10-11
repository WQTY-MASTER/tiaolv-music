package com.listenmusic.service;

import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.PlaylistDiscoveryItem;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AccountCatalogRecommendationsTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final CredentialStore credentials = mock(CredentialStore.class);
    private final MusicProvider qq = mock(MusicProvider.class);
    private final QqListeningStatsService stats = mock(QqListeningStatsService.class);
    private final AccountCatalogService service = new AccountCatalogService(accounts, credentials, List.of(qq), stats);

    @BeforeEach
    void setUp() {
        when(accounts.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "User", null, "credential", true, "2026-10-09", "2026-10-09")));
        when(credentials.get("credential")).thenReturn(Optional.of("uin=200; qm_keyst=secret"));
        when(qq.id()).thenReturn("qq");
        when(qq.loadAccountFeaturedPlaylists("200", "uin=200; qm_keyst=secret")).thenReturn(List.of(
            new HomepagePlaylist("qq:hot", "Hot", "Creator", "cover", 10)));
        when(qq.search(anyString(), eq(SearchType.PLAYLIST), anyInt(), eq(0))).thenReturn(SearchResultPage.empty());
    }

    @Test
    void addsPlaylistsFromTheCurrentAccountsQualifiedListening() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenReturn(List.of(
            new QqListeningRankEntry(track("鸣潮先约电台/苏诗丁", "心月辞"), 8, 1200, "2026-10-09T00:00:00Z")));
        when(qq.search(eq("鸣潮先约电台"), eq(SearchType.PLAYLIST), anyInt(), eq(0))).thenReturn(page("qq:ww", "鸣潮音乐"));
        List<HomepagePlaylist> result = service.loadFeaturedPlaylists("qq");
        assertEquals("qq:ww", result.getFirst().id());
        assertTrue(result.stream().anyMatch(p -> p.id().equals("qq:hot")));
        verify(stats).loadRanking(eq("200"), eq("custom"), anyString(), anyString());
    }

    @Test
    void ignoresBriefUnqualifiedPlays() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenReturn(List.of(
            new QqListeningRankEntry(track("Skipped", "Skipped album"), 0, 3, "2026-10-09T00:00:00Z")));
        assertEquals("qq:hot", service.loadFeaturedPlaylists("qq").getFirst().id());
        verify(qq, never()).search(anyString(), eq(SearchType.PLAYLIST), anyInt(), anyInt());
    }

    @Test
    void repeatedShortSkipsStillDoNotBecomePreferences() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenReturn(List.of(
            new QqListeningRankEntry(track("Skipped", "Skipped album"), 0, 100, "2026-10-09T00:00:00Z")));
        service.loadFeaturedPlaylists("qq");
        verify(qq, never()).search(anyString(), eq(SearchType.PLAYLIST), anyInt(), anyInt());
    }

    @Test
    void anotherAccountDoesNotReceiveThePreviousAccountsPreferences() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenReturn(List.of(
            new QqListeningRankEntry(track("鸣潮先约电台", "心月辞"), 8, 1200, "2026-10-09T00:00:00Z")));
        when(accounts.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "300", "Other", null, "other-credential", true, "2026-10-09", "2026-10-09")));
        when(credentials.get("other-credential")).thenReturn(Optional.of("uin=300; qm_keyst=other"));
        service.loadFeaturedPlaylists("qq");
        verify(stats).loadRanking(eq("300"), eq("custom"), anyString(), anyString());
        verify(qq, never()).search(eq("鸣潮先约电台"), any(), anyInt(), anyInt());
    }

    @Test
    void canUseFavoritesWithoutListeningHistory() {
        when(qq.loadAccountFavorites("200", "uin=200; qm_keyst=secret")).thenReturn(List.of(track("Favorite artist", "Favorite album")));
        when(qq.search(eq("Favorite artist"), eq(SearchType.PLAYLIST), anyInt(), eq(0))).thenReturn(page("qq:fav", "Artist collection"));
        assertEquals("qq:fav", service.loadFeaturedPlaylists("qq").getFirst().id());
    }

    @Test
    void localFailuresCannotDiscardProviderRecommendations() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenThrow(new IllegalStateException("Database unavailable"));
        when(qq.loadAccountFavorites(anyString(), anyString())).thenThrow(new IllegalStateException("Upstream unavailable"));
        assertEquals("qq:hot", service.loadFeaturedPlaylists("qq").getFirst().id());
    }

    @Test
    void searchesAtMostThreeTermsAndRetainsOfficialContentOnSearchFailures() {
        when(stats.loadRanking(eq("200"), eq("custom"), anyString(), anyString())).thenReturn(List.of(
            new QqListeningRankEntry(track("A artist/B artist/C artist/D artist", "Album"), 8, 1200, "2026-10-09T00:00:00Z")));
        when(qq.search(anyString(), eq(SearchType.PLAYLIST), anyInt(), eq(0))).thenThrow(new IllegalStateException("Search unavailable"));
        assertEquals("qq:hot", service.loadFeaturedPlaylists("qq").getFirst().id());
        verify(qq, times(3)).search(anyString(), eq(SearchType.PLAYLIST), eq(6), eq(0));
    }

    @Test
    void canStillRecommendLocalMatchesWhenBothOfficialFeedsFail() {
        when(qq.loadAccountFeaturedPlaylists(anyString(), anyString())).thenThrow(new IllegalStateException("Unavailable"));
        when(qq.loadAccountFavorites(anyString(), anyString())).thenReturn(List.of(track("Artist", "Album")));
        when(qq.search(eq("Artist"), eq(SearchType.PLAYLIST), anyInt(), eq(0))).thenReturn(page("qq:related", "Related"));
        assertEquals("qq:related", service.loadFeaturedPlaylists("qq").getFirst().id());
    }

    static Track track(String artist, String album) {
        return new Track("qq:mid", "Song", artist, album, 200L, "qq", null, null, null, null, null, null, null, null);
    }
    static SearchResultPage page(String id, String title) {
        return new SearchResultPage(List.of(), List.of(new PlaylistDiscoveryItem(id, title, "Creator", "cover", 10, 100)), List.of(), 1, false);
    }
}
