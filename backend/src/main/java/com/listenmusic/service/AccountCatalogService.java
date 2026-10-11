package com.listenmusic.service;

import com.listenmusic.auth.AccountView;
import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.domain.QqListeningDataSummary;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.MusicProvider;
import com.listenmusic.provider.RecentTracksDeleteResult;
import com.listenmusic.provider.AccountProfile;
import com.listenmusic.provider.AccountSocialUser;
import com.listenmusic.provider.CloudTrack;
import com.listenmusic.provider.CloudUpload;
import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.SearchType;
import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.provider.ProviderLoginRequiredException;
import com.listenmusic.repository.AccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Optional;
import java.util.ArrayList;
import java.time.LocalDate;

@Service
public class AccountCatalogService {
    private static final String DEFAULT_ACCOUNT_PROVIDER = "netease";
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;
    private final List<MusicProvider> providers;
    private final QqListeningStatsService qqListeningStatsService;

    @Autowired
    public AccountCatalogService(
        AccountRepository accountRepository,
        CredentialStore credentialStore,
        List<MusicProvider> providers,
        QqListeningStatsService qqListeningStatsService
    ) {
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
        this.providers = providers;
        this.qqListeningStatsService = qqListeningStatsService;
    }

    AccountCatalogService(
        AccountRepository accountRepository,
        CredentialStore credentialStore,
        List<MusicProvider> providers
    ) {
        this(accountRepository, credentialStore, providers, null);
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

    public RecentTracksDeleteResult deleteRecentTracks(String provider, List<String> trackIds) {
        List<String> normalizedIds = trackIds == null ? List.of() : trackIds.stream()
            .filter(java.util.Objects::nonNull)
            .map(String::trim)
            .filter(id -> !id.isBlank())
            .distinct()
            .toList();
        if (normalizedIds.isEmpty() || normalizedIds.size() > 100) {
            throw new IllegalArgumentException("请选择 1 到 100 首歌曲");
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().deleteAccountRecentTracks(
            context.account().providerUserId(), normalizedIds, context.credential()
        ));
    }

    public List<?> loadListeningRank(String provider) {
        return loadListeningRank(provider, "week", null, null);
    }

    public List<?> loadListeningRank(String provider, String period, String from, String to) {
        String providerKey = normalizeProvider(provider);
        if ("qq".equals(providerKey)) {
            ProviderAccount account = activeAccount(providerKey);
            String localPeriod = "week".equalsIgnoreCase(period) ? "7d" : period;
            return qqListeningStatsService.loadRanking(account.providerUserId(), localPeriod, from, to);
        }
        AccountContext context = accountContext(provider);
        return accountCall(() -> context.provider().loadAccountListeningRank(
            context.account().providerUserId(), context.credential(), period
        ));
    }

    public void recordQqListeningDelta(
        String provider,
        String accountId,
        String accountNickname,
        String accountAvatarUrl,
        Track track,
        double listenedSeconds,
        int playCount
    ) {
        String providerKey = normalizeProvider(provider);
        if (!"qq".equals(providerKey)) {
            throw new IllegalArgumentException("本地听歌排行只适用于 QQ 音乐");
        }
        qqListeningStatsService.recordDelta(
            accountId, accountNickname, accountAvatarUrl, track, listenedSeconds, playCount
        );
    }

    public List<QqListeningDataSummary> loadQqListeningDataSummaries() {
        return qqListeningStatsService.summaries();
    }

    public void deleteQqListeningStats(String accountId, boolean all, String from, String to) {
        qqListeningStatsService.delete(accountId, all, from, to);
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
        if ("qq".equals(context.provider().id()) && qqListeningStatsService != null) {
            return loadQqFeaturedPlaylists(context);
        }
        return accountCall(() -> context.provider().loadAccountFeaturedPlaylists(
            context.account().providerUserId(), context.credential()
        ));
    }

    private List<HomepagePlaylist> loadQqFeaturedPlaylists(AccountContext context) {
        String accountId = context.account().providerUserId();
        List<HomepagePlaylist> official = List.of();
        IllegalStateException upstreamFailure = null;
        try {
            official = context.provider().loadAccountFeaturedPlaylists(accountId, context.credential());
        } catch (IllegalStateException error) {
            upstreamFailure = error;
        }
        List<QqListeningRankEntry> ranking = List.of();
        List<Track> favorites = List.of();
        try {
            LocalDate today = LocalDate.now();
            ranking = qqListeningStatsService.loadRanking(accountId, "custom", today.minusDays(29).toString(), today.toString());
        } catch (RuntimeException ignored) {
            // Optional local data must not hide the provider's available recommendations.
        }
        try {
            favorites = context.provider().loadAccountFavorites(accountId, context.credential());
        } catch (IllegalStateException ignored) {
            // Listening preferences still work when favorites cannot be loaded.
        }
        List<HomepagePlaylist> related = new ArrayList<>();
        for (String term : QqPlaylistPreferences.searchTerms(ranking, favorites)) {
            try {
                var page = context.provider().search(term, SearchType.PLAYLIST, 6, 0);
                if (page == null) continue;
                page.playlists().stream().limit(2).forEach(item -> related.add(new HomepagePlaylist(
                    item.id(), item.title(), item.subtitle(), item.imageUrl(), item.count()
                ).withRecommendation("local-listening", term)));
            } catch (IllegalStateException ignored) {
                // Try other preferences if one playlist search is unavailable.
            }
        }
        List<HomepagePlaylist> result = QqPlaylistPreferences.blend(official, related);
        if (result.isEmpty() && upstreamFailure != null) {
            IllegalStateException failure = upstreamFailure;
            return accountCall(() -> { throw failure; });
        }
        return result;
    }

    public void deletePlaylist(String provider, String playlistId) {
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().deleteAccountPlaylist(context.account().providerUserId(), playlistId, context.credential());
            return true;
        });
    }

    public void removePlaylistTrack(String provider, String playlistId, String trackId) {
        if (playlistId == null || playlistId.isBlank() || trackId == null || trackId.isBlank()) {
            throw new IllegalArgumentException("歌单和歌曲 ID 不能为空");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().removeAccountPlaylistTrack(context.account().providerUserId(), playlistId, trackId, context.credential());
            return true;
        });
    }

    public void addPlaylistTracks(String provider, String playlistId, List<String> trackIds) {
        List<String> normalizedIds = trackIds == null ? List.of() : trackIds.stream()
            .filter(java.util.Objects::nonNull)
            .map(String::trim)
            .filter(id -> !id.isBlank())
            .distinct()
            .toList();
        if (playlistId == null || playlistId.isBlank() || normalizedIds.isEmpty() || normalizedIds.size() > 100) {
            throw new IllegalArgumentException("歌单 ID 和 1 到 100 首歌曲不能为空");
        }
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().addAccountPlaylistTracks(
                context.account().providerUserId(), playlistId, normalizedIds, context.credential()
            );
            return true;
        });
    }

    public void reorderPlaylistTracks(String provider, String playlistId, List<String> trackIds, List<String> previousTrackIds) {
        AccountContext context = accountContext(provider);
        accountCall(() -> {
            context.provider().reorderAccountPlaylistTracks(context.account().providerUserId(), playlistId, trackIds, previousTrackIds, context.credential());
            return true;
        });
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

    public List<Track> reportRecentPlay(
        String accountId, String trackId, String sessionId, long listenedSeconds, long totalSeconds
    ) {
        if (accountId == null || accountId.isBlank() || trackId == null || !trackId.matches("qq:[a-zA-Z0-9]{1,64}")
            || sessionId == null || !sessionId.matches("(?i)[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}")
            || listenedSeconds < 30 || totalSeconds <= 0 || listenedSeconds > totalSeconds) {
            throw new IllegalArgumentException("最近播放上报需要有效会话和至少 30 秒真实播放");
        }
        if (!accountId.equals(activeAccount("qq").providerUserId())) {
            throw new IllegalArgumentException("QQ 账号已切换，本次播放不会上报到其他账号");
        }
        AccountContext context = accountContext("qq");
        if (!accountId.equals(context.account().providerUserId())) {
            throw new IllegalArgumentException("QQ 账号已切换，本次播放不会上报到其他账号");
        }
        return accountCall(() -> context.provider().reportAccountRecentTrack(
            accountId, trackId, sessionId, listenedSeconds, totalSeconds, context.credential()
        ));
    }

    private AccountContext accountContext(String providerId) {
        String providerKey = normalizeProvider(providerId);
        ProviderAccount account = activeAccount(providerKey);
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

    private ProviderAccount activeAccount(String providerKey) {
        ProviderAccount account = accountRepository.findActive(providerKey)
            .orElseThrow(AccountLoginRequiredException::new);
        if (account.providerUserId() == null
            || account.providerUserId().isBlank()
            || "unknown".equalsIgnoreCase(account.providerUserId().trim())) {
            throw new AccountLoginRequiredException();
        }
        return account;
    }

    private static String normalizeProvider(String providerId) {
        String providerKey = providerId == null ? "" : providerId.trim().toLowerCase();
        if (providerKey.isBlank()) {
            throw new IllegalArgumentException("音乐源不能为空");
        }
        return providerKey;
    }

    private static <T> T accountCall(AccountOperation<T> operation) {
        try {
            return operation.call();
        } catch (ProviderLoginRequiredException ex) {
            throw new AccountLoginRequiredException(ex.getMessage());
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
