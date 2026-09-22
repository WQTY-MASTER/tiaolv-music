package com.listenmusic.service;

import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountCatalogServiceTest {
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
}
