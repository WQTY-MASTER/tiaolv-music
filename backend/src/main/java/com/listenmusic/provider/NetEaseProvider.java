package com.listenmusic.provider;

import com.listenmusic.domain.Track;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.stereotype.Component;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class NetEaseProvider implements MusicProvider {
    private static final String PROVIDER_ID = "netease";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern CREDIT_PATTERN = Pattern.compile("^(.+?)\\s*[:：]\\s*(.*)$");
    private static final Pattern TIMING_PATTERN = Pattern.compile(
        "\\[(?:\\d+,\\d+|\\d{1,3}:\\d{2}(?:[.:]\\d{1,3})?(?:,\\d+)?)\\]"
    );
    private static final Pattern CLOCK_TIMING_PATTERN = Pattern.compile(
        "^\\[(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?(?:,\\d+)?\\]"
    );
    private static final List<String> CREDIT_HINTS = List.of(
        "作词", "作曲", "编曲", "制作人", "监制", "混音", "母带", "企划", "录音",
        "和声", "吉他", "贝斯", "鼓手", "弦乐", "合唱", "演唱", "乐器独奏",
        "录音监督", "出品", "助理", "谱务", "承办人", "录音棚", "录音师",
        "lyricist", "composer", "arranger", "producer", "vocal", "mixing",
        "mastering", "instrument", "guitar", "bass", "drum", "studio",
        "recording", "contractor", "supervisor", "assistant", "scoring", "produced"
    );

    private final RestClient restClient;
    private final AtomicInteger homepagePlaylistOffset = new AtomicInteger();

    public NetEaseProvider(
        RestClient.Builder restClientBuilder,
        @Value("${listenmusic.providers.netease.base-url:http://127.0.0.1:3000}") String baseUrl
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
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

        JsonNode root = get("/cloudsearch", uriBuilder -> uriBuilder
            .path("/cloudsearch")
            .queryParam("keywords", query.trim())
            .queryParam("type", 1)
            .queryParam("limit", 20)
            .queryParam("noCookie", true)
            .build());
        List<Track> tracks = new ArrayList<>();
        for (JsonNode song : root.path("result").path("songs")) {
            tracks.add(toTrack(song));
        }
        return tracks;
    }

    @Override
    public SearchResultPage search(String query, SearchType type, int limit, int offset) {
        if (query == null || query.isBlank()) {
            return SearchResultPage.empty();
        }
        int pageSize = Math.max(1, Math.min(limit, 50));
        int pageOffset = Math.max(0, offset);
        JsonNode result = get("/cloudsearch", uriBuilder -> uriBuilder
            .path("/cloudsearch")
            .queryParam("keywords", query.trim())
            .queryParam("type", type.apiValue())
            .queryParam("limit", pageSize)
            .queryParam("offset", pageOffset)
            .queryParam("noCookie", true)
            .build()).path("result");

        List<Track> songs = new ArrayList<>();
        List<PlaylistDiscoveryItem> playlists = List.of();
        List<SearchArtist> artists = new ArrayList<>();
        long total;
        switch (type) {
            case SONG -> {
                for (JsonNode song : result.path("songs")) {
                    songs.add(toTrack(song));
                }
                total = result.path("songCount").asLong(songs.size());
            }
            case PLAYLIST -> {
                playlists = discoveryPlaylists(result.path("playlists"));
                total = result.path("playlistCount").asLong(playlists.size());
            }
            case ARTIST -> {
                for (JsonNode artist : result.path("artists")) {
                    String id = artist.path("id").asText("");
                    String name = artist.path("name").asText("").trim();
                    if (id.isBlank() || name.isBlank()) {
                        continue;
                    }
                    artists.add(new SearchArtist(
                        PROVIDER_ID + ":" + id,
                        name,
                        firstNonBlank(artist.path("picUrl").asText(""), artist.path("img1v1Url").asText("")),
                        artist.path("albumSize").asInt(0),
                        artist.path("musicSize").asInt(0),
                        PROVIDER_ID
                    ));
                }
                total = result.path("artistCount").asLong(artists.size());
            }
            default -> throw new IllegalArgumentException("不支持的搜索类型: " + type);
        }
        int resultCount = switch (type) {
            case SONG -> songs.size();
            case PLAYLIST -> playlists.size();
            case ARTIST -> artists.size();
        };
        return new SearchResultPage(
            List.copyOf(songs), List.copyOf(playlists), List.copyOf(artists), total,
            pageOffset + resultCount < total
        );
    }

    @Override
    public HomepageData loadHomepage(boolean refresh, String cursor) {
        JsonNode root = get("/homepage/block/page", uriBuilder -> {
            var builder = uriBuilder
                .path("/homepage/block/page")
                .queryParam("refresh", refresh);
            if (refresh) {
                builder.queryParam("timestamp", System.currentTimeMillis());
            }
            if (cursor != null && !cursor.isBlank()) {
                builder.queryParam("cursor", cursor);
            }
            return builder.build();
        });

        List<HomepageBanner> banners = new ArrayList<>();
        Map<String, HomepagePlaylist> playlists = new LinkedHashMap<>();
        Map<String, Track> songs = new LinkedHashMap<>();
        JsonNode data = root.path("data");
        for (JsonNode block : data.path("blocks")) {
            String blockCode = block.path("blockCode").asText("");
            if ("HOMEPAGE_BANNER".equals(blockCode)) {
                for (JsonNode banner : block.path("extInfo").path("banners")) {
                    String imageUrl = banner.path("pic").asText("");
                    if (!imageUrl.isBlank()) {
                        banners.add(new HomepageBanner(
                            banner.path("typeTitle").asText("推荐内容"),
                            banner.path("mainTitle").asText(""),
                            imageUrl,
                            banner.path("targetId").asText(""),
                            banner.path("targetType").isNumber() ? banner.path("targetType").asInt() : null,
                            banner.path("url").asText(null)
                        ));
                    }
                }
            }

            if ("HOMEPAGE_BLOCK_PLAYLIST_RCMD".equals(blockCode)) {
                for (JsonNode creative : block.path("creatives")) {
                    for (JsonNode resource : resourcesOf(creative)) {
                        String title = titleOf(resource);
                        String id = resource.path("resourceId").asText("");
                        if (!id.isBlank() && !isPrivatePlaylist(title)) {
                            String imageUrl = imageOf(resource);
                            playlists.putIfAbsent("netease:" + id, new HomepagePlaylist(
                                "netease:" + id,
                                title,
                                subtitleOf(resource),
                                imageUrl,
                                0
                            ));
                        }
                    }
                }
            }

            if ("HOMEPAGE_BLOCK_STYLE_RCMD".equals(blockCode)
                || "HOMEPAGE_BLOCK_NEW_ALBUM_NEW_SONG".equals(blockCode)) {
                for (JsonNode creative : block.path("creatives")) {
                    for (JsonNode resource : resourcesOf(creative)) {
                        Track track = homepageSongOf(resource);
                        if (track != null) {
                            songs.putIfAbsent(track.id(), track);
                        }
                    }
                }
            }
        }

        return new HomepageData(
            banners,
            refresh ? freshHomepagePlaylists(playlists) : List.copyOf(playlists.values()),
            List.copyOf(songs.values()),
            data.path("cursor").asText(null),
            data.path("hasMore").asBoolean(false)
        );
    }

    private List<HomepagePlaylist> freshHomepagePlaylists(Map<String, HomepagePlaylist> fallback) {
        int offset = homepagePlaylistOffset.getAndAdd(12);
        try {
            JsonNode root = get("/top/playlist", uriBuilder -> uriBuilder
                .path("/top/playlist")
                .queryParam("limit", 12)
                .queryParam("order", "hot")
                .queryParam("offset", offset)
                .queryParam("noCookie", true)
                .queryParam("timestamp", System.currentTimeMillis())
                .build());
            List<HomepagePlaylist> refreshed = new ArrayList<>();
            for (JsonNode playlist : root.path("playlists")) {
                String id = playlist.path("id").asText("");
                String title = playlist.path("name").asText("").trim();
                if (id.isBlank() || title.isBlank() || isPrivatePlaylist(title)) {
                    continue;
                }
                refreshed.add(new HomepagePlaylist(
                    PROVIDER_ID + ":" + id,
                    title,
                    firstNonBlank(playlist.path("copywriter").asText(""), "网易云推荐歌单"),
                    playlist.path("picUrl").asText(""),
                    playlist.path("trackCount").asInt(0)
                ));
            }
            return refreshed.isEmpty() ? List.copyOf(fallback.values()) : List.copyOf(refreshed);
        } catch (IllegalStateException ex) {
            return List.copyOf(fallback.values());
        }
    }

    @Override
    public HomepageData loadDiscovery(boolean refresh, String cursor) {
        JsonNode playlistRoot = get("/personalized", uriBuilder -> uriBuilder
            .path("/personalized")
            .queryParam("limit", 12)
            .queryParam("noCookie", true)
            .build());
        JsonNode songRoot = get("/personalized/newsong", uriBuilder -> uriBuilder
            .path("/personalized/newsong")
            .queryParam("limit", 12)
            .queryParam("noCookie", true)
            .build());

        List<HomepagePlaylist> playlists = new ArrayList<>();
        for (JsonNode playlist : playlistRoot.path("result")) {
            String id = playlist.path("id").asText("");
            String title = playlist.path("name").asText("").trim();
            if (id.isBlank() || title.isBlank() || isPrivatePlaylist(title)) {
                continue;
            }
            String subtitle = firstNonBlank(
                playlist.path("copywriter").asText(""),
                playlist.path("description").asText(""),
                "网易云推荐歌单"
            );
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                subtitle,
                playlist.path("picUrl").asText(""),
                playlist.path("trackCount").asInt(0)
            ));
        }

        List<Track> songs = new ArrayList<>();
        for (JsonNode item : songRoot.path("result")) {
            JsonNode song = item.path("song").isObject() ? item.path("song") : item;
            if (song.path("id").isNumber()) {
                songs.add(toTrack(song, item.path("picUrl").asText(null)));
            }
        }
        return new HomepageData(List.of(), playlists, songs, null, false);
    }

    @Override
    public PlaylistCategoryData loadPlaylistCategories() {
        JsonNode categoryRoot = get("/playlist/catlist", uriBuilder -> uriBuilder
            .path("/playlist/catlist")
            .queryParam("noCookie", true)
            .build());
        JsonNode hotRoot = get("/playlist/hot", uriBuilder -> uriBuilder
            .path("/playlist/hot")
            .queryParam("noCookie", true)
            .build());
        JsonNode qualityRoot = get("/playlist/highquality/tags", uriBuilder -> uriBuilder
            .path("/playlist/highquality/tags")
            .queryParam("noCookie", true)
            .build());

        Map<String, List<String>> groups = new LinkedHashMap<>();
        Map<Integer, String> groupNames = new LinkedHashMap<>();
        categoryRoot.path("categories").fields().forEachRemaining(entry ->
            groupNames.put(Integer.parseInt(entry.getKey()), entry.getValue().asText())
        );
        for (String groupName : groupNames.values()) {
            groups.put(groupName, new ArrayList<>());
        }
        for (JsonNode sub : categoryRoot.path("sub")) {
            String name = sub.path("name").asText("").trim();
            String groupName = groupNames.get(sub.path("category").asInt(-1));
            if (!name.isBlank() && groupName != null) {
                groups.get(groupName).add(name);
            }
        }

        List<String> hotTags = new ArrayList<>(List.of("全部"));
        for (JsonNode tag : hotRoot.path("tags")) {
            String name = tag.path("name").asText("").trim();
            if (!name.isBlank() && !hotTags.contains(name)) {
                hotTags.add(name);
            }
        }
        List<String> qualityTags = new ArrayList<>(List.of("全部"));
        for (JsonNode tag : qualityRoot.path("tags")) {
            String name = tag.path("name").asText("").trim();
            if (!name.isBlank() && !qualityTags.contains(name)) {
                qualityTags.add(name);
            }
        }
        Map<String, List<String>> immutableGroups = new LinkedHashMap<>();
        groups.forEach((name, tags) -> immutableGroups.put(name, List.copyOf(tags)));
        return new PlaylistCategoryData(
            List.copyOf(hotTags),
            java.util.Collections.unmodifiableMap(immutableGroups),
            List.copyOf(qualityTags)
        );
    }

    @Override
    public PlaylistDiscoveryPage loadPlaylists(String category, String order, int limit, int offset) {
        int pageSize = Math.max(1, Math.min(limit, 50));
        int pageOffset = Math.max(0, offset);
        JsonNode root = get("/top/playlist", uriBuilder -> uriBuilder
            .path("/top/playlist")
            .queryParam("cat", firstNonBlank(category, "全部"))
            .queryParam("order", "new".equalsIgnoreCase(order) ? "new" : "hot")
            .queryParam("limit", pageSize)
            .queryParam("offset", pageOffset)
            .queryParam("noCookie", true)
            .build());
        List<PlaylistDiscoveryItem> playlists = discoveryPlaylists(root.path("playlists"));
        long total = root.path("total").asLong(pageOffset + playlists.size());
        boolean hasMore = root.path("more").asBoolean(pageOffset + playlists.size() < total);
        return new PlaylistDiscoveryPage(playlists, total, hasMore, null);
    }

    @Override
    public PlaylistDiscoveryPage loadHighQualityPlaylists(String category, int limit, String before) {
        int pageSize = Math.max(1, Math.min(limit, 50));
        JsonNode root = get("/top/playlist/highquality", uriBuilder -> {
            var builder = uriBuilder.path("/top/playlist/highquality")
                .queryParam("cat", firstNonBlank(category, "全部"))
                .queryParam("limit", pageSize);
            if (before != null && !before.isBlank()) {
                builder.queryParam("before", before);
            }
            return builder.queryParam("noCookie", true).build();
        });
        List<PlaylistDiscoveryItem> playlists = discoveryPlaylists(root.path("playlists"));
        String cursor = playlists.isEmpty()
            ? null
            : root.path("playlists").path(root.path("playlists").size() - 1).path("updateTime").asText(null);
        long total = root.path("total").asLong(playlists.size());
        return new PlaylistDiscoveryPage(playlists, total, root.path("more").asBoolean(false), cursor);
    }

    @Override
    public void updatePlaylistPlayCount(String playlistId) {
        get("/playlist/update/playcount", uriBuilder -> uriBuilder
            .path("/playlist/update/playcount")
            .queryParam("id", rawId(playlistId))
            .queryParam("timestamp", System.currentTimeMillis())
            .build());
    }

    @Override
    public List<Track> loadDailyRecommendations() {
        JsonNode root = get("/recommend/songs", uriBuilder -> uriBuilder
            .path("/recommend/songs")
            .build());
        if (root.path("code").asInt(200) == 301) {
            throw new DailyRecommendationsLoginRequiredException();
        }

        List<Track> tracks = new ArrayList<>();
        for (JsonNode song : root.path("data").path("dailySongs")) {
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public List<Track> loadAccountRecommendations(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/recommend/songs", uriBuilder -> uriBuilder
            .path("/recommend/songs")
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
        List<Track> tracks = new ArrayList<>();
        for (JsonNode song : root.path("data").path("dailySongs")) {
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public List<Track> loadAccountPrivateRadar(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/personalized/newsong", uriBuilder -> uriBuilder
            .path("/personalized/newsong")
            .queryParam("limit", 30)
            .queryParam("timestamp", System.currentTimeMillis())
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .build(), credential);
        ensureAccountResponse(root);
        List<Track> tracks = new ArrayList<>();
        for (JsonNode item : root.path("result")) {
            JsonNode song = item.path("song").isObject() ? item.path("song") : item;
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song, item.path("picUrl").asText("")));
            }
        }
        return tracks;
    }

    @Override
    public List<Track> loadAccountPrivateRoaming(
        String accountId,
        String credential,
        String mode,
        String scene
    ) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/personal_fm", uriBuilder -> uriBuilder
            .path("/personal_fm")
            .queryParam("timestamp", System.currentTimeMillis())
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .build(), credential);
        ensureAccountResponse(root);
        List<Track> tracks = new ArrayList<>();
        for (JsonNode item : root.path("data")) {
            JsonNode song = item.path("song").isObject() ? item.path("song") : item;
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public List<Track> loadAccountFavorites(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/likelist", uriBuilder -> uriBuilder
            .path("/likelist")
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);

        List<Track> directTracks = new ArrayList<>();
        if (root.path("songs").isArray()) {
            for (JsonNode song : root.path("songs")) {
                if (song.path("id").isNumber()) {
                    directTracks.add(toTrack(song));
                }
            }
        }
        if (!directTracks.isEmpty()) {
            return directTracks;
        }

        List<String> ids = new ArrayList<>();
        if (root.path("ids").isArray()) {
            for (JsonNode id : root.path("ids")) {
                if (id.isValueNode() && !id.asText().isBlank()) {
                    ids.add(id.asText());
                }
            }
        }
        List<Track> tracks = new ArrayList<>();
        for (int start = 0; start < ids.size(); start += 100) {
            List<String> chunk = ids.subList(start, Math.min(start + 100, ids.size()));
            JsonNode detailRoot = get("/song/detail", uriBuilder -> uriBuilder
                .path("/song/detail")
                .queryParam("ids", String.join(",", chunk))
                .queryParam("uid", accountId)
                .queryParam("cookie", credential)
                .queryParam("timestamp", System.currentTimeMillis())
                .build(), credential);
            ensureAccountResponse(detailRoot);
            for (JsonNode song : detailRoot.path("songs")) {
                if (song.path("id").isNumber()) {
                    tracks.add(toTrack(song));
                }
            }
        }
        return tracks;
    }

    @Override
    public AccountProfile loadAccountProfile(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode accountRoot = get("/user/account", uriBuilder -> uriBuilder
            .path("/user/account")
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(accountRoot);
        String currentUid = firstNonBlank(
            accountRoot.path("account").path("id").asText(""),
            accountRoot.path("profile").path("userId").asText(""),
            accountId
        );

        return loadUserProfile(currentUid, credential);
    }

    @Override
    public AccountProfile loadUserProfile(String userId, String credential) {
        requireAccountCredential(userId, credential);

        JsonNode detailRoot = get("/user/detail", uriBuilder -> uriBuilder
            .path("/user/detail")
            .queryParam("uid", userId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(detailRoot);
        JsonNode profile = detailRoot.path("profile");
        return new AccountProfile(
            PROVIDER_ID,
            userId,
            profile.path("nickname").asText("网易云用户"),
            profile.path("avatarUrl").asText(""),
            profile.path("signature").asText(""),
            profile.path("follows").asInt(0),
            profile.path("followeds").asInt(0)
        );
    }

    @Override
    public List<AccountSocialUser> loadAccountFollowing(String accountId, String credential, int limit, int offset) {
        return loadAccountSocialUsers("/user/follows", "follow", accountId, credential, limit, offset);
    }

    @Override
    public List<AccountSocialUser> loadAccountFollowers(String accountId, String credential, int limit, int offset) {
        return loadAccountSocialUsers("/user/followeds", "followeds", accountId, credential, limit, offset);
    }

    private List<AccountSocialUser> loadAccountSocialUsers(
        String path,
        String resultField,
        String accountId,
        String credential,
        int limit,
        int offset
    ) {
        requireAccountCredential(accountId, credential);
        int pageSize = Math.max(1, Math.min(limit, 100));
        int pageOffset = Math.max(0, offset);
        JsonNode root = get(path, uriBuilder -> uriBuilder
            .path(path)
            .queryParam("uid", accountId)
            .queryParam("limit", pageSize)
            .queryParam("offset", pageOffset)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
        List<AccountSocialUser> users = new ArrayList<>();
        for (JsonNode user : root.path(resultField)) {
            String userId = user.path("userId").asText("");
            String nickname = user.path("nickname").asText("").trim();
            if (userId.isBlank() || nickname.isBlank()) {
                continue;
            }
            users.add(new AccountSocialUser(
                PROVIDER_ID,
                userId,
                nickname,
                user.path("avatarUrl").asText(""),
                user.path("signature").asText("")
            ));
        }
        return List.copyOf(users);
    }

    @Override
    public List<Track> loadAccountRecentTracks(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/record/recent/song", uriBuilder -> uriBuilder
            .path("/record/recent/song")
            .queryParam("limit", 100)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
        List<Track> tracks = new ArrayList<>();
        JsonNode items = root.path("data").path("list");
        if (!items.isArray()) {
            items = root.path("data");
        }
        for (JsonNode item : items) {
            JsonNode song = item.path("data").isObject() ? item.path("data") : item.path("song");
            if (song.isObject() && song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public List<Track> loadAccountListeningRank(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/user/record", uriBuilder -> uriBuilder
            .path("/user/record")
            .queryParam("uid", accountId)
            .queryParam("type", 1)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
        JsonNode items = root.path("weekData").isArray() ? root.path("weekData") : root.path("allData");
        List<Track> tracks = new ArrayList<>();
        for (JsonNode item : items) {
            JsonNode song = item.path("song");
            if (song.isObject() && song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public List<HomepagePlaylist> loadAccountPlaylists(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/user/playlist", uriBuilder -> uriBuilder
            .path("/user/playlist")
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("limit", 100)
            .queryParam("offset", 0)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
        List<HomepagePlaylist> playlists = new ArrayList<>();
        for (JsonNode playlist : root.path("playlist")) {
            String id = playlist.path("id").asText("");
            String title = playlist.path("name").asText("").trim();
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(playlist.path("description").asText(""), "网易云歌单"),
                firstNonBlank(playlist.path("coverImgUrl").asText(""), playlist.path("picUrl").asText("")),
                playlist.path("trackCount").asInt(0)
            ));
        }
        return playlists;
    }

    @Override
    public List<HomepagePlaylist> loadAccountFeaturedPlaylists(String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/personalized", uriBuilder -> uriBuilder
            .path("/personalized")
            .queryParam("limit", 8)
            .queryParam("timestamp", System.currentTimeMillis())
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .build(), credential);
        ensureAccountResponse(root);
        List<HomepagePlaylist> playlists = new ArrayList<>();
        for (JsonNode playlist : root.path("result")) {
            String id = playlist.path("id").asText("");
            String title = playlist.path("name").asText("").trim();
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(playlist.path("copywriter").asText(""), "网易云精选歌单"),
                playlist.path("picUrl").asText(""),
                playlist.path("trackCount").asInt(0)
            ));
            if (playlists.size() == 8) {
                break;
            }
        }
        return List.copyOf(playlists);
    }

    @Override
    public List<Track> loadAccountPlaylist(String playlistId, String accountId, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode detailRoot = get("/playlist/detail", uriBuilder -> uriBuilder
            .path("/playlist/detail")
            .queryParam("id", rawId(playlistId))
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(detailRoot);
        List<Track> tracks = new ArrayList<>();
        JsonNode playlist = detailRoot.path("playlist");
        for (JsonNode song : playlist.path("tracks")) {
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        int trackCount = playlist.path("trackCount").asInt(tracks.size());
        if (!tracks.isEmpty() && tracks.size() >= trackCount) {
            return List.copyOf(tracks);
        }

        JsonNode allTracksRoot = get("/playlist/track/all", uriBuilder -> uriBuilder
            .path("/playlist/track/all")
            .queryParam("id", rawId(playlistId))
            .queryParam("limit", Math.max(100, trackCount))
            .queryParam("offset", 0)
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(allTracksRoot);
        tracks.clear();
        for (JsonNode song : allTracksRoot.path("songs")) {
            if (song.path("id").isNumber()) {
                tracks.add(toTrack(song));
            }
        }
        return tracks;
    }

    @Override
    public void setAccountFavorite(String accountId, String trackId, boolean liked, String credential) {
        requireAccountCredential(accountId, credential);
        JsonNode root = get("/like", uriBuilder -> uriBuilder
            .path("/like")
            .queryParam("id", rawId(trackId))
            .queryParam("like", liked)
            .queryParam("uid", accountId)
            .queryParam("cookie", credential)
            .queryParam("timestamp", System.currentTimeMillis())
            .build(), credential);
        ensureAccountResponse(root);
    }

    @Override
    public Optional<Track> find(String trackId) {
        String rawId = rawId(trackId);
        JsonNode root = get("/song/detail", uriBuilder -> uriBuilder
            .path("/song/detail")
            .queryParam("ids", rawId)
            .queryParam("noCookie", true)
            .build());
        JsonNode songs = root.path("songs");
        if (!songs.isArray() || songs.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(toTrack(songs.get(0)));
    }

    @Override
    public Optional<String> resolveAudioUrl(String trackId) {
        JsonNode root = get("/song/url/v1", uriBuilder -> uriBuilder
            .path("/song/url/v1")
            .queryParam("id", rawId(trackId))
            .queryParam("level", "standard")
            .build());
        JsonNode url = root.path("data").path(0).path("url");
        return url.isTextual() && !url.asText().isBlank()
            ? Optional.of(url.asText())
            : Optional.empty();
    }

    @Override
    public Optional<LyricData> loadLyrics(String trackId) {
        String id = rawId(trackId);
        JsonNode root = loadLyricsRoot(id);
        String yrc = textAt(root, "yrc", "lyric");
        String lrc = textAt(root, "lrc", "lyric");
        String translation = firstTextAt(root,
            new String[]{"tlyric", "lyric"},
            new String[]{"translation", "lyric"},
            new String[]{"transLyric", "lyric"}
        );
        boolean hasWordTimedLyrics = containsWordTimedLyrics(yrc);
        String lyrics = hasWordTimedLyrics ? yrc : lrc;
        if (lyrics.isBlank()) {
            return Optional.empty();
        }
        List<LyricCredit> credits = parseCredits(yrc, lrc);
        return Optional.of(new LyricData(
            lyrics,
            translation.isBlank() ? null : translation,
            hasWordTimedLyrics ? "YRC" : "LRC",
            PROVIDER_ID,
            credits
        ));
    }

    @Override
    public List<Track> loadPlaylist(String playlistId) {
        JsonNode detailRoot = get("/playlist/detail", uriBuilder -> uriBuilder
            .path("/playlist/detail")
            .queryParam("id", rawId(playlistId))
            .queryParam("noCookie", true)
            .build());
        int trackCount = detailRoot.path("playlist").path("trackCount").asInt(100);
        JsonNode root = get("/playlist/track/all", uriBuilder -> uriBuilder
            .path("/playlist/track/all")
            .queryParam("id", rawId(playlistId))
            .queryParam("limit", Math.max(100, trackCount))
            .queryParam("offset", 0)
            .queryParam("noCookie", true)
            .build());
        List<Track> tracks = new ArrayList<>();
        for (JsonNode song : root.path("songs")) {
            tracks.add(toTrack(song));
        }
        return tracks;
    }

    private List<PlaylistDiscoveryItem> discoveryPlaylists(JsonNode nodes) {
        List<PlaylistDiscoveryItem> playlists = new ArrayList<>();
        for (JsonNode playlist : nodes) {
            String id = playlist.path("id").asText("");
            String title = playlist.path("name").asText("").trim();
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            String subtitle = firstNonBlank(
                playlist.path("copywriter").asText(""),
                playlist.path("creator").path("nickname").asText(""),
                playlist.path("description").asText(""),
                "网易云歌单"
            );
            playlists.add(new PlaylistDiscoveryItem(
                PROVIDER_ID + ":" + id,
                title,
                subtitle,
                firstNonBlank(playlist.path("coverImgUrl").asText(""), playlist.path("picUrl").asText("")),
                playlist.path("trackCount").asInt(0),
                playlist.path("playCount").asLong(0)
            ));
        }
        return List.copyOf(playlists);
    }

    @Override
    public Optional<CoverData> loadCover(String trackId) {
        return find(trackId).flatMap(track -> {
            String coverUrl = track.coverUrl();
            if (coverUrl == null || coverUrl.isBlank()) {
                return Optional.empty();
            }

            try {
                ResponseEntity<byte[]> response = restClient.get()
                    .uri(URI.create(normalizeCoverUrl(coverUrl)))
                    .retrieve()
                    .toEntity(byte[].class);
                byte[] bytes = response.getBody();
                if (bytes == null || bytes.length == 0) {
                    return Optional.empty();
                }
                MediaType mediaType = response.getHeaders().getContentType();
                String contentType = mediaType == null ? MediaType.IMAGE_JPEG_VALUE : mediaType.toString();
                return Optional.of(new CoverData(bytes, contentType));
            } catch (RestClientException | IllegalArgumentException ex) {
                return Optional.empty();
            }
        });
    }

    private Track homepageSongOf(JsonNode resource) {
        JsonNode extInfo = resource.path("resourceExtInfo");
        JsonNode song = extInfo.path("songData");
        if (!song.isObject()) {
            song = extInfo.path("song");
        }
        if (!song.isObject() || !song.path("id").isNumber()) {
            return null;
        }
        return toTrack(song, imageOf(resource));
    }

    private Track toTrack(JsonNode song) {
        return toTrack(song, null);
    }

    private Track toTrack(JsonNode song, String coverOverride) {
        String rawId = song.path("id").asText();
        StringJoiner artists = new StringJoiner("、");
        JsonNode artistNodes = song.path("ar").isArray() ? song.path("ar") : song.path("artists");
        for (JsonNode artist : artistNodes) {
            if (artist.path("name").isTextual()) {
                artists.add(artist.path("name").asText());
            }
        }
        String artist = artists.length() > 0 ? artists.toString() : "未知歌手";
        JsonNode album = song.path("al").isObject() ? song.path("al") : song.path("album");
        long durationMs = song.path("dt").isNumber()
            ? song.path("dt").asLong()
            : song.path("duration").asLong(0);
        long duration = Math.round(durationMs / 1000.0);
        String coverUrl = coverOverride == null || coverOverride.isBlank()
            ? album.path("picUrl").asText(null)
            : coverOverride;
        return new Track(
            PROVIDER_ID + ":" + rawId,
            song.path("name").asText("未知歌曲"),
            artist,
            album.path("name").asText("未知专辑"),
            duration,
            PROVIDER_ID,
            null,
            "/catalog/tracks/" + PROVIDER_ID + ":" + rawId + "/audio",
            coverUrl,
            null,
            null,
            null,
            OffsetDateTime.now().toString(),
            OffsetDateTime.now().toString()
        );
    }

    private static List<JsonNode> resourcesOf(JsonNode creative) {
        List<JsonNode> resources = new ArrayList<>();
        if (creative.path("resources").isArray()) {
            creative.path("resources").forEach(resources::add);
        } else if (creative.path("resourceType").isTextual()) {
            resources.add(creative);
        }
        return resources;
    }

    private static String titleOf(JsonNode resource) {
        return resource.path("uiElement").path("mainTitle").path("title").asText("").trim();
    }

    private static String subtitleOf(JsonNode resource) {
        return resource.path("uiElement").path("subTitle").path("title").asText("").trim();
    }

    private static String imageOf(JsonNode resource) {
        return resource.path("uiElement").path("image").path("imageUrl").asText("");
    }

    private JsonNode get(
        String path,
        java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFactory
    ) {
        return get(path, uriFactory, null);
    }

    private JsonNode get(
        String path,
        java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFactory,
        String cookie
    ) {
        try {
            var request = restClient.get().uri(uriFactory);
            if (cookie != null && !cookie.isBlank()) {
                request.header(org.springframework.http.HttpHeaders.COOKIE, cookie);
            }
            JsonNode response = request.retrieve().body(JsonNode.class);
            if (response == null) {
                throw new IllegalStateException("网易云 API 返回为空: " + path);
            }
            return response;
        } catch (RestClientException ex) {
            throw new IllegalStateException("网易云 API 调用失败，请确认 NeteaseCloudMusicApi 服务已启动: " + path, ex);
        }
    }

    private static void requireAccountCredential(String accountId, String credential) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("网易云账号 ID 不能为空");
        }
        if (credential == null || credential.isBlank()) {
            throw new ProviderLoginRequiredException();
        }
    }

    private static void ensureAccountResponse(JsonNode root) {
        int code = root.path("code").asInt(200);
        if (code == 301 || code == 401 || code == 403) {
            throw new ProviderLoginRequiredException();
        }
        if (code >= 400) {
            throw new IllegalStateException("网易云账号接口调用失败: " + code);
        }
    }

    private JsonNode loadLyricsRoot(String id) {
        try {
            return get("/lyric/new", uriBuilder -> uriBuilder
                .path("/lyric/new")
                .queryParam("id", id)
                .queryParam("noCookie", true)
                .build());
        } catch (IllegalStateException ex) {
            // 兼容旧版 NeteaseCloudMusicApi 没有 /lyric/new 的情况。
            return get("/lyric", uriBuilder -> uriBuilder
                .path("/lyric")
                .queryParam("id", id)
                .queryParam("noCookie", true)
                .build());
        }
    }

    private static boolean containsWordTimedLyrics(String lyrics) {
        return lyrics != null
            && lyrics.matches("(?s).*\\[\\d{1,},\\d{1,}\\].*\\(\\d{1,},\\d{1,}(?:,\\d{1,})?\\).*");
    }

    private static List<LyricCredit> parseCredits(String... lyricSources) {
        Map<String, LyricCredit> credits = new LinkedHashMap<>();
        for (String source : lyricSources) {
            if (source == null || source.isBlank()) {
                continue;
            }
            for (String rawLine : source.split("\\R")) {
                String line = rawLine.trim();
                if (line.startsWith("{")) {
                    addCredit(credits, parseMetadataJson(line));
                } else {
                    addCredit(credits, parseCreditText(
                        TIMING_PATTERN.matcher(line).replaceAll("").trim(),
                        parseClockTime(line)
                    ));
                }
            }
        }
        return List.copyOf(credits.values());
    }

    private static LyricCredit parseMetadataJson(String line) {
        try {
            JsonNode metadata = OBJECT_MAPPER.readTree(line);
            JsonNode chunks = metadata.path("c");
            if (!chunks.isArray()) {
                return null;
            }
            StringBuilder text = new StringBuilder();
            for (JsonNode chunk : chunks) {
                if (chunk.path("tx").isTextual()) {
                    text.append(chunk.path("tx").asText());
                }
            }
            Double time = metadata.path("t").isNumber()
                ? metadata.path("t").asDouble() / 1000.0
                : null;
            return parseCreditText(text.toString().trim(), time);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static LyricCredit parseCreditText(String text, Double time) {
        Matcher matcher = CREDIT_PATTERN.matcher(text);
        if (!matcher.matches()) {
            return null;
        }
        String label = matcher.group(1).trim();
        if (!isCreditLabel(label)) {
            return null;
        }
        String value = matcher.group(2).trim();
        return new LyricCredit(label, value, time);
    }

    private static Double parseClockTime(String line) {
        Matcher matcher = CLOCK_TIMING_PATTERN.matcher(line);
        if (!matcher.find()) {
            return null;
        }
        double minutes = Double.parseDouble(matcher.group(1));
        double seconds = Double.parseDouble(matcher.group(2));
        String fractionText = matcher.group(3);
        double fraction = fractionText == null
            ? 0
            : Double.parseDouble(fractionText) / Math.pow(10, fractionText.length());
        return minutes * 60 + seconds + fraction;
    }

    private static boolean isCreditLabel(String label) {
        String normalized = label.toLowerCase(Locale.ROOT);
        return CREDIT_HINTS.stream().anyMatch(normalized::contains);
    }

    private static void addCredit(Map<String, LyricCredit> credits, LyricCredit credit) {
        if (credit == null) {
            return;
        }
        String key = credit.label() + "\u0000" + credit.value();
        credits.putIfAbsent(key, credit);
    }

    private static String rawId(String trackId) {
        if (trackId == null || trackId.isBlank()) {
            throw new IllegalArgumentException("歌曲 ID 不能为空");
        }
        int separator = trackId.indexOf(':');
        return separator >= 0 ? trackId.substring(separator + 1) : trackId;
    }

    private static String normalizeCoverUrl(String coverUrl) {
        if (coverUrl.startsWith("https://p") && coverUrl.contains(".music.126.net/")) {
            return "http://" + coverUrl.substring("https://".length());
        }
        return coverUrl;
    }

    private static String textAt(JsonNode root, String parent, String child) {
        JsonNode value = root.path(parent).path(child);
        return value.isTextual() ? value.asText() : "";
    }

    private static String firstTextAt(JsonNode root, String[]... paths) {
        for (String[] path : paths) {
            if (path.length != 2) {
                continue;
            }
            String value = textAt(root, path[0], path[1]);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static boolean isPrivatePlaylist(String title) {
        String normalized = title == null ? "" : title.toLowerCase(Locale.ROOT);
        return normalized.contains("私人雷达") || normalized.contains("私人fm");
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }
}
