package com.listenmusic.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class QqMusicProvider implements MusicProvider {
    private static final String PROVIDER_ID = "qq";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;
    private final Map<String, Integer> playlistCategoryIds = new LinkedHashMap<>();

    public QqMusicProvider(
        RestClient.Builder restClientBuilder,
        @Value("${listenmusic.providers.qq.base-url:http://127.0.0.1:3300}") String baseUrl,
        AccountRepository accountRepository,
        CredentialStore credentialStore
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
        playlistCategoryIds.put("全部", 10000000);
    }

    @Override
    public String id() {
        return PROVIDER_ID;
    }

    @Override
    public List<Track> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSearchByKey")
            .queryParam("key", query.trim())
            .queryParam("limit", 30)
            .queryParam("page", 1)
            .queryParam("remoteplace", "song")
            .build(), null);
        return tracksFrom(root);
    }

    @Override
    public SearchResultPage search(String query, SearchType type, int limit, int offset) {
        if (query == null || query.isBlank()) {
            return SearchResultPage.empty();
        }
        int pageSize = Math.max(1, Math.min(limit, 50));
        int pageOffset = Math.max(0, offset);
        int pageNumber = pageOffset / pageSize + 1;
        JsonNode root = switch (type) {
            case SONG -> get(uriBuilder -> uriBuilder
                .path("/getSearchByKey")
                .queryParam("key", query.trim())
                .queryParam("limit", pageSize)
                .queryParam("page", pageNumber)
                .queryParam("remoteplace", "song")
                .build(), null);
            case PLAYLIST -> get(uriBuilder -> uriBuilder
                .path("/searchByType")
                .queryParam("key", query.trim())
                .queryParam("limit", pageSize)
                .queryParam("page", pageNumber)
                .queryParam("type", "playlist")
                .build(), activeCredential().orElse(null));
            case ARTIST -> get(uriBuilder -> uriBuilder
                .path("/searchByType")
                .queryParam("key", query.trim())
                .queryParam("limit", pageSize)
                .queryParam("page", pageNumber)
                .queryParam("type", "artist")
                .build(), activeCredential().orElse(null));
        };
        ensureSuccess(root);

        JsonNode data = firstObject(
            root, "response/req_1/data", "response/data", "data"
        );
        if (data == null) {
            data = OBJECT_MAPPER.createObjectNode();
        }
        JsonNode items = switch (type) {
            case SONG -> firstArray(
                root, "response/data/song/list", "data/song/list", "data/list", "data/body/song/list", "list"
            );
            case PLAYLIST -> firstArray(
                root,
                "response/req_1/data/body/songlist/list",
                "response/data/playlist/list",
                "data/playlist/list",
                "data/body/playlist/list"
            );
            case ARTIST -> firstArray(
                root,
                "response/req_1/data/body/singer/list",
                "response/data/singer/itemlist",
                "data/singer/itemlist",
                "response/data/singer/list",
                "data/singer/list",
                "data/body/singer/list"
            );
        };
        if (items == null) {
            items = OBJECT_MAPPER.createArrayNode();
        }
        List<Track> songs = new ArrayList<>();
        List<PlaylistDiscoveryItem> playlists = new ArrayList<>();
        List<SearchArtist> artists = new ArrayList<>();
        for (JsonNode item : items) {
            switch (type) {
                case SONG -> {
                    JsonNode song = item.path("songInfo").isObject() ? item.path("songInfo") : item;
                    if (!songId(song).isBlank()) {
                        songs.add(toTrack(song));
                    }
                }
                case PLAYLIST -> {
                    String id = firstText(item.path("dissid"), item.path("tid"), item.path("id"));
                    String title = firstText(item.path("dissname"), item.path("title"), item.path("name"));
                    if (!id.isBlank() && !title.isBlank()) {
                        playlists.add(new PlaylistDiscoveryItem(
                            PROVIDER_ID + ":" + id,
                            title,
                            firstNonBlank(firstText(item.path("creator_name"), item.path("creator").path("name")), "QQ 音乐歌单"),
                            firstText(item.path("imgurl"), item.path("logo"), item.path("picurl"), item.path("cover")),
                            firstInt(item.path("songnum"), item.path("song_count"), item.path("count")),
                            item.path("listennum").asLong(item.path("playCount").asLong(0))
                        ));
                    }
                }
                case ARTIST -> {
                    String id = firstText(
                        item.path("singermid"), item.path("singerMID"), item.path("mid"), item.path("id")
                    );
                    String name = firstText(
                        item.path("singername"), item.path("singerName"), item.path("name"), item.path("title")
                    );
                    if (!id.isBlank() && !name.isBlank()) {
                        String imageUrl = firstText(
                            item.path("singerPic"), item.path("pic"), item.path("picurl"), item.path("avatar")
                        );
                        if (imageUrl.isBlank()) {
                            imageUrl = "https://y.gtimg.cn/music/photo_new/T001R300x300M000" + id + ".jpg";
                        }
                        artists.add(new SearchArtist(
                            PROVIDER_ID + ":" + id,
                            name,
                            imageUrl,
                            firstInt(item.path("albumNum"), item.path("album_count"), item.path("albumnum")),
                            firstInt(item.path("songNum"), item.path("song_count"), item.path("songnum")),
                            PROVIDER_ID
                        ));
                    }
                }
            }
        }
        int resultCount = switch (type) {
            case SONG -> songs.size();
            case PLAYLIST -> playlists.size();
            case ARTIST -> artists.size();
        };
        long total = switch (type) {
            case SONG -> firstLong(
                data.path("song").path("totalnum"), data.path("total"), data.path("totalnum"), data.path("sum")
            );
            case PLAYLIST -> firstLong(
                data.path("meta").path("sum"), data.path("playlist").path("totalnum")
            );
            case ARTIST -> firstLong(
                data.path("meta").path("sum"), data.path("singer").path("totalnum")
            );
        };
        if (total <= 0) {
            total = pageOffset + resultCount;
        }
        return new SearchResultPage(
            List.copyOf(songs), List.copyOf(playlists), List.copyOf(artists), total,
            pageOffset + resultCount < total
        );
    }

    @Override
    public ArtistDetail loadArtistDetail(String artistId) {
        String id = rawId(artistId);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSingerHotsong")
            .queryParam("singermid", id)
            .queryParam("limit", 1)
            .queryParam("page", 1)
            .build(), activeCredential().orElse(null));
        ensureSuccess(root);
        JsonNode data = firstObject(root, "response/singer/data", "singer/data", "data");
        if (data == null) {
            return new ArtistDetail(PROVIDER_ID, PROVIDER_ID + ":" + id, "", artistImageUrl(id), "", 0, 0);
        }
        JsonNode singer = data.path("singer_info").isObject() ? data.path("singer_info") : data;
        return new ArtistDetail(
            PROVIDER_ID,
            PROVIDER_ID + ":" + id,
            firstText(singer.path("name"), singer.path("singerName")),
            firstNonBlank(firstText(singer.path("pic"), singer.path("singerPic")), artistImageUrl(id)),
            firstText(data.path("singer_brief"), singer.path("desc"), singer.path("brief")),
            firstInt(data.path("total_album"), singer.path("albumNum")),
            firstInt(data.path("total_song"), singer.path("songNum"))
        );
    }

    @Override
    public List<Track> loadArtistTopSongs(String artistId) {
        return loadArtistSongs(artistId, "hot", 50, 0).songs();
    }

    @Override
    public ArtistSongPage loadArtistSongs(String artistId, String order, int limit, int offset) {
        String id = rawId(artistId);
        int pageSize = Math.max(1, Math.min(limit, 100));
        int pageOffset = Math.max(0, offset);
        int page = pageOffset / pageSize + 1;
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSingerHotsong")
            .queryParam("singermid", id)
            .queryParam("limit", pageSize)
            .queryParam("page", page)
            .build(), activeCredential().orElse(null));
        List<Track> songs = tracksFrom(root);
        JsonNode data = firstObject(root, "response/singer/data", "singer/data", "data");
        long total = data == null ? songs.size() : firstLong(data.path("total_song"), data.path("total"));
        if (total <= 0) {
            total = pageOffset + songs.size();
        }
        return new ArtistSongPage(List.copyOf(songs), total, pageOffset + songs.size() < total);
    }

    @Override
    public List<ArtistAlbum> loadArtistAlbums(String artistId, int limit, int offset) {
        String id = rawId(artistId);
        int pageSize = Math.max(1, Math.min(limit, 100));
        int pageOffset = Math.max(0, offset);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSingerAlbum")
            .queryParam("singermid", id)
            .queryParam("limit", pageSize)
            .queryParam("page", pageOffset)
            .build(), activeCredential().orElse(null));
        ensureSuccess(root);
        JsonNode albums = firstArray(root, "response/singer/data/albumList", "singer/data/albumList", "data/albumList");
        if (albums == null) {
            return List.of();
        }
        List<ArtistAlbum> result = new ArrayList<>();
        for (JsonNode album : albums) {
            String albumMid = firstText(album.path("albumMid"), album.path("mid"), album.path("id"));
            if (albumMid.isBlank()) {
                continue;
            }
            result.add(new ArtistAlbum(
                PROVIDER_ID + ":" + albumMid,
                firstNonBlank(firstText(album.path("albumName"), album.path("name")), "未命名专辑"),
                "https://y.gtimg.cn/music/photo_new/T002R300x300M000" + albumMid + ".jpg",
                firstInt(album.path("totalNum"), album.path("songNum"), album.path("count")),
                firstText(album.path("publishDate"), album.path("releaseDate"))
            ));
        }
        return List.copyOf(result);
    }

    @Override
    public boolean isArtistSubscribed(String accountId, String artistId, String credential) {
        requireCredential(accountId, credential);
        String id = rawId(artistId);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/user/getSingerSubscription")
            .queryParam("singermid", id)
            .build(), credential);
        ensureMusicuSuccess(root);
        return root.path("response")
            .path("req_1")
            .path("data")
            .path("map_singer_status")
            .path(id)
            .asInt(0) != 0;
    }

    @Override
    public void setArtistSubscription(
        String accountId,
        String artistId,
        boolean subscribed,
        String credential
    ) {
        requireCredential(accountId, credential);
        JsonNode root = post(
            "/user/setSingerSubscription",
            Map.of("singermid", rawId(artistId), "subscribed", subscribed),
            credential
        );
        ensureMusicuSuccess(root);
    }

    @Override
    public void setPlaylistSubscription(
        String accountId,
        String playlistId,
        boolean subscribed,
        String credential
    ) {
        requireCredential(accountId, credential);
        JsonNode root = post(
            "/user/setPlaylistSubscription",
            Map.of("id", rawId(playlistId), "subscribed", subscribed),
            credential
        );
        ensureSuccess(root);
    }

    private static String artistImageUrl(String artistMid) {
        return "https://y.gtimg.cn/music/photo_new/T001R300x300M000" + artistMid + ".jpg";
    }

    @Override
    public Optional<Track> find(String trackId) {
        String id = rawId(trackId);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/song")
            .queryParam("songmid", id)
            .build(), null);
        JsonNode song = firstObject(root, "data/track_info", "songinfo/data/track_info", "data", "songinfo");
        return song == null ? Optional.empty() : Optional.of(toTrack(song));
    }

    @Override
    public Optional<String> resolveAudioUrl(String trackId) {
        String id = rawId(trackId);
        String credential = activeCredential().orElse(null);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getMusicPlay")
            .queryParam("songmid", id)
            .queryParam("quality", 128)
            .build(), credential);
        ensureSuccess(root);
        String url = firstText(
            root.path("data").path("playUrl").path(id).path("url"),
            root.path("response").path("data").path("playUrl").path(id).path("url"),
            root.path("playUrl").path(id).path("url")
        );
        String error = firstText(
            root.path("data").path("playUrl").path(id).path("error"),
            root.path("response").path("data").path("playUrl").path(id).path("error"),
            root.path("playUrl").path(id).path("error")
        );
        if (url.isBlank() && isPlaybackLoginError(error)) {
            throw new ProviderLoginRequiredException("QQ 音乐登录已失效，请重新登录");
        }
        return url.isBlank() ? Optional.empty() : Optional.of(url);
    }

    private Optional<String> activeCredential() {
        return accountRepository.findActive(PROVIDER_ID)
            .map(ProviderAccount::credentialReference)
            .filter(reference -> !reference.isBlank())
            .flatMap(credentialStore::get)
            .filter(credential -> !credential.isBlank());
    }

    private static boolean isPlaybackLoginError(String error) {
        if (error == null || error.isBlank()) {
            return false;
        }
        String normalized = error.toLowerCase();
        return normalized.contains("cookie")
            || normalized.contains("uin")
            || normalized.contains("登录")
            || normalized.contains("login");
    }

    @Override
    public Optional<LyricData> loadLyrics(String trackId) {
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getLyric")
            .queryParam("songmid", rawId(trackId))
            .queryParam("isFormat", 1)
            .build(), activeCredential().orElse(null));
        ensureSuccess(root);
        JsonNode response = root.path("response").isObject() ? root.path("response") : root;
        JsonNode data = response.path("data").isObject() ? response.path("data") : response;
        String qrc = firstText(data.path("qrc"), root.path("qrc"));
        String lyric = qrc.isBlank()
            ? firstText(data.path("lyric"), root.path("lyric"))
            : qrc;
        if (lyric.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(new LyricData(
            lyric,
            firstText(data.path("trans"), data.path("translation"), response.path("trans")),
            qrc.isBlank() ? "LRC" : "QRC",
            PROVIDER_ID,
            List.of()
        ));
    }

    @Override
    public List<Track> loadAccountRecommendations(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getDailyRecommend")
            .build(), credential);
        return tracksFrom(root);
    }

    @Override
    public List<HomepagePlaylist> loadAccountPlaylists(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode createdRoot = get(uriBuilder -> uriBuilder
            .path("/user/getUserPlaylists")
            .queryParam("uin", accountId)
            .queryParam("offset", 0)
            .queryParam("limit", 100)
            .build(), credential);
        List<HomepagePlaylist> playlists = new ArrayList<>();
        appendAccountPlaylists(playlists, createdRoot, true);

        JsonNode collectedRoot = get(uriBuilder -> uriBuilder
            .path("/user/getUserCollectedSongLists")
            .queryParam("uin", accountId)
            .queryParam("page", 1)
            .queryParam("limit", 100)
            .build(), credential);
        appendAccountPlaylists(playlists, collectedRoot, false);
        return List.copyOf(playlists);
    }

    private void appendAccountPlaylists(List<HomepagePlaylist> playlists, JsonNode root, boolean createdByAccount) {
        ensureSuccess(root);
        JsonNode items = firstArray(
            root,
            "response/data/playlists", "response/data/list", "response/data/cdlist",
            "data/playlists", "data/list", "data/cdlist", "playlists", "list"
        );
        if (items == null) {
            return;
        }
        for (JsonNode item : items) {
            String id = firstText(item.path("dissid"), item.path("id"), item.path("tid"));
            String title = firstText(
                item.path("dissname"), item.path("diss_name"), item.path("title"), item.path("name")
            );
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(firstText(item.path("creator_name"), item.path("subtitle")), "QQ 音乐歌单"),
                firstText(
                    item.path("imgurl"), item.path("logo"), item.path("picurl"), item.path("cover"),
                    item.path("cover_url_small"), item.path("cover_url_medium")
                ),
                firstInt(item.path("songnum"), item.path("song_cnt"), item.path("song_count"), item.path("count")),
                createdByAccount
            ));
        }
    }

    @Override
    public AccountProfile loadAccountProfile(String accountId, String credential) {
        requireCredential(accountId, credential);
        Optional<ProviderAccount> cachedAccount = accountRepository.findActive(PROVIDER_ID)
            .filter(account -> accountId.equals(account.providerUserId()));
        AccountProfile cachedProfile = cachedAccount
            .map(QqMusicProvider::toAccountProfile)
            .orElseGet(() -> new AccountProfile(PROVIDER_ID, accountId, "", "", "", 0, 0));

        try {
            JsonNode root = get(uriBuilder -> uriBuilder
                .path("/user/getUserDetail")
                .queryParam("uin", accountId)
                .build(), credential);
            JsonNode response = firstObject(root, "response", "data");
            if (response != null && response.has("code") && response.path("code").asInt(0) != 0) {
                return cachedProfile;
            }
            JsonNode data = firstObject(root, "response/data", "data");
            if (data == null) {
                return cachedProfile;
            }
            JsonNode creator = data.path("creator").isObject()
                ? data.path("creator")
                : (data.path("profile").isObject() ? data.path("profile") : data);
            String nickname = firstNonBlank(firstText(
                creator.path("nick"), creator.path("nickname"), data.path("nick"), data.path("nickname")
            ), cachedProfile.nickname());
            String avatarUrl = firstNonBlank(firstText(
                creator.path("headpic"), creator.path("avatarUrl"), creator.path("avatar"),
                data.path("headpic"), data.path("avatarUrl")
            ), cachedProfile.avatarUrl());
            if (nickname.isBlank() && avatarUrl.isBlank()) {
                return cachedProfile;
            }
            AccountProfile refreshed = new AccountProfile(
                PROVIDER_ID,
                accountId,
                nickname,
                avatarUrl,
                firstText(
                    creator.path("desc"), creator.path("signature"), creator.path("introduction"),
                    data.path("desc"), data.path("signature")
                ),
                firstInt(
                    creator.path("nums").path("follownum"),
                    creator.path("follow"), creator.path("follows"), creator.path("follow_num"),
                    data.path("nums").path("follownum"), data.path("follow"), data.path("follows")
                ),
                firstInt(
                    creator.path("nums").path("fansnum"),
                    creator.path("fans"), creator.path("followers"), creator.path("fans_num"),
                    data.path("nums").path("fansnum"), data.path("fans"), data.path("followers")
                )
            );
            cachedAccount.ifPresent(account -> accountRepository.saveAccount(new ProviderAccount(
                account.provider(),
                account.providerUserId(),
                refreshed.nickname(),
                refreshed.avatarUrl(),
                account.credentialReference(),
                account.active(),
                account.createdAt(),
                OffsetDateTime.now().toString()
            )));
            return refreshed;
        } catch (RuntimeException ignored) {
            return cachedProfile;
        }
    }

    @Override
    public List<AccountSocialUser> loadAccountFollowing(String accountId, String credential, int limit, int offset) {
        requireCredential(accountId, credential);
        int pageSize = Math.max(1, Math.min(limit, 1000));
        int pageOffset = Math.max(0, offset);
        int page = pageOffset / pageSize + 1;
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/user/getUserFollowSingers")
            .queryParam("uin", accountId)
            .queryParam("page", page)
            .queryParam("limit", pageSize)
            .build(), credential);
        ensureMusicuSuccess(root);
        JsonNode items = firstArray(
            root,
            "response/req_1/data/vec_userinfo",
            "req_1/data/vec_userinfo",
            "data/vec_userinfo"
        );
        if (items == null) {
            return List.of();
        }

        List<AccountSocialUser> artists = new ArrayList<>();
        for (JsonNode item : items) {
            if (item.path("usertype").asInt(1) != 1) {
                continue;
            }
            String singerId = firstText(item.path("userid"), item.path("singerid"), item.path("id"));
            if (singerId.isBlank()) {
                continue;
            }
            JsonNode detailRoot = get(uriBuilder -> uriBuilder
                .path("/getSingerHotsong")
                .queryParam("singerid", singerId)
                .queryParam("limit", 1)
                .queryParam("page", 1)
                .build(), credential);
            ensureSuccess(detailRoot);
            JsonNode data = firstObject(detailRoot, "response/singer/data", "singer/data", "data");
            if (data == null) {
                continue;
            }
            JsonNode singer = data.path("singer_info").isObject() ? data.path("singer_info") : data;
            String singerMid = firstText(singer.path("mid"), singer.path("singerMid"));
            String name = firstText(singer.path("name"), singer.path("singerName"));
            if (singerMid.isBlank() || name.isBlank()) {
                continue;
            }
            artists.add(new AccountSocialUser(
                PROVIDER_ID,
                PROVIDER_ID + ":" + singerMid,
                name,
                firstNonBlank(firstText(singer.path("pic"), singer.path("singerPic")), artistImageUrl(singerMid)),
                firstText(data.path("singer_brief"), singer.path("desc"), singer.path("brief")),
                "artist",
                firstInt(data.path("total_album"), singer.path("albumNum")),
                firstInt(data.path("total_song"), singer.path("songNum"))
            ));
        }
        return List.copyOf(artists);
    }

    @Override
    public List<AccountSocialUser> loadAccountFollowers(String accountId, String credential, int limit, int offset) {
        requireCredential(accountId, credential);
        int pageSize = Math.max(1, Math.min(limit, 100));
        int pageOffset = Math.max(0, offset);
        int page = pageOffset / pageSize + 1;
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/user/getUserFans")
            .queryParam("uin", accountId)
            .queryParam("page", page)
            .queryParam("limit", pageSize)
            .build(), credential);
        ensureMusicuSuccess(root);
        JsonNode items = firstArray(
            root,
            "response/req_1/data/List",
            "req_1/data/List",
            "data/List"
        );
        if (items == null) {
            return List.of();
        }

        List<AccountSocialUser> followers = new ArrayList<>();
        for (JsonNode item : items) {
            String userId = firstText(
                item.path("EncUin"), item.path("enc_uin"), item.path("MID"), item.path("mid")
            );
            String nickname = firstText(item.path("Name"), item.path("name"), item.path("nickname"));
            if (userId.isBlank() || nickname.isBlank()) {
                continue;
            }
            followers.add(new AccountSocialUser(
                PROVIDER_ID,
                userId,
                nickname,
                firstText(item.path("AvatarUrl"), item.path("avatarUrl"), item.path("avatar")),
                firstText(item.path("Desc"), item.path("desc"), item.path("signature"))
            ));
        }
        return List.copyOf(followers);
    }

    @Override
    public AccountProfile loadUserProfile(String userId, String credential) {
        requireCredential(userId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/user/getUserDetail")
            .queryParam("uin", userId)
            .build(), credential);
        JsonNode response = firstObject(root, "response", "data");
        if (response != null && response.has("code") && response.path("code").asInt(0) != 0) {
            throw new IllegalStateException("QQ 音乐用户资料加载失败: " + response.path("code").asInt());
        }
        JsonNode data = firstObject(root, "response/data", "data");
        if (data == null) {
            throw new IllegalStateException("QQ 音乐用户资料为空");
        }
        JsonNode creator = data.path("creator").isObject()
            ? data.path("creator")
            : (data.path("profile").isObject() ? data.path("profile") : data);
        return new AccountProfile(
            PROVIDER_ID,
            userId,
            firstText(creator.path("nick"), creator.path("nickname"), data.path("nick"), data.path("nickname")),
            firstText(
                creator.path("headpic"), creator.path("avatarUrl"), creator.path("avatar"),
                data.path("headpic"), data.path("avatarUrl")
            ),
            firstText(
                creator.path("desc"), creator.path("signature"), creator.path("introduction"),
                data.path("desc"), data.path("signature")
            ),
            firstInt(
                creator.path("nums").path("follownum"),
                creator.path("follow"), creator.path("follows"), creator.path("follow_num"),
                data.path("nums").path("follownum"), data.path("follow"), data.path("follows")
            ),
            firstInt(
                creator.path("nums").path("fansnum"),
                creator.path("fans"), creator.path("followers"), creator.path("fans_num"),
                data.path("nums").path("fansnum"), data.path("fans"), data.path("followers")
            )
        );
    }

    private static AccountProfile toAccountProfile(ProviderAccount account) {
        return new AccountProfile(
            PROVIDER_ID,
            account.providerUserId(),
            account.nickname(),
            account.avatarUrl(),
            "",
            0,
            0
        );
    }

    @Override
    public List<HomepagePlaylist> loadAccountFeaturedPlaylists(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder.path("/getRecommend").build(), credential);
        ensureSuccess(root);
        JsonNode items = firstArray(root, "response/recomPlaylist/data/v_hot");
        if (items == null) {
            return List.of();
        }
        List<HomepagePlaylist> playlists = new ArrayList<>();
        for (JsonNode item : items) {
            String id = firstText(item.path("content_id"), item.path("dissid"), item.path("tid"));
            String title = firstText(item.path("title"), item.path("dissname"), item.path("name"));
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(firstText(item.path("username"), item.path("creator_name")), "QQ 音乐"),
                firstText(item.path("cover"), item.path("imgurl"), item.path("cover_url_big")),
                firstInt(item.path("songnum"), item.path("song_count"), item.path("count"))
            ));
        }
        return List.copyOf(playlists);
    }

    @Override
    public PlaylistCategoryData loadPlaylistCategories() {
        JsonNode root = get(uriBuilder -> uriBuilder.path("/getSongListCategories").build(), activeCredential().orElse(null));
        ensureSuccess(root);
        JsonNode groupsNode = firstArray(root, "response/data/categories", "data/categories", "categories");
        if (groupsNode == null) {
            return new PlaylistCategoryData(List.of("全部"), Map.of(), List.of());
        }
        playlistCategoryIds.clear();
        playlistCategoryIds.put("全部", 10000000);
        Map<String, List<String>> groups = new LinkedHashMap<>();
        List<String> hotTags = new ArrayList<>();
        for (JsonNode group : groupsNode) {
            String groupName = firstNonBlank(
                firstText(group.path("categoryGroupName"), group.path("group_name"), group.path("name")),
                "推荐"
            );
            JsonNode items = group.path("items");
            if (!items.isArray()) {
                continue;
            }
            List<String> names = new ArrayList<>();
            for (JsonNode item : items) {
                String name = normalizePlaylistCategoryName(firstText(
                    item.path("categoryName"), item.path("item_name"), item.path("name")
                ));
                int id = firstInt(item.path("categoryId"), item.path("item_id"), item.path("id"));
                if (name.isBlank() || name.equals("全部分类") || id <= 0) {
                    continue;
                }
                playlistCategoryIds.put(name, id);
                names.add(name);
                if ("热门".equals(groupName) && !hotTags.contains(name)) {
                    hotTags.add(name);
                }
            }
            if (!names.isEmpty()) {
                groups.put(groupName, List.copyOf(names));
            }
        }
        if (hotTags.isEmpty()) {
            hotTags.add("全部");
        }
        return new PlaylistCategoryData(
            List.copyOf(hotTags),
            Collections.unmodifiableMap(new LinkedHashMap<>(groups)),
            List.of()
        );
    }

    private static String normalizePlaylistCategoryName(String value) {
        return value.replace("&#38;", "&").replace("&amp;", "&");
    }

    @Override
    public PlaylistDiscoveryPage loadPlaylists(String category, String order, int limit, int offset) {
        int pageSize = Math.max(1, Math.min(limit, 50));
        int pageOffset = Math.max(0, offset);
        int categoryId = resolvePlaylistCategoryId(category);
        int sortId = "new".equalsIgnoreCase(order) ? 2 : 5;
        int page = pageOffset / pageSize;
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSongLists")
            .queryParam("categoryId", categoryId)
            .queryParam("sortId", sortId)
            .queryParam("page", page)
            .queryParam("limit", pageSize)
            .build(), activeCredential().orElse(null));
        ensureSuccess(root);
        JsonNode items = firstArray(root, "response/data/list", "data/list", "list");
        if (items == null) {
            items = OBJECT_MAPPER.createArrayNode();
        }
        List<PlaylistDiscoveryItem> playlists = new ArrayList<>();
        for (JsonNode item : items) {
            String id = firstText(item.path("dissid"), item.path("tid"), item.path("id"));
            String title = firstText(item.path("dissname"), item.path("title"), item.path("name"));
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new PlaylistDiscoveryItem(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(firstText(item.path("creator").path("name"), item.path("creator_name")), "QQ 音乐"),
                firstText(item.path("imgurl"), item.path("cover_url_big"), item.path("cover")),
                firstInt(item.path("songnum"), item.path("song_count"), item.path("count")),
                firstLong(item.path("listennum"), item.path("access_num"), item.path("playCount"))
            ));
        }
        long total = firstLong(root.path("response").path("data").path("sum"), root.path("data").path("sum"));
        if (total <= 0) {
            total = pageOffset + playlists.size();
        }
        return new PlaylistDiscoveryPage(
            List.copyOf(playlists), total, pageOffset + playlists.size() < total, null
        );
    }

    private int resolvePlaylistCategoryId(String category) {
        if (category == null || category.isBlank() || "全部".equals(category)) {
            return 10000000;
        }
        Integer cached = playlistCategoryIds.get(category);
        if (cached != null) {
            return cached;
        }
        loadPlaylistCategories();
        return playlistCategoryIds.getOrDefault(category, 10000000);
    }

    @Override
    public List<Track> loadAccountPlaylist(String playlistId, String accountId, String credential) {
        requireCredential(accountId, credential);
        String id = rawId(playlistId);
        if (id.startsWith("rank-")) {
            return loadRankPlaylist(id, credential);
        }
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSongListDetail")
            .queryParam("disstid", id)
            .build(), credential);
        return tracksFrom(root);
    }

    @Override
    public List<Track> loadAccountFavorites(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode favoriteRoot = get(uriBuilder -> uriBuilder
            .path("/user/getUserLikedSongs")
            .queryParam("uin", accountId)
            .queryParam("offset", 0)
            .queryParam("limit", 1000)
            .build(), credential);
        ensureMusicuSuccess(favoriteRoot);
        String playlistId = firstText(
            favoriteRoot.path("response").path("data").path("info").path("id"),
            favoriteRoot.path("response").path("data").path("songs").path(0).path("id"),
            favoriteRoot.path("data").path("info").path("id")
        );
        if (playlistId.isBlank()) {
            return List.of();
        }
        JsonNode tracksRoot = get(uriBuilder -> uriBuilder
            .path("/getSongListDetail")
            .queryParam("disstid", playlistId)
            .build(), credential);
        return tracksFrom(tracksRoot);
    }

    @Override
    public void setAccountFavorite(String accountId, String trackId, boolean liked, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = post(
            "/user/setSongFavorite",
            Map.of("mid", rawId(trackId), "liked", liked),
            credential
        );
        ensureMusicuSuccess(root);
    }

    @Override
    public List<Track> loadPlaylist(String playlistId) {
        String id = rawId(playlistId);
        if (id.startsWith("rank-")) {
            return loadRankPlaylist(id, null);
        }
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getSongListDetail")
            .queryParam("disstid", id)
            .build(), null);
        return tracksFrom(root);
    }

    private List<Track> loadRankPlaylist(String rankId, String credential) {
        String topId = rankId.substring("rank-".length());
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/getRanks")
            .queryParam("topId", topId)
            .queryParam("limit", 30)
            .queryParam("resolveMid", true)
            .build(), credential);
        return tracksFrom(root);
    }

    private List<Track> tracksFrom(JsonNode root) {
        ensureSuccess(root);
        JsonNode items = firstArray(
            root,
            "response/recommend/data/songlist", "response/recommend/data/list",
            "response/data/song/list",
            "response/data/recommend/songlist", "response/data/recommend/playlist",
            "response/req_1/data/data/song",
            "response/singer/data/songlist",
            "data/songlist", "data/list", "data/song_list", "data/tracks", "data/track_list",
            "songlist", "list", "songs"
        );
        JsonNode cdlist = root.path("response").path("cdlist");
        if (!cdlist.isArray()) {
            cdlist = root.path("data").path("cdlist");
        }
        if (items == null && cdlist.isArray() && !cdlist.isEmpty()) {
            items = cdlist.get(0).path("songlist");
        }
        if (items == null || !items.isArray()) {
            return List.of();
        }
        List<Track> tracks = new ArrayList<>();
        for (JsonNode item : items) {
            JsonNode song = item.path("songInfo").isObject() ? item.path("songInfo")
                : item.path("track_info").isObject() ? item.path("track_info") : item;
            String id = songId(song);
            if (!id.isBlank()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    private Track toTrack(JsonNode song) {
        String id = songId(song);
        String title = firstNonBlank(firstText(song.path("songname"), song.path("name"), song.path("title")), "未知歌曲");
        String albumMid = firstText(song.path("albummid"), song.path("albumMid"), song.path("album").path("mid"));
        String albumName = firstNonBlank(
            firstText(song.path("albumname"), song.path("album").path("name"), song.path("album").path("title")),
            "未知专辑"
        );
        long duration = song.path("interval").asLong(0);
        if (duration <= 0) {
            duration = Math.round(song.path("duration").asLong(0) / 1000.0);
        }
        String coverUrl = firstText(song.path("cover"), song.path("picurl"));
        if (coverUrl.isBlank() && !albumMid.isBlank()) {
            coverUrl = "https://y.gtimg.cn/music/photo_new/T002R300x300M000" + albumMid + ".jpg";
        }
        String now = OffsetDateTime.now().toString();
        return new Track(
            PROVIDER_ID + ":" + id,
            title,
            artistOf(song),
            albumName,
            duration,
            PROVIDER_ID,
            null,
            "/catalog/tracks/" + PROVIDER_ID + ":" + id + "/audio",
            coverUrl,
            null,
            null,
            null,
            now,
            now
        );
    }

    private JsonNode get(
        java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFactory,
        String credential
    ) {
        try {
            var request = restClient.get().uri(uriFactory);
            if (credential != null && !credential.isBlank()) {
                request.header(HttpHeaders.COOKIE, credential);
            }
            JsonNode response = request.retrieve().body(JsonNode.class);
            return response == null ? OBJECT_MAPPER.createObjectNode() : response;
        } catch (RestClientException ex) {
            throw new IllegalStateException("QQMusicAPI 调用失败，请确认 3300 端口服务已启动", ex);
        }
    }

    private JsonNode post(String path, Object body, String credential) {
        try {
            var request = restClient.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON);
            if (credential != null && !credential.isBlank()) {
                request.header(HttpHeaders.COOKIE, credential);
            }
            JsonNode response = request.body(body).retrieve().body(JsonNode.class);
            return response == null ? OBJECT_MAPPER.createObjectNode() : response;
        } catch (RestClientException ex) {
            throw new IllegalStateException("QQMusicAPI 调用失败，请确认 3300 端口服务已启动", ex);
        }
    }

    private static void ensureSuccess(JsonNode root) {
        int result = root.path("result").asInt(100);
        if (result == 301) {
            throw new ProviderLoginRequiredException();
        }
        if (result != 100) {
            String message = firstText(root.path("message"), root.path("msg"));
            throw new IllegalStateException(message.isBlank() ? "QQMusicAPI 返回错误: " + result : message);
        }
    }

    private static void ensureMusicuSuccess(JsonNode root) {
        ensureSuccess(root);
        JsonNode response = root.path("response");
        int responseCode = response.path("code").asInt(0);
        int requestCode = response.path("req_1").path("code").asInt(0);
        if (responseCode != 0 || requestCode != 0) {
            String message = firstText(
                response.path("req_1").path("message"),
                response.path("req_1").path("msg"),
                response.path("message"),
                response.path("msg")
            );
            int code = requestCode != 0 ? requestCode : responseCode;
            throw new IllegalStateException(message.isBlank() ? "QQ 音乐关注接口返回错误: " + code : message);
        }
    }

    private static void requireCredential(String accountId, String credential) {
        if (accountId == null || accountId.isBlank() || credential == null || credential.isBlank()) {
            throw new ProviderLoginRequiredException();
        }
    }

    private static JsonNode firstArray(JsonNode root, String... paths) {
        for (String path : paths) {
            JsonNode current = root;
            for (String part : path.split("/")) {
                current = current.path(part);
            }
            if (current.isArray()) {
                return current;
            }
        }
        return null;
    }

    private static JsonNode firstObject(JsonNode root, String... paths) {
        for (String path : paths) {
            JsonNode current = root;
            for (String part : path.split("/")) {
                current = current.path(part);
            }
            if (current.isObject()) {
                return current;
            }
        }
        return null;
    }

    private static String songId(JsonNode song) {
        return firstText(song.path("songmid"), song.path("mid"), song.path("id"));
    }

    private static String artistOf(JsonNode song) {
        JsonNode singers = song.path("singer").isArray() ? song.path("singer") : song.path("singers");
        List<String> names = new ArrayList<>();
        if (singers.isArray()) {
            for (JsonNode singer : singers) {
                String name = firstText(singer.path("name"), singer.path("title"));
                if (!name.isBlank()) {
                    names.add(name);
                }
            }
        }
        if (!names.isEmpty()) {
            return String.join("/", names);
        }
        return firstNonBlank(firstText(song.path("singerName"), song.path("singername"), song.path("artist")), "未知歌手");
    }

    private static String rawId(String id) {
        if (id == null) {
            return "";
        }
        int separator = id.indexOf(':');
        return separator >= 0 ? id.substring(separator + 1) : id;
    }

    private static String firstText(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && node.isValueNode() && !node.asText().isBlank()) {
                return node.asText().trim();
            }
        }
        return "";
    }

    private static int firstInt(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && node.isNumber()) {
                return node.asInt();
            }
        }
        return 0;
    }

    private static long firstLong(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && node.isNumber()) {
                return node.asLong();
            }
        }
        return 0;
    }

    private static String firstNonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
