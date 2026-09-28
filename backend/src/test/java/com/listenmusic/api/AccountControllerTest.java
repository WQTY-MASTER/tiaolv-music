package com.listenmusic.api;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.service.AccountCatalogService;
import com.listenmusic.service.AccountLoginRequiredException;
import com.listenmusic.auth.AccountView;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AccountController.class)
@Import(com.listenmusic.config.WebConfig.class)
class AccountControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AccountCatalogService accountCatalogService;

    @Test
    void returnsTheActiveAccount() throws Exception {
        given(accountCatalogService.currentAccount()).willReturn(java.util.Optional.of(new AccountView(
            "netease", "100", "测试用户", "https://img.test/avatar.jpg"
        )));

        mockMvc.perform(get("/account/current"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.provider").value("netease"))
            .andExpect(jsonPath("$.userId").value("100"));
    }

    @Test
    void requiresLoginForAccountContent() throws Exception {
        given(accountCatalogService.loadRecommendations("netease"))
            .willThrow(new AccountLoginRequiredException());

        mockMvc.perform(get("/account/netease/recommendations"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
    }

    @Test
    void exposesAccountCollectionsAndFavoriteMutations() throws Exception {
        given(accountCatalogService.loadFavorites("netease")).willReturn(List.of());
        given(accountCatalogService.loadPlaylists("netease")).willReturn(List.of(
            new HomepagePlaylist("netease:1", "我的歌单", "", "https://img.test/list.jpg", 3)
        ));
        Track track = new Track(
            "netease:123", "测试歌曲", "测试歌手", "测试专辑", 180L, "netease", null,
            "/catalog/tracks/netease:123/audio", "https://img.test/cover.jpg", null, null, null, null, null
        );

        mockMvc.perform(get("/account/netease/favorites"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/account/netease/playlists"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("netease:1"));
        mockMvc.perform(post("/account/netease/favorites")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"id":"netease:123","title":"测试歌曲","artist":"测试歌手","album":"测试专辑","duration":180,"source":"netease"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        mockMvc.perform(delete("/account/netease/favorites/netease:123"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(accountCatalogService).addFavorite(org.mockito.ArgumentMatchers.eq("netease"), any(Track.class));
        verify(accountCatalogService).removeFavorite("netease", "netease:123");
    }

    @Test
    void loadsSongsFromAnAccountPlaylist() throws Exception {
        Track track = new Track(
            "netease:123", "歌单歌曲", "测试歌手", "测试专辑", 180L, "netease", null,
            "/catalog/tracks/netease:123/audio", "https://img.test/cover.jpg", null, null, null, null, null
        );
        given(accountCatalogService.loadPlaylist("netease", "netease:1")).willReturn(List.of(track));

        mockMvc.perform(get("/account/netease/playlists/netease:1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("netease:123"));

        verify(accountCatalogService).loadPlaylist("netease", "netease:1");
    }

    @Test
    void routesQqAccountRecommendationsToTheRequestedProvider() throws Exception {
        given(accountCatalogService.loadRecommendations("qq")).willReturn(List.of());

        mockMvc.perform(get("/account/qq/recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        verify(accountCatalogService).loadRecommendations("qq");
    }

    @Test
    void exposesPrivateRadarAndRoamingAsIndependentAccountFeatures() throws Exception {
        given(accountCatalogService.loadPrivateRadar("netease")).willReturn(List.of());
        given(accountCatalogService.loadPrivateRoaming("netease", "EXPLORE", null)).willReturn(List.of());

        mockMvc.perform(get("/account/netease/private-radar"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/account/netease/roaming").param("mode", "EXPLORE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        verify(accountCatalogService).loadPrivateRadar("netease");
        verify(accountCatalogService).loadPrivateRoaming("netease", "EXPLORE", null);
    }

    @Test
    void exposesFeaturedPlaylistsForTheActiveProviderAccount() throws Exception {
        given(accountCatalogService.loadFeaturedPlaylists("netease")).willReturn(List.of(
            new HomepagePlaylist("netease:8", "精选歌单", "为你推荐", "https://img.test/featured.jpg", 55)
        ));

        mockMvc.perform(get("/account/netease/featured-playlists"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("netease:8"))
            .andExpect(jsonPath("$[0].count").value(55));

        verify(accountCatalogService).loadFeaturedPlaylists("netease");
    }

    @Test
    void reportsAnAccountListeningScrobble() throws Exception {
        mockMvc.perform(post("/account/netease/listening-scrobbles")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "trackId":"netease:518066366",
                      "title":"测试歌曲",
                      "artist":"测试歌手",
                      "listenedSeconds":30,
                      "totalSeconds":291
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(accountCatalogService).scrobble(
            "netease", "netease:518066366", "测试歌曲", "测试歌手", 30, 291
        );
    }

    @Test
    void createsAnAccountPlaylist() throws Exception {
        given(accountCatalogService.createPlaylist("netease", "新歌单")).willReturn(
            new HomepagePlaylist("netease:3", "新歌单", "网易云歌单", "", 0, true)
        );

        mockMvc.perform(post("/account/netease/playlists")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"新歌单\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("netease:3"))
            .andExpect(jsonPath("$.createdByAccount").value(true));

        verify(accountCatalogService).createPlaylist("netease", "新歌单");
    }

    @Test
    void exposesArtistSubscriptionStatusAndMutation() throws Exception {
        given(accountCatalogService.isArtistSubscribed("netease", "netease:6452")).willReturn(true);

        mockMvc.perform(get("/account/netease/artists/netease:6452/subscription"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subscribed").value(true));
        mockMvc.perform(post("/account/netease/artists/netease:6452/subscription")
                .param("subscribed", "false"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subscribed").value(false));

        verify(accountCatalogService).setArtistSubscribed("netease", "netease:6452", false);
    }

    @Test
    void updatesPlaylistSubscription() throws Exception {
        given(accountCatalogService.setPlaylistSubscribed("qq", "qq:778899", true)).willReturn(false);

        mockMvc.perform(post("/account/qq/playlists/qq:778899/subscription")
                .param("subscribed", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subscribed").value(true))
            .andExpect(jsonPath("$.synced").value(false));

        verify(accountCatalogService).setPlaylistSubscribed("qq", "qq:778899", true);
    }
}
