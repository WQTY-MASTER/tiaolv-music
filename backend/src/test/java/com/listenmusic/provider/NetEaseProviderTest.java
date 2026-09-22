package com.listenmusic.provider;

import com.listenmusic.domain.Track;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.hamcrest.Matchers.startsWith;

class NetEaseProviderTest {
    private MockRestServiceServer server;
    private NetEaseProvider provider;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        provider = new NetEaseProvider(builder, "http://api.test");
    }

    @Test
    void mapsSearchSongsToTheInternalTrackModel() {
        server.expect(requestTo(startsWith("http://api.test/cloudsearch?keywords=%E6%99%B4%E5%A4%A9&type=1&limit=20&noCookie=true")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "result": {
                    "songs": [
                      {
                        "id": 123,
                        "name": "晴天",
                        "dt": 269000,
                        "ar": [{"name": "周杰伦"}, {"name": "现场乐队"}],
                        "al": {"name": "叶惠美", "picUrl": "https://img.test/cover.jpg"}
                      }
                    ]
                  }
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.search("晴天");

        assertEquals(1, tracks.size());
        Track track = tracks.get(0);
        assertEquals("netease:123", track.id());
        assertEquals("晴天", track.title());
        assertEquals("周杰伦、现场乐队", track.artist());
        assertEquals("叶惠美", track.album());
        assertEquals(269L, track.duration());
        assertEquals("netease", track.source());
        assertEquals("https://img.test/cover.jpg", track.coverUrl());
        server.verify();
    }

    @Test
    void searchesPlaylistsWithCloudSearchPagination() {
        server.expect(requestTo("http://api.test/cloudsearch?keywords=%E9%B8%A3%E6%BD%AE&type=1000&limit=8&offset=16&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"result":{"playlistCount":21,"playlists":[
                  {"id":88,"name":"鸣潮歌单","coverImgUrl":"https://img.test/list.jpg","trackCount":42,
                   "playCount":12345,"creator":{"nickname":"编辑"}}
                ]}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("鸣潮", SearchType.PLAYLIST, 8, 16);

        assertEquals(21, result.total());
        assertEquals(1, result.playlists().size());
        assertEquals("netease:88", result.playlists().getFirst().id());
        assertEquals("鸣潮歌单", result.playlists().getFirst().title());
        assertEquals("编辑", result.playlists().getFirst().subtitle());
        assertTrue(result.hasMore());
        server.verify();
    }

    @Test
    void searchesArtistsWithCloudSearchTypeOneHundred() {
        server.expect(requestTo("http://api.test/cloudsearch?keywords=%E5%91%A8%E6%9D%B0%E4%BC%A6&type=100&limit=8&offset=0&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"result":{"artistCount":1,"artists":[
                  {"id":6452,"name":"周杰伦","picUrl":"https://img.test/artist.jpg","albumSize":39,"musicSize":512}
                ]}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("周杰伦", SearchType.ARTIST, 8, 0);

        assertEquals(1, result.total());
        assertEquals(1, result.artists().size());
        assertEquals("netease:6452", result.artists().getFirst().id());
        assertEquals("周杰伦", result.artists().getFirst().name());
        assertEquals(512, result.artists().getFirst().trackCount());
        server.verify();
    }

    @Test
    void resolvesPlaybackUrlFromTheNeteaseApi() {
        server.expect(requestTo("http://api.test/song/url/v1?id=123&level=standard"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"data":[{"id":123,"url":"https://audio.test/song.mp3"}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        assertEquals(
            "https://audio.test/song.mp3",
            provider.resolveAudioUrl("netease:123").orElseThrow()
        );
        server.verify();
    }

    @Test
    void prefersWordTimedLyricsFromTheNewLyricEndpoint() {
        server.expect(requestTo(startsWith("http://api.test/lyric/new?id=123&noCookie=true")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "lrc": {"lyric": "[00:01.00]晴天"},
                  "tlyric": {"lyric": "[00:01.00]A sunny day"},
                  "yrc": {
                    "lyric": "{\\"t\\":0,\\"c\\":[{\\"tx\\":\\"作词: \\"},{\\"tx\\":\\"Xulai\\"}]}\\n[1000,1000](1000,500,0)晴(1500,500,0)天"
                  }
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        LyricData lyrics = provider.loadLyrics("netease:123").orElseThrow();

        assertTrue(lyrics.lyrics().contains("[1000,1000](1000,500,0)晴(1500,500,0)天"));
        assertTrue(lyrics.lyrics().contains("\"tx\":\"作词: \""));
        assertEquals("[00:01.00]A sunny day", lyrics.translation());
        assertEquals("YRC", lyrics.format());
        assertTrue(lyrics.source().equals("netease"));
        assertEquals(
            List.of(
                new LyricCredit("作词", "Xulai", 0.0)
            ),
            lyrics.credits()
        );
        server.verify();
    }

    @Test
    void fallsBackToTheLegacyLyricEndpointWhenNewEndpointIsUnavailable() {
        server.expect(requestTo(startsWith("http://api.test/lyric/new?id=123&noCookie=true")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withStatus(
                org.springframework.http.HttpStatus.NOT_FOUND
            ));
        server.expect(requestTo(startsWith("http://api.test/lyric?id=123&noCookie=true")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "lrc": {"lyric": "[00:01.00]晴天"},
                  "tlyric": {"lyric": "[00:01.00]A sunny day"},
                  "yrc": {"lyric": ""}
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        LyricData lyrics = provider.loadLyrics("netease:123").orElseThrow();

        assertEquals("[00:01.00]晴天", lyrics.lyrics());
        assertEquals("LRC", lyrics.format());
        server.verify();
    }

    @Test
    void proxiesTheRemoteCoverThroughTheProvider() {
        server.expect(requestTo(startsWith("http://api.test/song/detail?ids=123&noCookie=true")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "songs": [
                    {
                      "id": 123,
                      "name": "晴天",
                      "dt": 269000,
                      "ar": [{"name": "周杰伦"}],
                      "al": {"name": "叶惠美", "picUrl": "https://p4.music.126.net/test-cover.jpg"}
                    }
                  ]
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://p4.music.126.net/test-cover.jpg"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess(new byte[] {1, 2, 3}, org.springframework.http.MediaType.IMAGE_JPEG));

        CoverData cover = provider.loadCover("netease:123").orElseThrow();

        assertEquals("image/jpeg", cover.contentType());
        assertEquals(3, cover.bytes().length);
        server.verify();
    }

    @Test
    void mapsHomepageBlocksToBannersPlaylistsAndSongs() {
        server.expect(requestTo("http://api.test/homepage/block/page?refresh=false"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "data": {
                    "cursor": "next-cursor",
                    "hasMore": true,
                    "blocks": [
                      {
                        "blockCode": "HOMEPAGE_BANNER",
                        "extInfo": {"banners": [{"pic": "https://img.test/banner.jpg", "targetId": 123, "targetType": 1, "typeTitle": "新歌"}]}
                      },
                      {
                        "blockCode": "HOMEPAGE_BLOCK_PLAYLIST_RCMD",
                        "creatives": [{
                          "resources": [{
                            "resourceId": "456",
                            "uiElement": {"mainTitle": {"title": "推荐歌单"}, "image": {"imageUrl": "https://img.test/playlist.jpg"}}
                          }]
                        }]
                      },
                      {
                        "blockCode": "HOMEPAGE_BLOCK_STYLE_RCMD",
                        "creatives": [{
                          "resources": [{
                            "resourceType": "song",
                            "resourceId": "789",
                            "uiElement": {"image": {"imageUrl": "https://img.test/song.jpg"}},
                            "resourceExtInfo": {"song": {"id": 789, "name": "推荐歌曲", "dt": 180000, "ar": [{"name": "推荐歌手"}], "al": {"name": "推荐专辑", "picUrl": "https://img.test/song.jpg"}}}
                          }]
                        }]
                      }
                    ]
                  }
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        HomepageData homepage = provider.loadHomepage(false, null);

        assertEquals("next-cursor", homepage.cursor());
        assertTrue(homepage.hasMore());
        assertEquals("https://img.test/banner.jpg", homepage.banners().get(0).imageUrl());
        assertEquals("netease:456", homepage.playlists().get(0).id());
        assertEquals("推荐歌单", homepage.playlists().get(0).title());
        assertEquals("netease:789", homepage.songs().get(0).id());
        assertEquals("推荐歌曲", homepage.songs().get(0).title());
        server.verify();
    }

    @Test
    void bypassesTheNodeCacheWhenRefreshingHomepageRecommendations() {
        server.expect(requestTo(startsWith("http://api.test/homepage/block/page?refresh=true&timestamp=")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"data":{"blocks":[{"blockCode":"HOMEPAGE_BLOCK_PLAYLIST_RCMD","creatives":[{"resources":[{"resourceId":"456","uiElement":{"mainTitle":{"title":"旧推荐"},"image":{"imageUrl":"https://img.test/old.jpg"}}}]}]}],"hasMore":false}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/top/playlist?limit=12&order=hot&offset=0&noCookie=true&timestamp=")))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"playlists":[{"id":789,"name":"新推荐歌单","copywriter":"换一批","picUrl":"https://img.test/new.jpg","trackCount":20}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        HomepageData homepage = provider.loadHomepage(true, null);

        assertEquals("netease:789", homepage.playlists().get(0).id());
        server.verify();
    }

    @Test
    void loadsTracksForAHomepagePlaylist() {
        server.expect(requestTo("http://api.test/playlist/detail?id=456&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"playlist":{"trackCount":1,"name":"推荐歌单","coverImgUrl":"https://img.test/list.jpg"}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://api.test/playlist/track/all?id=456&limit=100&offset=0&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"songs":[{"id":789,"name":"歌单歌曲","dt":180000,"ar":[{"name":"歌手"}],"al":{"name":"专辑","picUrl":"https://img.test/song.jpg"}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadPlaylist("netease:456");

        assertEquals("netease:789", tracks.get(0).id());
        assertEquals("歌单歌曲", tracks.get(0).title());
        server.verify();
    }

    @Test
    void loadsPlaylistDiscoveryCategoriesFromNetease() {
        server.expect(requestTo("http://api.test/playlist/catlist?noCookie=true"))
            .andRespond(withSuccess("""
                {"categories":{"0":"语种","1":"风格"},"sub":[{"name":"华语","category":0},{"name":"流行","category":1}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://api.test/playlist/hot?noCookie=true"))
            .andRespond(withSuccess("""
                {"tags":[{"name":"华语"},{"name":"流行"}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://api.test/playlist/highquality/tags?noCookie=true"))
            .andRespond(withSuccess("""
                {"tags":[{"name":"欧美"}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        PlaylistCategoryData categories = provider.loadPlaylistCategories();

        assertEquals(List.of("全部", "华语", "流行"), categories.hotTags());
        assertEquals(List.of("华语"), categories.groups().get("语种"));
        assertEquals(List.of("全部", "欧美"), categories.highQualityTags());
        server.verify();
    }

    @Test
    void loadsAllAndHighQualityPlaylistPages() {
        server.expect(requestTo(startsWith("http://api.test/top/playlist?cat=")))
            .andRespond(withSuccess("""
                {"total":682,"more":true,"playlists":[{"id":456,"name":"古风精选","coverImgUrl":"https://img.test/all.jpg","trackCount":193,"playCount":30740000,"creator":{"nickname":"花色游戏"}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/top/playlist/highquality?cat=")))
            .andRespond(withSuccess("""
                {"more":true,"playlists":[{"id":789,"name":"编辑精选","coverImgUrl":"https://img.test/hq.jpg","trackCount":89,"playCount":5510000,"updateTime":123456}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        PlaylistDiscoveryPage all = provider.loadPlaylists("华语", "hot", 30, 0);
        PlaylistDiscoveryPage quality = provider.loadHighQualityPlaylists("全部", 30, null);

        assertEquals(682, all.total());
        assertTrue(all.hasMore());
        assertEquals(30740000L, all.playlists().get(0).playCount());
        assertEquals("123456", quality.cursor());
        server.verify();
    }

    @Test
    void loadsDiscoveryDataFromPersonalizedApis() {
        server.expect(requestTo("http://api.test/personalized?limit=12&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"result":[{"id":456,"name":"发现歌单","copywriter":"编辑精选","picUrl":"https://img.test/list.jpg","trackCount":8}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://api.test/personalized/newsong?limit=12&noCookie=true"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {"result":[{"id":789,"name":"发现歌曲","picUrl":"https://img.test/song.jpg","song":{"id":789,"name":"发现歌曲","duration":180000,"artists":[{"name":"发现歌手"}],"album":{"name":"发现专辑","picUrl":"https://img.test/song.jpg"}}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        HomepageData discovery = provider.loadDiscovery(false, null);

        assertEquals("netease:456", discovery.playlists().get(0).id());
        assertEquals(8, discovery.playlists().get(0).count());
        assertEquals("netease:789", discovery.songs().get(0).id());
        assertEquals("发现歌曲", discovery.songs().get(0).title());
        server.verify();
    }

    @Test
    void loadsDailyRecommendationsWithoutDroppingTheLoginCookie() {
        server.expect(requestTo("http://api.test/recommend/songs"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("""
                {
                  "code": 200,
                  "data": {
                    "dailySongs": [
                      {
                        "id": 321,
                        "name": "今日推荐",
                        "dt": 210000,
                        "ar": [{"name": "推荐歌手"}],
                        "al": {"name": "推荐专辑", "picUrl": "https://img.test/daily.jpg"}
                      }
                    ]
                  }
                }
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadDailyRecommendations();

        assertEquals("netease:321", tracks.get(0).id());
        assertEquals("今日推荐", tracks.get(0).title());
        server.verify();
    }

    @Test
    void reportsThatDailyRecommendationsRequireLogin() {
        server.expect(requestTo("http://api.test/recommend/songs"))
            .andRespond(withSuccess("""
                {"code":301,"message":"需要登录"}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalStateException.class,
            () -> provider.loadDailyRecommendations()
        );
        server.verify();
    }

    @Test
    void sendsCredentialOnlyFromTheBackendForAccountRecommendations() {
        server.expect(requestTo(startsWith("http://api.test/recommend/songs?uid=100&cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"data":{"dailySongs":[{"id":321,"name":"账号推荐","dt":180000,"ar":[{"name":"歌手"}],"al":{"name":"专辑","picUrl":"https://img.test/cover.jpg"}}]}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountRecommendations("100", "MUSIC_U=secret");

        assertEquals("netease:321", tracks.get(0).id());
        server.verify();
    }

    @Test
    void loadsPrivateRadarFromPersonalizedNewSongs() {
        server.expect(requestTo(startsWith("http://api.test/personalized/newsong?limit=30&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"result":[{"picUrl":"https://img.test/radar.jpg","song":{"id":789,"name":"雷达新歌","duration":180000,"artists":[{"name":"歌手"}],"album":{"name":"专辑"}}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountPrivateRadar("100", "MUSIC_U=secret");

        assertEquals("netease:789", tracks.get(0).id());
        assertEquals("https://img.test/radar.jpg", tracks.get(0).coverUrl());
        server.verify();
    }

    @Test
    void loadsPrivateRoamingFromPersonalFm() {
        server.expect(requestTo(startsWith("http://api.test/personal_fm?timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"data":[{"id":987,"name":"漫游歌曲","duration":210000,"artists":[{"name":"漫游歌手"}],"album":{"name":"漫游专辑","picUrl":"https://img.test/roaming.jpg"}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountPrivateRoaming("100", "MUSIC_U=secret", "SCENE_RCMD", "FOCUS");

        assertEquals("netease:987", tracks.get(0).id());
        server.verify();
    }

    @Test
    void loadsEightAccountFeaturedPlaylistsFromPersonalizedRecommendations() {
        server.expect(requestTo(startsWith("http://api.test/personalized?limit=8&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"result":[{"id":456,"name":"精选歌单","copywriter":"为你推荐","picUrl":"https://img.test/featured.jpg","trackCount":55}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<HomepagePlaylist> playlists = provider.loadAccountFeaturedPlaylists("100", "MUSIC_U=secret");

        assertEquals(1, playlists.size());
        assertEquals("netease:456", playlists.get(0).id());
        assertEquals("精选歌单", playlists.get(0).title());
        assertEquals("https://img.test/featured.jpg", playlists.get(0).imageUrl());
        assertEquals(55, playlists.get(0).count());
        server.verify();
    }

    @Test
    void sendsCredentialForAccountFavoritesAndPlaylistMetadata() {
        server.expect(requestTo(startsWith("http://api.test/likelist?uid=100&cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"ids":[123]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/song/detail?ids=123&uid=100&cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"songs":[{"id":123,"name":"收藏歌曲","dt":180000,"ar":[{"name":"歌手"}],"al":{"name":"专辑","picUrl":"https://img.test/cover.jpg"}}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo(startsWith("http://api.test/user/playlist?uid=100&cookie=MUSIC_U%3Dsecret&limit=100&offset=0&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"playlist":[{"id":456,"name":"我的歌单","description":"私人收藏","coverImgUrl":"https://img.test/list.jpg","trackCount":1}]}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        assertEquals("netease:123", provider.loadAccountFavorites("100", "MUSIC_U=secret").get(0).id());
        assertEquals("netease:456", provider.loadAccountPlaylists("100", "MUSIC_U=secret").get(0).id());
        server.verify();
    }

    @Test
    void sendsCredentialWhenLoadingAnAccountPlaylist() {
        server.expect(requestTo(startsWith("http://api.test/playlist/detail?id=456&uid=100&cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("""
                {"code":200,"playlist":{"trackCount":1,"tracks":[{"id":789,"name":"私人歌单歌曲","dt":180000,"ar":[{"name":"歌手"}],"al":{"name":"专辑","picUrl":"https://img.test/cover.jpg"}}]}}
                """, org.springframework.http.MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountPlaylist("netease:456", "100", "MUSIC_U=secret");

        assertEquals("netease:789", tracks.get(0).id());
        assertEquals("私人歌单歌曲", tracks.get(0).title());
        server.verify();
    }

    @Test
    void sendsUidAndCookieWhenChangingFavoriteState() {
        server.expect(requestTo(startsWith("http://api.test/like?id=123&like=true&uid=100&cookie=MUSIC_U%3Dsecret&timestamp=")))
            .andExpect(header("Cookie", "MUSIC_U=secret"))
            .andRespond(withSuccess("{\"code\":200}", org.springframework.http.MediaType.APPLICATION_JSON));

        provider.setAccountFavorite("100", "netease:123", true, "MUSIC_U=secret");

        server.verify();
    }
}
