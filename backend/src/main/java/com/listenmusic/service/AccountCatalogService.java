package com.listenmusic.service;

import com.listenmusic.auth.AccountView;
import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.AccountProfile;
import com.listenmusic.provider.AccountSocialUser;
import com.listenmusic.provider.ProviderLoginRequiredException;
import com.listenmusic.repository.AccountRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AccountCatalogService {
    private static final String DEFAULT_ACCOUNT_PROVIDER = "netease";
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;
    private final List<MusicProvider> providers;

    public AccountCatalogService(
        AccountRepository accountRepository,
        CredentialStore credentialStore,
        List<MusicProvider> providers
    ) {
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
        this.providers = providers;
    }

    public Optional<AccountView> currentAccount() {
        return accountRepository.findActive(DEFAULT_ACCOUNT_PROVIDER).map(this::toView);
    }

    public List<Track> loadRecommendations(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountRecommendations(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<Track> loadPrivateRadar(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountPrivateRadar(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<Track> loadPrivateRoaming(String provider, String mode, String scene) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountPrivateRoaming(
            context.account().providerUserId(), context.credential(), mode, scene
        ));
    }

    public List<Track> loadFavorites(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountFavorites(
            context.account().providerUserId(), context.credential()
        ));
    }

    public AccountProfile loadProfile(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountProfile(
            context.account().providerUserId(), context.credential()
        ));
    }

    public AccountProfile loadUserProfile(String provider, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("用户 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadUserProfile(userId, context.credential()));
    }

    public List<AccountSocialUser> loadFollowing(String provider, int limit, int offset) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountFollowing(
            context.account().providerUserId(), context.credential(), limit, offset
        ));
    }

    public List<AccountSocialUser> loadFollowers(String provider, int limit, int offset) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountFollowers(
            context.account().providerUserId(), context.credential(), limit, offset
        ));
    }

    public List<Track> loadRecentTracks(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountRecentTracks(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<Track> loadListeningRank(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountListeningRank(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<HomepagePlaylist> loadPlaylists(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountPlaylists(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<HomepagePlaylist> loadFeaturedPlaylists(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountFeaturedPlaylists(
            context.account().providerUserId(), context.credential()
        ));
    }

    public List<Track> loadPlaylist(String provider, String playlistId) {
        if (playlistId == null || playlistId.isBlank()) {
            throw new IllegalArgumentException("歌单 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountPlaylist(
            playlistId, context.account().providerUserId(), context.credential()
        ));
    }

    public void addFavorite(String provider, Track track) {
        if (track == null || track.id() == null || track.id().isBlank()) {
            throw new IllegalArgumentException("歌曲 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().setAccountFavorite(
                context.account().providerUserId(), track.id(), true, context.credential()
            );
            return null;
        });
    }

    public void removeFavorite(String provider, String trackId) {
        if (trackId == null || trackId.isBlank()) {
            throw new IllegalArgumentException("歌曲 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().setAccountFavorite(
                context.account().providerUserId(), trackId, false, context.credential()
            );
            return null;
        });
    }

    private AccountContext accountContext(String providerId) {
        String providerKey = providerId == null ? "" : providerId.trim().toLowerCase();
        if (providerKey.isBlank()) {
            throw new IllegalArgumentException("音乐源不能为空");
        }
        ProviderAccount account = accountRepository.findActive(providerKey)
            .orElseThrow(AccountLoginRequiredException::new);
        if (account.providerUserId() == null
            || account.providerUserId().isBlank()
            || "unknown".equalsIgnoreCase(account.providerUserId().trim())) {
            throw new AccountLoginRequiredException();
        }
        String reference = account.credentialReference();
        if (reference == null || reference.isBlank()) {
            throw new AccountLoginRequiredException();
        }
        String credential = credentialStore.get(reference).orElseThrow(AccountLoginRequiredException::new);
        MusicProvider provider = providers.stream()
            .filter(candidate -> candidate.id().equalsIgnoreCase(providerKey))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("未找到音乐源: " + account.provider()));
        return new AccountContext(account, provider, credential);
    }

    private static <T> T accountCall(AccountOperation<T> operation) {
        try {
            return operation.call();
        } catch (ProviderLoginRequiredException ex) {
            throw new AccountLoginRequiredException();
        }
    }

    private AccountView toView(ProviderAccount account) {
        return new AccountView(account.provider(), account.providerUserId(), account.nickname(), account.avatarUrl());
    }

    private record AccountContext(ProviderAccount account, MusicProvider provider, String credential) {
    }

    @FunctionalInterface
    private interface AccountOperation<T> {
        T call();
    }
}
