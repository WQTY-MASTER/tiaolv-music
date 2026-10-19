package com.listenmusic.service;

import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

class AccountCatalogServiceTest {
    @Test
    void batchRemovalValidatesIdsBoundsAndCapturedAccountBeforeDelegation() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        when(provider.id()).thenReturn("qq");
        when(repository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ", null, "credential-qq", true, "now", "now")));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=200"));
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));
        for (String invalidProvider : List.of("local", "QQ", " qq ")) {
            assertThrows(IllegalArgumentException.class, () -> service.removePlaylistTracks(invalidProvider, "qq:900", List.of("qq:mid1"), "200"));
        }
        for (List<String> invalid : List.of(List.<String>of(), List.of("netease:123"), List.of("qq:bad-id"),
            java.util.Arrays.asList("qq:mid1", null), java.util.stream.IntStream.range(0, 101).mapToObj(i -> "qq:mid" + i).toList())) {
            assertThrows(IllegalArgumentException.class, () -> service.removePlaylistTracks("qq", "qq:900", invalid, "200"));
        }
        assertThrows(IllegalArgumentException.class, () -> service.removePlaylistTracks("qq", "netease:900", List.of("qq:mid1"), "200"));
        assertThrows(IllegalArgumentException.class, () -> service.removePlaylistTracks("qq", "qq:900", List.of("qq:mid1"), null));
        assertThrows(IllegalArgumentException.class, () -> service.removePlaylistTracks("qq", "qq:900", List.of("qq:mid1"), "100"));
        org.mockito.Mockito.verify(provider, org.mockito.Mockito.never()).removeAccountPlaylistTracks(anyString(), anyString(), org.mockito.ArgumentMatchers.anyList(), anyString());
        var expected = new com.listenmusic.provider.PlaylistTrackBatchResult(List.of("qq:mid1"), List.of(), java.util.Map.of());
        when(provider.removeAccountPlaylistTracks("200", "qq:900", List.of("qq:mid1"), "uin=200")).thenReturn(expected);
        assertEquals(expected, service.removePlaylistTracks("qq", "qq:900", List.of("qq:mid1", "qq:mid1"), "200"));
        verify(provider).removeAccountPlaylistTracks("200", "qq:900", List.of("qq:mid1"), "uin=200");
    }

    @Test
    void batchRemovalCapturesTheAccountAndCredentialOnlyOnceForTheEntireWrite() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        when(provider.id()).thenReturn("netease");
        when(repository.findActive("netease")).thenReturn(Optional.of(new ProviderAccount(
            "netease", "100", "A", null, "ref-A", true, "now", "now")), Optional.of(new ProviderAccount(
            "netease", "200", "B", null, "ref-B", true, "now", "now")));
        when(credentials.get("ref-A")).thenReturn(Optional.of("MUSIC_U=A"));
        var result = new com.listenmusic.provider.PlaylistTrackBatchResult(List.of("netease:123"), List.of(), java.util.Map.of());
        when(provider.removeAccountPlaylistTracks("100", "netease:900", List.of("netease:123"), "MUSIC_U=A")).thenReturn(result);
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));
        assertEquals(result, service.removePlaylistTracks("netease", "netease:900", List.of("netease:123"), "100"));
        verify(repository).findActive("netease");
        verify(credentials).get("ref-A");
        org.mockito.Mockito.verifyNoMoreInteractions(repository, credentials);
    }

    @Test
    void capturedAdditionRejectsAChangedAccountBeforeWriting() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        when(provider.id()).thenReturn("qq");
        when(repository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ", null, "credential-qq", true, "2026-10-11", "2026-10-11")));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=200"));
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));
        assertThrows(IllegalArgumentException.class, () -> service.addPlaylistTracks("qq", "qq:123", List.of("qq:mid1"), "100"));
        org.mockito.Mockito.verify(provider, org.mockito.Mockito.never()).addAccountPlaylistTracks(
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        service.addPlaylistTracks("qq", "qq:123", List.of("qq:mid1"), "200");
        verify(provider).addAccountPlaylistTracks("200", "qq:123", List.of("qq:mid1"), "uin=200");
    }

    @Test
    void recentPlaybackRequiresCapturedActiveAccountAndQualifyingTime() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        when(provider.id()).thenReturn("qq");
        when(repository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true, "2026-10-11", "2026-10-11")));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=200"));
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));
        String session = "cf3dac35-7a99-4706-9c69-11a4742486a1";
        assertThrows(IllegalArgumentException.class, () -> service.reportRecentPlay("100", "qq:mid1", session, 30, 180));
        assertThrows(IllegalArgumentException.class, () -> service.reportRecentPlay("200", "qq:mid1", session, 29, 180));
        assertThrows(IllegalArgumentException.class, () -> service.reportRecentPlay("200", "netease:1", session, 30, 180));
        org.mockito.Mockito.verifyNoInteractions(provider);
        service.reportRecentPlay("200", "qq:mid1", session, 30, 180);
        verify(provider).reportAccountRecentTrack("200", "qq:mid1", session, 30, 180, "uin=200");
    }

    @Test
    void preservesTheExpiredLoginReasonForFavoriteMutations() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=200; qqmusic_key=expired"));
        when(provider.id()).thenReturn("qq");
        org.mockito.Mockito.doThrow(new com.listenmusic.provider.ProviderLoginRequiredException(
            "QQ 音乐登录已失效，请重新登录"
        )).when(provider).setAccountFavorite("200", "qq:track", false, "uin=200; qqmusic_key=expired");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        AccountLoginRequiredException failure = assertThrows(AccountLoginRequiredException.class,
            () -> service.removeFavorite("qq", "qq:track"));

        assertEquals("QQ 音乐登录已失效，请重新登录", failure.getMessage());
    }

    @Test
    void refusesAccountContentWhenNoActiveAccountExists() {
        AccountRepository repository = mock(AccountRepository.class);
        when(repository.findActive("netease")).thenReturn(Optional.empty());
        AccountCatalogService service = new AccountCatalogService(
            repository, mock(CredentialStore.class), List.of(mock(MusicProvider.class))
        );

        assertThrows(AccountLoginRequiredException.class, () -> service.loadRecommendations("netease"));
    }

    @Test
    void resolvesCredentialInsideBackendBeforeCallingProvider() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "netease", "100", "测试用户", null, "credential-1", true,
            "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        );
        when(repository.findActive("netease")).thenReturn(Optional.of(account));
        when(credentials.get("credential-1")).thenReturn(Optional.of("MUSIC_U=secret"));
        when(provider.id()).thenReturn("netease");
        when(provider.loadAccountRecommendations("100", "MUSIC_U=secret"))
            .thenReturn(List.of(new Track(
                "netease:1", "歌曲", "歌手", "专辑", 180L, "netease", null, null,
                null, null, null, null, null, null
            )));

        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        service.loadRecommendations("netease");

        verify(credentials).get("credential-1");
        verify(provider).loadAccountRecommendations("100", "MUSIC_U=secret");
    }

    @Test
    void resolvesTheAccountAndProviderRequestedByTheRoute() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider netease = mock(MusicProvider.class);
        MusicProvider qq = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=o200; qm_keyst=secret"));
        when(netease.id()).thenReturn("netease");
        when(qq.id()).thenReturn("qq");
        when(qq.loadAccountRecommendations("200", "uin=o200; qm_keyst=secret")).thenReturn(List.of());

        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(netease, qq));
        service.loadRecommendations("qq");

        verify(qq).loadAccountRecommendations("200", "uin=o200; qm_keyst=secret");
    }

    @Test
    void updatesPlaylistSubscriptionThroughTheActiveProviderAccount() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=o200; qm_keyst=secret"));
        when(provider.id()).thenReturn("qq");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        assertTrue(service.setPlaylistSubscribed("qq", "qq:778899", true));

        verify(provider).setPlaylistSubscription("200", "qq:778899", true, "uin=o200; qm_keyst=secret");
    }

    @Test
    void reportsPlaylistSubscriptionAsUnsyncedWhenTheProviderRejectsIt() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=o200; qm_keyst=secret"));
        when(provider.id()).thenReturn("qq");
        org.mockito.Mockito.doThrow(new IllegalStateException("invalid request"))
            .when(provider).setPlaylistSubscription("200", "qq:778899", true, "uin=o200; qm_keyst=secret");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        assertFalse(service.setPlaylistSubscribed("qq", "qq:778899", true));
        org.mockito.Mockito.doThrow(new IllegalStateException("unsubscribe rejected"))
            .when(provider).setPlaylistSubscription("200", "qq:778899", false, "uin=o200; qm_keyst=secret");
        IllegalStateException failure = assertThrows(IllegalStateException.class,
            () -> service.setPlaylistSubscribed("qq", "qq:778899", false));
        assertEquals("unsubscribe rejected", failure.getMessage());
    }

    @Test
    void forwardsCompletePlaylistOrderWithTheActiveCredential() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentials.get("credential-qq")).thenReturn(Optional.of("uin=o200; qm_keyst=secret"));
        when(provider.id()).thenReturn("qq");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        service.reorderPlaylistTracks("qq", "qq:900", List.of("qq:b", "qq:a"), List.of("qq:a", "qq:b"));

        verify(provider).reorderAccountPlaylistTracks(
            "200", "qq:900", List.of("qq:b", "qq:a"), List.of("qq:a", "qq:b"), "uin=o200; qm_keyst=secret"
        );
    }

    @Test
    void refusesLegacyUnknownNeteaseUidBeforeCallingPrivateApis() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        MusicProvider provider = mock(MusicProvider.class);
        ProviderAccount account = new ProviderAccount(
            "netease", "unknown", "旧登录", null, "credential-1", true,
            "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        );
        when(repository.findActive("netease")).thenReturn(Optional.of(account));
        when(provider.id()).thenReturn("netease");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(provider));

        assertThrows(AccountLoginRequiredException.class, () -> service.loadFavorites("netease"));
    }

    @Test
    void refusesToScrobbleATrackFromAnotherSource() {
        AccountCatalogService service = new AccountCatalogService(
            mock(AccountRepository.class), mock(CredentialStore.class), List.of(mock(MusicProvider.class))
        );

        assertThrows(
            IllegalArgumentException.class,
            () -> service.scrobble("netease", "local:123", "本地歌曲", "本地歌手", 30, 180)
        );
    }

    @Test
    void usesLocalStatsForQqRankingAndKeepsNeteaseProviderRanking() {
        AccountRepository repository = mock(AccountRepository.class);
        CredentialStore credentials = mock(CredentialStore.class);
        QqListeningStatsService qqStats = mock(QqListeningStatsService.class);
        MusicProvider netease = mock(MusicProvider.class);
        ProviderAccount qqAccount = new ProviderAccount(
            "qq", "200", "QQ用户", null, "credential-qq", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        ProviderAccount neteaseAccount = new ProviderAccount(
            "netease", "100", "网易云用户", null, "credential-ne", true,
            "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        );
        when(repository.findActive("qq")).thenReturn(Optional.of(qqAccount));
        when(repository.findActive("netease")).thenReturn(Optional.of(neteaseAccount));
        when(credentials.get("credential-ne")).thenReturn(Optional.of("MUSIC_U=secret"));
        when(netease.id()).thenReturn("netease");
        AccountCatalogService service = new AccountCatalogService(repository, credentials, List.of(netease), qqStats);

        service.loadListeningRank("qq", "week", null, null);
        service.loadListeningRank("netease", "all", null, null);

        verify(qqStats).loadRanking("200", "7d", null, null);
        verify(netease).loadAccountListeningRank("100", "MUSIC_U=secret", "all");
    }

    @Test
    void recordsQqDeltasAgainstTheCapturedQqAccount() {
        AccountRepository repository = mock(AccountRepository.class);
        QqListeningStatsService qqStats = mock(QqListeningStatsService.class);
        Track track = new Track(
            "qq:mid", "歌曲", "歌手", "专辑", 180L, "qq", null, null,
            null, null, null, null, null, null
        );
        AccountCatalogService service = new AccountCatalogService(
            repository, mock(CredentialStore.class), List.of(), qqStats
        );

        service.recordQqListeningDelta("qq", "200", "QQ用户", "avatar", track, 15, 0);

        verify(qqStats).recordDelta("200", "QQ用户", "avatar", track, 15, 0);
        assertThrows(IllegalArgumentException.class,
            () -> service.recordQqListeningDelta("netease", "200", "QQ用户", "avatar", track, 15, 0));
    }
}
