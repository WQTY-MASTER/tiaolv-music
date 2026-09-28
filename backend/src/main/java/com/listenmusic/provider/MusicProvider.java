package com.listenmusic.provider;

import com.listenmusic.domain.Track;

import java.util.List;
import java.util.Optional;

public interface MusicProvider {
    String id();

    List<Track> search(String query);

    default SearchResultPage search(String query, SearchType type, int limit, int offset) {
        if (type != SearchType.SONG) {
            return SearchResultPage.empty();
        }
        List<Track> matches = search(query);
        int start = Math.max(0, Math.min(offset, matches.size()));
        int end = Math.min(matches.size(), start + Math.max(1, limit));
        return new SearchResultPage(
            List.copyOf(matches.subList(start, end)), List.of(), List.of(), matches.size(), end < matches.size()
        );
    }

    Optional<Track> find(String trackId);

    Optional<String> resolveAudioUrl(String trackId);

    Optional<LyricData> loadLyrics(String trackId);

    default List<Track> loadPlaylist(String playlistId) {
        return List.of();
    }

    default ArtistDetail loadArtistDetail(String artistId) {
        return new ArtistDetail(id(), artistId, "", "", "", 0, 0);
    }

    default List<Track> loadArtistTopSongs(String artistId) {
        return List.of();
    }

    default ArtistSongPage loadArtistSongs(String artistId, String order, int limit, int offset) {
        return new ArtistSongPage(List.of(), 0, false);
    }

    default List<ArtistAlbum> loadArtistAlbums(String artistId, int limit, int offset) {
        return List.of();
    }

    default HomepageData loadHomepage(boolean refresh, String cursor) {
        return HomepageData.empty();
    }

    default HomepageData loadDiscovery(boolean refresh, String cursor) {
        return HomepageData.empty();
    }

    default PlaylistCategoryData loadPlaylistCategories() {
        return new PlaylistCategoryData(List.of("全部"), java.util.Map.of(), List.of("全部"));
    }

    default PlaylistDiscoveryPage loadPlaylists(String category, String order, int limit, int offset) {
        return new PlaylistDiscoveryPage(List.of(), 0, false, null);
    }

    default PlaylistDiscoveryPage loadHighQualityPlaylists(String category, int limit, String before) {
        return new PlaylistDiscoveryPage(List.of(), 0, false, null);
    }

    default void updatePlaylistPlayCount(String playlistId) {
    }

    default List<Track> loadDailyRecommendations() {
        return List.of();
    }

    /** Account-scoped content receives its credential only inside the backend. */
    default List<Track> loadAccountRecommendations(String accountId, String credential) {
        return List.of();
    }

    default List<Track> loadAccountPrivateRadar(String accountId, String credential) {
        return List.of();
    }

    default List<Track> loadAccountPrivateRoaming(
        String accountId,
        String credential,
        String mode,
        String scene
    ) {
        return List.of();
    }

    default List<Track> loadAccountFavorites(String accountId, String credential) {
        return List.of();
    }

    default AccountProfile loadAccountProfile(String accountId, String credential) {
        return new AccountProfile(id(), accountId, "", "", "", 0, 0);
    }

    default AccountProfile loadUserProfile(String userId, String credential) {
        return new AccountProfile(id(), userId, "", "", "", 0, 0);
    }

    default List<AccountSocialUser> loadAccountFollowing(
        String accountId,
        String credential,
        int limit,
        int offset
    ) {
        return List.of();
    }

    default List<AccountSocialUser> loadAccountFollowers(
        String accountId,
        String credential,
        int limit,
        int offset
    ) {
        return List.of();
    }

    default List<Track> loadAccountRecentTracks(String accountId, String credential) {
        return List.of();
    }

    default List<Track> loadAccountListeningRank(String accountId, String credential) {
        return List.of();
    }

    default List<CloudTrack> loadAccountCloudTracks(String accountId, String credential) {
        throw new UnsupportedOperationException("该音乐源暂不支持音乐云盘");
    }

    default CloudTrack uploadAccountCloudTrack(String accountId, String credential, CloudUpload upload) {
        throw new UnsupportedOperationException("该音乐源暂不支持音乐云盘上传");
    }

    default Optional<LyricData> loadAccountCloudLyrics(String accountId, String trackId, String credential) {
        return Optional.empty();
    }

    default void scrobble(
        String accountId,
        String trackId,
        String title,
        String artist,
        long listenedSeconds,
        long totalSeconds,
        String credential
    ) {
        throw new UnsupportedOperationException("该音乐源暂不支持听歌打卡");
    }

    default List<HomepagePlaylist> loadAccountPlaylists(String accountId, String credential) {
        return List.of();
    }

    default HomepagePlaylist createAccountPlaylist(String accountId, String name, String credential) {
        throw new UnsupportedOperationException("该音乐源暂不支持创建歌单");
    }

    default List<HomepagePlaylist> loadAccountFeaturedPlaylists(String accountId, String credential) {
        return List.of();
    }

    default List<Track> loadAccountPlaylist(String playlistId, String accountId, String credential) {
        return loadPlaylist(playlistId);
    }

    default void setAccountFavorite(String accountId, String trackId, boolean liked, String credential) {
        throw new UnsupportedOperationException("该音乐源暂不支持账号收藏");
    }

    default boolean isArtistSubscribed(String accountId, String artistId, String credential) {
        return false;
    }

    default void setArtistSubscription(String accountId, String artistId, boolean subscribed, String credential) {
        throw new UnsupportedOperationException("该音乐源暂不支持关注歌手");
    }

    default void setPlaylistSubscription(String accountId, String playlistId, boolean subscribed, String credential) {
        throw new UnsupportedOperationException("该音乐源暂不支持收藏歌单");
    }

    default Optional<CoverData> loadCover(String trackId) {
        return Optional.empty();
    }
}
