package com.listenmusic.provider;

import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class QqMusicProviderTest {
    private MockRestServiceServer server;
    private QqMusicProvider provider;
    private AccountRepository accountRepository;
    private CredentialStore credentialStore;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        accountRepository = mock(AccountRepository.class);
        credentialStore = mock(CredentialStore.class);
        provider = new QqMusicProvider(builder, "http://qq-api.test", accountRepository, credentialStore);
    }

    @Test
    void mapsDailyRecommendationsUsingTheAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/getDailyRecommend")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"recommend":{"code":0,"data":{"songlist":[
                  {"songmid":"mid-1","songname":"推荐歌曲","singer":[{"name":"歌手"}],
                   "albumname":"专辑","albummid":"album-1","interval":180}
                ]}}}}
                """, MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountRecommendations("200", cookie);

        assertEquals(1, tracks.size());
        assertEquals("qq:mid-1", tracks.getFirst().id());
        assertEquals("推荐歌曲", tracks.getFirst().title());
        server.verify();
    }

    @Test
    void loadsQqLikedSongsFromTheAccountFavoritePlaylist() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getUserLikedSongs?uin=200&offset=0&limit=1000")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"info":{"id":"778899","songCount":1}}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/getSongListDetail?disstid=778899")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"cdlist":[{"songlist":[
                  {"mid":"mid-liked-1","title":"喜欢的歌","singer":[{"name":"歌手"}],
                   "album":{"mid":"album-liked-1","name":"专辑"},"interval":180}
                ]}]}}
                """, MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountFavorites("200", cookie);

        assertEquals(1, tracks.size());
        assertEquals("qq:mid-liked-1", tracks.getFirst().id());
        server.verify();
    }

    @Test
    void loadsWordTimedQqLyricsFromTheSupportedRoute() {
        String cookie = "uin=o200; qm_keyst=secret";
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ 用户", null, "qq-ref", true, "now", "now"
        )));
        when(credentialStore.get("qq-ref")).thenReturn(Optional.of(cookie));
        server.expect(requestTo("http://qq-api.test/getLyric?songmid=mid-lyric-1&isFormat=1"))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,
                 "lyric":"[00:01.00]普通歌词",
                 "qrc":"[1000,1000]逐(1000,500)字(1500,500)",
                 "trans":"[00:01.00]translation"}}
                """, MediaType.APPLICATION_JSON));

        LyricData lyrics = provider.loadLyrics("qq:mid-lyric-1").orElseThrow();

        assertEquals("[1000,1000]逐(1000,500)字(1500,500)", lyrics.lyrics());
        assertEquals("[00:01.00]translation", lyrics.translation());
        assertEquals("QRC", lyrics.format());
        assertEquals("qq", lyrics.source());
        server.verify();
    }

    @Test
    void updatesQqSongFavoriteUsingTheAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo("http://qq-api.test/user/setSongFavorite"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andExpect(content().json("{\"mid\":\"mid-liked-1\",\"liked\":true}"))
            .andRespond(withSuccess("{\"response\":{\"code\":0}}", MediaType.APPLICATION_JSON));

        provider.setAccountFavorite("200", "qq:mid-liked-1", true, cookie);

        server.verify();
    }

    @Test
    void mapsQqRankPlaylistThroughTheCatalogTemplate() {
        server.expect(requestTo(containsString("/getRanks?topId=62&limit=30&resolveMid=true")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{"data":{"song":[
                  {"mid":"mid-rank-1","title":"自己就是自己的光","singer":[{"name":"周深"}],
                   "album":{"mid":"album-rank-1","name":"自己就是自己的光"},"interval":287,
                   "cover":"https://img.test/rank.jpg"}
                ]}}}}}
                """, MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadPlaylist("qq:rank-62");

        assertEquals(1, tracks.size());
        assertEquals("qq:mid-rank-1", tracks.getFirst().id());
        assertEquals("自己就是自己的光", tracks.getFirst().title());
        assertEquals("周深", tracks.getFirst().artist());
        assertEquals(287, tracks.getFirst().duration());
        assertEquals("https://img.test/rank.jpg", tracks.getFirst().coverUrl());
        server.verify();
    }

    @Test
    void loadsQqPlaylistDetailFromTheSupportedApiRoute() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/getSongListDetail?disstid=8075336924")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"cdlist":[{"songlist":[
                  {"mid":"mid-list-1","title":"江南","singer":[{"name":"林俊杰"}],
                   "album":{"mid":"album-list-1","name":"第二天堂"},"interval":267}
                ]}]}}
                """, MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountPlaylist("qq:8075336924", "200", cookie);

        assertEquals(1, tracks.size());
        assertEquals("qq:mid-list-1", tracks.getFirst().id());
        assertEquals("江南", tracks.getFirst().title());
        server.verify();
    }

    @Test
    void mapsPersonalizedPlaylistsUsingTheAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getUserPlaylists?uin=200&offset=0&limit=100")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"playlists":[
                  {"tid":"99","diss_name":"我的 QQ 歌单","cover_url_small":"https://img.test/list.jpg","song_cnt":20}
                ]}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/user/getUserCollectedSongLists?uin=200&page=1&limit=100")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"cdlist":[
                  {"dissid":"88","dissname":"收藏的 QQ 歌单","logo":"https://img.test/collected.jpg","songnum":16}
                ]}}}
                """, MediaType.APPLICATION_JSON));

        List<HomepagePlaylist> playlists = provider.loadAccountPlaylists("200", cookie);

        assertEquals(2, playlists.size());
        assertEquals("qq:99", playlists.getFirst().id());
        assertEquals("我的 QQ 歌单", playlists.getFirst().title());
        assertEquals(true, playlists.getFirst().createdByAccount());
        assertEquals("qq:88", playlists.get(1).id());
        assertEquals(false, playlists.get(1).createdByAccount());
        server.verify();
    }

    @Test
    void refreshesTheLoggedInQqAccountForTheLibraryProfile() {
        String cookie = "uin=o200; qm_keyst=secret";
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "旧昵称", "https://img.test/old.jpg", "qq-ref", true, "created", "updated"
        )));
        server.expect(requestTo(containsString("/user/getUserDetail?uin=200")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"creator":{
                  "nick":"手机端新昵称","headpic":"https://img.test/new.jpg",
                  "desc":"新的个人简介","nums":{"follownum":3,"fansnum":4,
                  "followusernum":1,"followsingernum":2}
                }}}}
                """, MediaType.APPLICATION_JSON));

        AccountProfile profile = provider.loadAccountProfile("200", cookie);

        assertEquals("qq", profile.provider());
        assertEquals("200", profile.userId());
        assertEquals("手机端新昵称", profile.nickname());
        assertEquals("https://img.test/new.jpg", profile.avatarUrl());
        assertEquals("新的个人简介", profile.signature());
        assertEquals(3, profile.follows());
        assertEquals(4, profile.followers());
        verify(accountRepository).saveAccount(argThat(account ->
            "手机端新昵称".equals(account.nickname())
                && "https://img.test/new.jpg".equals(account.avatarUrl())
                && "qq-ref".equals(account.credentialReference())
        ));
        server.verify();
    }

    @Test
    void loadsFollowedQqSingersAndResolvesTheirPublicProfiles() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getUserFollowSingers?uin=200&page=1&limit=100")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{"vec_userinfo":[
                  {"usertype":1,"userid":"16033547","time":1790231766}
                ]}}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/getSingerHotsong?singerid=16033547&limit=1&page=1")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"singer":{"code":0,"data":{
                  "singer_info":{"id":16033547,"mid":"002wbPaC0L9C3A","name":"鸣潮先约电台","fans":332123},
                  "singer_brief":"愿世界在你眼前展开！","total_album":84,"total_song":943
                }}}}
                """, MediaType.APPLICATION_JSON));

        List<AccountSocialUser> following = provider.loadAccountFollowing("200", cookie, 100, 0);

        assertEquals(1, following.size());
        AccountSocialUser artist = following.getFirst();
        assertEquals("qq:002wbPaC0L9C3A", artist.userId());
        assertEquals("鸣潮先约电台", artist.nickname());
        assertEquals("https://y.gtimg.cn/music/photo_new/T001R300x300M000002wbPaC0L9C3A.jpg", artist.avatarUrl());
        assertEquals("愿世界在你眼前展开！", artist.signature());
        assertEquals("artist", artist.type());
        assertEquals(84, artist.albumCount());
        assertEquals(943, artist.trackCount());
        server.verify();
    }

    @Test
    void loadsQqFollowersFromTheCurrentRelationServiceResponse() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getUserFans?uin=200&page=2&limit=20")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{
                  "Total":21,"HasMore":false,"List":[{
                    "MID":"10001","EncUin":"ENC_FAN_1","Name":"喜欢音乐的人",
                    "Desc":"保持热爱","AvatarUrl":"https://img.test/fan.jpg","FanNum":7
                  }]
                }}}}
                """, MediaType.APPLICATION_JSON));

        List<AccountSocialUser> followers = provider.loadAccountFollowers("200", cookie, 20, 20);

        assertEquals(1, followers.size());
        AccountSocialUser follower = followers.getFirst();
        assertEquals("qq", follower.provider());
        assertEquals("ENC_FAN_1", follower.userId());
        assertEquals("喜欢音乐的人", follower.nickname());
        assertEquals("https://img.test/fan.jpg", follower.avatarUrl());
        assertEquals("保持热爱", follower.signature());
        assertEquals("user", follower.type());
        server.verify();
    }

    @Test
    void loadsASelectedQqFollowerProfile() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getUserDetail?uin=ENC_FAN_1")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"creator":{
                  "encrypt_uin":"ENC_FAN_1","nick":"喜欢音乐的人",
                  "headpic":"https://img.test/fan.jpg","desc":"保持热爱",
                  "nums":{"follownum":12,"fansnum":7}
                }}}}
                """, MediaType.APPLICATION_JSON));

        AccountProfile profile = provider.loadUserProfile("ENC_FAN_1", cookie);

        assertEquals("qq", profile.provider());
        assertEquals("ENC_FAN_1", profile.userId());
        assertEquals("喜欢音乐的人", profile.nickname());
        assertEquals("https://img.test/fan.jpg", profile.avatarUrl());
        assertEquals("保持热爱", profile.signature());
        assertEquals(12, profile.follows());
        assertEquals(7, profile.followers());
        server.verify();
    }

    @Test
    void mapsCuratedHomePlaylistsFromQqRecommend() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/getRecommend")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"recomPlaylist":{"code":0,"data":{"v_hot":[
                  {"content_id":"8075336924","title":"90后回忆","cover":"https://img.test/list.jpg",
                   "username":"听风","listen_num":146746133}
                ]}}}}
                """, MediaType.APPLICATION_JSON));

        List<HomepagePlaylist> playlists = provider.loadAccountFeaturedPlaylists("200", cookie);

        assertEquals(1, playlists.size());
        assertEquals("qq:8075336924", playlists.getFirst().id());
        assertEquals("90后回忆", playlists.getFirst().title());
        assertEquals("听风", playlists.getFirst().subtitle());
        assertEquals("https://img.test/list.jpg", playlists.getFirst().imageUrl());
        server.verify();
    }

    @Test
    void mapsQqPlaylistCategoriesAndDiscoveryPage() {
        server.expect(requestTo(containsString("/getSongListCategories")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"categories":[
                  {"categoryGroupName":"热门","items":[
                    {"categoryId":10000000,"categoryName":"全部"}
                  ]},
                  {"categoryGroupName":"语种","items":[
                    {"categoryId":165,"categoryName":"国语"},
                    {"categoryId":167,"categoryName":"英语"}
                  ]},
                  {"categoryGroupName":"流派","items":[
                    {"categoryId":15,"categoryName":"轻音乐"},
                    {"categoryId":8,"categoryName":"R&#38;B"}
                  ]},
                  {"categoryGroupName":"场景","items":[
                    {"categoryId":101,"categoryName":"学习"}
                  ]}
                ]}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/getSongLists?categoryId=15&sortId=5&page=0&limit=30")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"sum":11619,"list":[
                  {"dissid":"7729596131","dissname":"耳机里的秘密","imgurl":"https://img.test/discovery.jpg",
                   "listennum":55494743,"creator":{"name":"腾讯音乐人"}}
                ]}}}
                """, MediaType.APPLICATION_JSON));

        PlaylistCategoryData categories = provider.loadPlaylistCategories();

        assertEquals(List.of("全部"), categories.hotTags());
        assertEquals(List.of("全部"), categories.groups().get("热门"));
        assertEquals(List.of("国语", "英语"), categories.groups().get("语种"));
        assertEquals(List.of("轻音乐", "R&B"), categories.groups().get("流派"));
        assertEquals(List.of("学习"), categories.groups().get("场景"));

        PlaylistDiscoveryPage page = provider.loadPlaylists("轻音乐", "hot", 30, 0);

        assertEquals(11619, page.total());
        assertEquals(1, page.playlists().size());
        assertEquals("qq:7729596131", page.playlists().getFirst().id());
        assertEquals("腾讯音乐人", page.playlists().getFirst().subtitle());
        assertEquals(55494743, page.playlists().getFirst().playCount());
        server.verify();
    }

    @Test
    void mapsSongsFromTheDeployedQqSearchApiResponse() {
        server.expect(requestTo(containsString("/getSearchByKey?key=%E5%85%88%E7%BA%A6&limit=3&page=1&remoteplace=song")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"song":{"totalnum":600,"list":[
                  {"songmid":"mid-search-1","songname":"心月辞·长相望",
                   "singer":[{"mid":"singer-1","name":"鸣潮先约电台"}],
                   "albumname":"心月辞","albummid":"album-search-1","interval":216}
                ]}}}}
                """, MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("先约", SearchType.SONG, 3, 0);

        assertEquals(600, result.total());
        assertEquals(1, result.songs().size());
        assertEquals("qq:mid-search-1", result.songs().getFirst().id());
        assertEquals("心月辞·长相望", result.songs().getFirst().title());
        assertEquals("鸣潮先约电台", result.songs().getFirst().artist());
        assertEquals("心月辞", result.songs().getFirst().album());
        assertEquals(true, result.hasMore());
        server.verify();
    }

    @Test
    void searchesPlaylistsWithQqPagination() {
        server.expect(requestTo(containsString("/searchByType?key=%E9%B8%A3%E6%BD%AE&limit=8&page=3&type=playlist")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{"body":{"songlist":{"list":[
                  {"dissid":"99","dissname":"鸣潮精选","imgurl":"https://img.test/list.jpg","songnum":20,
                   "creator":{"name":"QQ 编辑"}}
                ]}},"meta":{"sum":18}}}}}
                """, MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("鸣潮", SearchType.PLAYLIST, 8, 16);

        assertEquals(18, result.total());
        assertEquals(1, result.playlists().size());
        assertEquals("qq:99", result.playlists().getFirst().id());
        assertEquals("鸣潮精选", result.playlists().getFirst().title());
        server.verify();
    }

    @Test
    void doesNotTreatSongOnlyResponsesAsPlaylistResults() {
        server.expect(requestTo(containsString("/searchByType?key=%E5%85%88%E7%BA%A6&limit=8&page=1&type=playlist")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"data":{"song":{"totalnum":600,"list":[
                  {"songmid":"mid-search-1","songname":"心月辞·长相望","singer":[{"name":"鸣潮先约电台"}]}
                ]}}}}
                """, MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("先约", SearchType.PLAYLIST, 8, 0);

        assertEquals(0, result.total());
        assertEquals(0, result.playlists().size());
        assertEquals(false, result.hasMore());
        server.verify();
    }

    @Test
    void searchesArtistsThroughQqCatalogSearch() {
        String cookie = "uin=o200; qm_keyst=secret";
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ 用户", null, "qq-ref", true, "now", "now"
        )));
        when(credentialStore.get("qq-ref")).thenReturn(Optional.of(cookie));
        server.expect(requestTo(containsString("/searchByType?key=%E5%85%88%E7%BA%A6%E7%94%B5%E5%8F%B0&limit=8&page=1&type=artist")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{"body":{"singer":{"list":[
                  {"singerID":16033547,"singerMID":"002wbPaC0L9C3A","singerName":"鸣潮先约电台",
                   "singerPic":"https://img.test/pioneer.jpg","songNum":943,"albumNum":84}
                ]}},"meta":{"sum":1}}}}}
                """, MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("先约电台", SearchType.ARTIST, 8, 0);

        assertEquals(1, result.total());
        assertEquals(1, result.artists().size());
        assertEquals("qq:002wbPaC0L9C3A", result.artists().getFirst().id());
        assertEquals("鸣潮先约电台", result.artists().getFirst().name());
        assertEquals("https://img.test/pioneer.jpg", result.artists().getFirst().imageUrl());
        assertEquals(943, result.artists().getFirst().trackCount());
        assertEquals(84, result.artists().getFirst().albumCount());
        assertEquals(false, result.hasMore());
        server.verify();
    }

    @Test
    void loadsQqArtistDetailAndSongs() {
        server.expect(requestTo(containsString("/getSingerHotsong?singermid=002wbPaC0L9C3A&limit=1&page=1")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"singer":{"code":0,"data":{
                  "singer_info":{"mid":"002wbPaC0L9C3A","name":"鸣潮先约电台"},
                  "singer_brief":"愿世界在你眼前展开！","total_album":84,"total_song":943,
                  "songlist":[]
                }}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/getSingerHotsong?singermid=002wbPaC0L9C3A&limit=50&page=1")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"singer":{"code":0,"data":{
                  "total_song":943,"songlist":[
                    {"mid":"0038W0WD0TlByu","name":"远航星的告别","interval":225,
                     "singer":[{"name":"鸣潮先约电台"}],
                     "album":{"mid":"004fGHuo31YOxu","name":"星轨消逝之夜"}}
                  ]
                }}}}
                """, MediaType.APPLICATION_JSON));

        ArtistDetail detail = provider.loadArtistDetail("qq:002wbPaC0L9C3A");
        ArtistSongPage songs = provider.loadArtistSongs("qq:002wbPaC0L9C3A", "hot", 50, 0);

        assertEquals("鸣潮先约电台", detail.name());
        assertEquals("愿世界在你眼前展开！", detail.signature());
        assertEquals(84, detail.albumCount());
        assertEquals(943, detail.trackCount());
        assertEquals(943, songs.total());
        assertEquals(1, songs.songs().size());
        assertEquals("远航星的告别", songs.songs().getFirst().title());
        assertEquals(true, songs.hasMore());
        server.verify();
    }

    @Test
    void loadsQqArtistAlbums() {
        server.expect(requestTo(containsString("/getSingerAlbum?singermid=002wbPaC0L9C3A&limit=30&page=0")))
            .andRespond(withSuccess("""
                {"response":{"code":0,"singer":{"code":0,"data":{"total":84,"albumList":[
                  {"albumMid":"002GQ6WM3Q96hQ","albumName":"心月辞","publishDate":"2026-09-17","totalNum":12}
                ]}}}}
                """, MediaType.APPLICATION_JSON));

        List<ArtistAlbum> albums = provider.loadArtistAlbums("qq:002wbPaC0L9C3A", 30, 0);

        assertEquals(1, albums.size());
        assertEquals("qq:002GQ6WM3Q96hQ", albums.getFirst().id());
        assertEquals("心月辞", albums.getFirst().title());
        assertEquals(12, albums.getFirst().trackCount());
        assertEquals("2026-09-17", albums.getFirst().releaseDate());
        server.verify();
    }

    @Test
    void readsAndUpdatesQqArtistSubscription() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/user/getSingerSubscription?singermid=002wbPaC0L9C3A")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{
                  "map_singer_status":{"002wbPaC0L9C3A":1}
                }}}}
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://qq-api.test/user/setSingerSubscription"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andExpect(content().json("{\"singermid\":\"002wbPaC0L9C3A\",\"subscribed\":false}"))
            .andRespond(withSuccess("""
                {"response":{"code":0,"req_1":{"code":0,"data":{}}}}
                """, MediaType.APPLICATION_JSON));

        assertEquals(true, provider.isArtistSubscribed("200", "qq:002wbPaC0L9C3A", cookie));
        provider.setArtistSubscription("200", "qq:002wbPaC0L9C3A", false, cookie);

        server.verify();
    }

    @Test
    void updatesQqPlaylistSubscriptionUsingTheAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo("http://qq-api.test/user/setPlaylistSubscription"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andExpect(content().json("{\"id\":\"778899\",\"subscribed\":true}"))
            .andRespond(withSuccess("{\"response\":{\"code\":0}}", MediaType.APPLICATION_JSON));

        provider.setPlaylistSubscription("200", "qq:778899", true, cookie);

        server.verify();
    }

    @Test
    void resolvesAudioUrlUsingTheActiveAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ 用户", null, "qq-ref", true, "now", "now"
        )));
        when(credentialStore.get("qq-ref")).thenReturn(Optional.of(cookie));
        server.expect(requestTo(containsString("/getMusicPlay?songmid=mid-1&quality=128")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"data":{"playUrl":{"mid-1":{"url":"https://audio.test/song.mp3"}}}}
                """, MediaType.APPLICATION_JSON));

        Optional<String> audioUrl = provider.resolveAudioUrl("qq:mid-1");

        assertEquals("https://audio.test/song.mp3", audioUrl.orElseThrow());
        server.verify();
    }

    @Test
    void keepsTheActiveAccountWhenOneTrackReportsAPlaybackLoginError() {
        String cookie = "uin=o200; qm_keyst=expired";
        ProviderAccount account = new ProviderAccount(
            "qq", "200", "QQ 用户", null, "qq-ref", true, "now", "now"
        );
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(account));
        when(credentialStore.get("qq-ref")).thenReturn(Optional.of(cookie));
        server.expect(requestTo(containsString("/getMusicPlay?songmid=mid-locked&quality=128")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"data":{"playUrl":{"mid-locked":{"url":"","error":"Cookie 已失效或 uin 缺失"}}}}
                """, MediaType.APPLICATION_JSON));

        assertThrows(ProviderLoginRequiredException.class, () -> provider.resolveAudioUrl("qq:mid-locked"));
        verify(credentialStore, never()).delete("qq-ref");
        verify(accountRepository, never()).deactivateProvider("qq");
        server.verify();
    }
}
