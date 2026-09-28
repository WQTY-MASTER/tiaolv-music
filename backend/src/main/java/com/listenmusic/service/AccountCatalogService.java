package com.listenmusic.service;

import com.listenmusic.auth.AccountView;
import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.AccountProfile;
import com.listenmusic.provider.AccountSocialUser;
import com.listenmusic.provider.CloudTrack;
import com.listenmusic.provider.CloudUpload;
import com.listenmusic.provider.LyricData;
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

    public List<CloudTrack> loadCloudTracks(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountCloudTracks(
            context.account().providerUserId(), context.credential()
        ));
    }

    public CloudTrack uploadCloudTrack(String provider, CloudUpload upload) {
        if (upload == null || upload.bytes() == null || upload.bytes().length == 0) {
            throw new IllegalArgumentException("请选择非空音频文件");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().uploadAccountCloudTrack(
            context.account().providerUserId(), context.credential(), upload
        ));
    }

    public Optional<LyricData> loadCloudLyrics(String provider, String trackId) {
        if (trackId == null || trackId.isBlank()) {
            throw new IllegalArgumentException("云盘歌曲 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountCloudLyrics(
            context.account().providerUserId(), trackId, context.credential()
        ));
    }

    public void scrobble(
        String provider,
        String trackId,
        String title,
        String artist,
        long listenedSeconds,
        long totalSeconds
    ) {
        if (trackId == null || trackId.isBlank()) {
            throw new IllegalArgumentException("歌曲 ID 不能为空");
        }
        String providerKey = provider == null ? "" : provider.trim().toLowerCase();
        if (providerKey.isBlank() || !trackId.startsWith(providerKey + ":")) {
            throw new IllegalArgumentException("歌曲来源与账号音乐源不一致");
        }
        if (listenedSeconds < 30) {
            throw new IllegalArgumentException("有效播放时长不能少于 30 秒");
        }
        if (totalSeconds <= 0) {
            throw new IllegalArgumentException("歌曲总时长必须大于 0");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().scrobble(
                context.account().providerUserId(),
                trackId,
                title,
                artist,
                listenedSeconds,
                totalSeconds,
                context.credential()
            );
            return null;
        });
    }

    public List<HomepagePlaylist> loadPlaylists(String provider) {
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountPlaylists(
            context.account().providerUserId(), context.credential()
        ));
    }

    public HomepagePlaylist createPlaylist(String provider, String name) {
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isBlank()) {
            throw new IllegalArgumentException("歌单名不能为空");
        }
        if (normalizedName.length() > 40) {
            throw new IllegalArgumentException("歌单名不能超过 40 个字符");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().createAccountPlaylist(
            context.account().providerUserId(), normalizedName, context.credential()
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

    public boolean isArtistSubscribed(String provider, String artistId) {
        if (artistId == null || artistId.isBlank()) {
            throw new IllegalArgumentException("歌手 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().isArtistSubscribed(
            context.account().providerUserId(), artistId, context.credential()
        ));
    }

    public void setArtistSubscribed(String provider, String artistId, boolean subscribed) {
        if (artistId == null || artistId.isBlank()) {
            throw new IllegalArgumentException("歌手 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().setArtistSubscription(
                context.account().providerUserId(), artistId, subscribed, context.credential()
            );
            return null;
        });
    }

    public boolean setPlaylistSubscribed(String provider, String playlistId, boolean subscribed) {
        if (playlistId == null || playlistId.isBlank()) {
            throw new IllegalArgumentException("歌单 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        try {
            accountCall(() -> {
                context.provider().setPlaylistSubscription(
                    context.account().providerUserId(), playlistId, subscribed, context.credential()
                );
                return null;
            });
            return true;
        } catch (IllegalStateException ex) {
            return false;
        }
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
