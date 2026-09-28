package com.listenmusic.api;

import com.listenmusic.provider.LyricData;
import com.listenmusic.provider.CoverData;
import com.listenmusic.provider.HomepageData;
import com.listenmusic.provider.HomepageBanner;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.DailyRecommendationsLoginRequiredException;
import com.listenmusic.provider.PlaylistCategoryData;
import com.listenmusic.provider.PlaylistDiscoveryPage;
import com.listenmusic.provider.ProviderLoginRequiredException;
import com.listenmusic.provider.SearchResultPage;
import com.listenmusic.provider.SearchType;
import com.listenmusic.provider.ArtistAlbum;
import com.listenmusic.provider.ArtistDetail;
import com.listenmusic.service.OnlineCatalogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CatalogController.class)
@Import(com.listenmusic.config.WebConfig.class)
class CatalogControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OnlineCatalogService onlineCatalogService;

    @Test
    void exposesTheSelectedMusicProvider() throws Exception {
        given(onlineCatalogService.activeProvider()).willReturn("netease");

        mockMvc.perform(get("/catalog/provider"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("netease"));
    }

    @Test
    void redirectsAudioRequestsToTheProviderPlaybackUrl() throws Exception {
        given(onlineCatalogService.resolveAudioUrl("netease:123"))
            .willReturn(Optional.of("https://audio.test/song.mp3"));

        mockMvc.perform(get("/catalog/tracks/netease:123/audio"))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", "https://audio.test/song.mp3"));
    }

    @Test
    void returnsUnauthorizedWhenTheProviderPlaybackCredentialHasExpired() throws Exception {
        given(onlineCatalogService.resolveAudioUrl("qq:mid-locked"))
            .willThrow(new ProviderLoginRequiredException());

        mockMvc.perform(get("/catalog/tracks/qq:mid-locked/audio"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsLyricsWithItsTranslationAndFormat() throws Exception {
        given(onlineCatalogService.loadLyrics("netease:123"))
            .willReturn(Optional.of(new LyricData(
                "[00:01.00]晴天",
                "[00:01.00]A sunny day",
                "LRC",
                "netease",
                List.of()
            )));

        mockMvc.perform(get("/catalog/tracks/netease:123/lyrics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lyrics").value("[00:01.00]晴天"))
            .andExpect(jsonPath("$.translation").value("[00:01.00]A sunny day"))
            .andExpect(jsonPath("$.format").value("LRC"))
            .andExpect(jsonPath("$.source").value("netease"));
    }

    @Test
    void returnsSearchResultsAsAnArray() throws Exception {
        given(onlineCatalogService.search("晴天")).willReturn(List.of());

        mockMvc.perform(get("/catalog/search").param("q", "晴天"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void returnsPagedCloudSearchResultsForTheRequestedProviderAndType() throws Exception {
        given(onlineCatalogService.search("鸣潮", "qq", SearchType.PLAYLIST, 8, 16))
            .willReturn(new SearchResultPage(List.of(), List.of(), List.of(), 25, true));

        mockMvc.perform(get("/catalog/cloudsearch")
                .param("keywords", "鸣潮")
                .param("provider", "qq")
                .param("type", "1000")
                .param("limit", "8")
                .param("offset", "16"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(25))
            .andExpect(jsonPath("$.hasMore").value(true))
            .andExpect(jsonPath("$.songs").isArray())
            .andExpect(jsonPath("$.playlists").isArray())
            .andExpect(jsonPath("$.artists").isArray());
    }

    @Test
    void returnsOnlineCoverBytes() throws Exception {
        given(onlineCatalogService.loadCover("netease:123"))
            .willReturn(Optional.of(new CoverData(new byte[] {1, 2, 3}, "image/jpeg")));

        mockMvc.perform(get("/catalog/tracks/netease:123/cover"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "image/jpeg"))
            .andExpect(header().string("Cache-Control", "max-age=3600"))
            .andExpect(result -> org.junit.jupiter.api.Assertions.assertArrayEquals(
                new byte[] {1, 2, 3},
                result.getResponse().getContentAsByteArray()
            ));
    }

    @Test
    void returnsHomepageDataFromTheActiveProvider() throws Exception {
        given(onlineCatalogService.loadHomepage(false, null)).willReturn(new HomepageData(
            List.of(new HomepageBanner("推荐", "", "https://img.test/banner.jpg", "123", 1, null)),
            List.of(new HomepagePlaylist("netease:456", "推荐歌单", "", "https://img.test/list.jpg", 0)),
            List.of(),
            "next",
            true
        ));

        mockMvc.perform(get("/catalog/homepage"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.banners[0].title").value("推荐"))
            .andExpect(jsonPath("$.playlists[0].id").value("netease:456"))
            .andExpect(jsonPath("$.cursor").value("next"))
            .andExpect(jsonPath("$.hasMore").value(true));
    }

    @Test
    void returnsTracksForAnOnlinePlaylist() throws Exception {
        given(onlineCatalogService.loadPlaylist("netease:456")).willReturn(List.of());

        mockMvc.perform(get("/catalog/playlists/netease:456"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void routesPlaylistDiscoveryToTheRequestedProvider() throws Exception {
        given(onlineCatalogService.loadPlaylistCategories("qq"))
            .willReturn(new PlaylistCategoryData(List.of("全部", "轻音乐"), Map.of("热门推荐", List.of("轻音乐")), List.of()));
        given(onlineCatalogService.loadPlaylists("qq", "轻音乐", "hot", 30, 0))
            .willReturn(new PlaylistDiscoveryPage(List.of(), 11619, true, null));

        mockMvc.perform(get("/catalog/playlist-categories").param("provider", "qq"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.hotTags[1]").value("轻音乐"));
        mockMvc.perform(get("/catalog/playlists")
                .param("provider", "qq")
                .param("category", "轻音乐")
                .param("order", "hot")
                .param("limit", "30")
                .param("offset", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(11619));
    }

    @Test
    void exposesArtistDetailAndSongs() throws Exception {
        given(onlineCatalogService.loadArtistDetail("netease:6452", "netease"))
            .willReturn(new ArtistDetail("netease", "netease:6452", "周杰伦", "https://img.test/artist.jpg", "音乐人", 39, 512));
        given(onlineCatalogService.loadArtistTopSongs("netease:6452", "netease")).willReturn(List.of());
        given(onlineCatalogService.loadArtistSongs("netease:6452", "netease", "hot", 50, 0))
            .willReturn(new com.listenmusic.provider.ArtistSongPage(List.of(), 0, false));
        given(onlineCatalogService.loadArtistAlbums("netease:6452", "netease", 30, 0)).willReturn(List.of(
            new ArtistAlbum("netease:1", "叶惠美", "https://img.test/album.jpg", 11, "2003-07-31")
        ));

        mockMvc.perform(get("/catalog/artist/detail")
                .param("id", "netease:6452")
                .param("provider", "netease"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("周杰伦"));
        mockMvc.perform(get("/catalog/artist/top-songs")
                .param("id", "netease:6452")
                .param("provider", "netease"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/catalog/artist/songs")
                .param("id", "netease:6452")
                .param("provider", "netease"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(0));
        mockMvc.perform(get("/catalog/artist/albums")
                .param("id", "netease:6452")
                .param("provider", "netease"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].title").value("叶惠美"));
    }

    @Test
    void returnsDailyRecommendationsFromTheActiveProvider() throws Exception {
        given(onlineCatalogService.loadDailyRecommendations()).willReturn(List.of());

        mockMvc.perform(get("/catalog/daily-recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void explainsWhenDailyRecommendationsNeedLogin() throws Exception {
        given(onlineCatalogService.loadDailyRecommendations())
            .willThrow(new DailyRecommendationsLoginRequiredException());

        mockMvc.perform(get("/catalog/daily-recommendations"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
    }
}
