package com.listenmusic.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
public class QqMusicProvider implements MusicProvider {
    private static final String PROVIDER_ID = "qq";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;

    public QqMusicProvider(
        RestClient.Builder restClientBuilder,
        @Value("${listenmusic.providers.qq.base-url:http://127.0.0.1:3300}") String baseUrl,
        AccountRepository accountRepository,
        CredentialStore credentialStore
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
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
            .path("/search")
            .queryParam("key", query.trim())
            .queryParam("pageNo", 1)
            .queryParam("pageSize", 30)
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
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/search")
            .queryParam("key", query.trim())
            .queryParam("pageNo", pageNumber)
            .queryParam("pageSize", pageSize)
            .queryParam("t", type.qqValue())
            .build(), null);
        ensureSuccess(root);

        JsonNode data = root.path("data");
        JsonNode items = firstArray(
            root, "data/list", "data/song/list", "data/singer/list", "data/playlist/list",
            "data/body/song/list", "data/body/singer/list", "list"
        );
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
                    String id = firstText(item.path("singermid"), item.path("mid"), item.path("id"));
                    String name = firstText(item.path("singername"), item.path("name"), item.path("title"));
                    if (!id.isBlank() && !name.isBlank()) {
                        String imageUrl = firstText(item.path("pic"), item.path("picurl"), item.path("avatar"));
                        if (imageUrl.isBlank()) {
                            imageUrl = "https://y.gtimg.cn/music/photo_new/T001R300x300M000" + id + ".jpg";
                        }
                        artists.add(new SearchArtist(
                            PROVIDER_ID + ":" + id,
                            name,
                            imageUrl,
                            firstInt(item.path("albumNum"), item.path("album_count")),
                            firstInt(item.path("songNum"), item.path("song_count")),
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
        long total = firstLong(
            data.path("total"), data.path("totalnum"), data.path("sum"),
            data.path("song").path("totalnum"), data.path("singer").path("totalnum")
        );
        if (total <= 0) {
            total = pageOffset + resultCount;
        }
        return new SearchResultPage(
            List.copyOf(songs), List.copyOf(playlists), List.copyOf(artists), total,
            pageOffset + resultCount < total
        );
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
        JsonNode root = get(uriBuilder -> {
            var builder = uriBuilder
                .path("/song/url")
                .queryParam("id", id)
                .queryParam("type", 128);
            if (credential != null) {
                builder.queryParam("ownCookie", 1);
            }
            return builder.build();
        }, credential);
        ensureSuccess(root);
        String url = firstText(root.path("data"), root.path("url"));
        if (url.isBlank() && root.path("data").isObject()) {
            url = firstText(root.path("data").path(id), root.path("data").path("url"));
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

    @Override
    public Optional<LyricData> loadLyrics(String trackId) {
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/lyric")
            .queryParam("songmid", rawId(trackId))
            .build(), null);
        ensureSuccess(root);
        JsonNode data = root.path("data").isObject() ? root.path("data") : root;
        String lyric = firstText(data.path("lyric"), root.path("lyric"));
        if (lyric.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(new LyricData(
            lyric,
            firstText(data.path("trans"), data.path("translation"), root.path("trans")),
            "lrc",
            PROVIDER_ID,
            List.of()
        ));
    }

    @Override
    public List<Track> loadAccountRecommendations(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/recommend/daily")
            .queryParam("ownCookie", 1)
            .build(), credential);
        return tracksFrom(root);
    }

    @Override
    public List<HomepagePlaylist> loadAccountPlaylists(String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/recommend/playlist/u")
            .queryParam("ownCookie", 1)
            .build(), credential);
        ensureSuccess(root);
        JsonNode items = firstArray(root, "data/list", "data", "list", "playlist");
        if (items == null) {
            return List.of();
        }
        List<HomepagePlaylist> playlists = new ArrayList<>();
        for (JsonNode item : items) {
            String id = firstText(item.path("dissid"), item.path("id"), item.path("tid"));
            String title = firstText(item.path("dissname"), item.path("title"), item.path("name"));
            if (id.isBlank() || title.isBlank()) {
                continue;
            }
            playlists.add(new HomepagePlaylist(
                PROVIDER_ID + ":" + id,
                title,
                firstNonBlank(firstText(item.path("creator_name"), item.path("subtitle")), "QQ 音乐推荐"),
                firstText(item.path("imgurl"), item.path("logo"), item.path("picurl"), item.path("cover")),
                firstInt(item.path("songnum"), item.path("song_count"), item.path("count"))
            ));
        }
        return playlists;
    }

    @Override
    public List<Track> loadAccountPlaylist(String playlistId, String accountId, String credential) {
        requireCredential(accountId, credential);
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/songlist")
            .queryParam("id", rawId(playlistId))
            .queryParam("ownCookie", 1)
            .build(), credential);
        return tracksFrom(root);
    }

    @Override
    public List<Track> loadPlaylist(String playlistId) {
        JsonNode root = get(uriBuilder -> uriBuilder
            .path("/songlist")
            .queryParam("id", rawId(playlistId))
            .build(), null);
        return tracksFrom(root);
    }

    private List<Track> tracksFrom(JsonNode root) {
        ensureSuccess(root);
        JsonNode items = firstArray(
            root,
            "data/songlist", "data/list", "data/song_list", "data/tracks", "data/track_list",
            "songlist", "list", "songs"
        );
        if (items == null && root.path("data").path("cdlist").isArray() && !root.path("data").path("cdlist").isEmpty()) {
            items = root.path("data").path("cdlist").get(0).path("songlist");
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
        String albumMid = firstText(song.path("albummid"), song.path("album").path("mid"));
        String albumName = firstNonBlank(
            firstText(song.path("albumname"), song.path("album").path("name"), song.path("album").path("title")),
            "未知专辑"
        );
        long duration = song.path("interval").asLong(0);
        if (duration <= 0) {
            duration = Math.round(song.path("duration").asLong(0) / 1000.0);
        }
        String coverUrl = albumMid.isBlank()
            ? firstText(song.path("cover"), song.path("picurl"))
            : "https://y.gtimg.cn/music/photo_new/T002R300x300M000" + albumMid + ".jpg";
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
        return names.isEmpty() ? "未知歌手" : String.join("/", names);
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
