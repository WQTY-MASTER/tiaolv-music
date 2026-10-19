package com.listenmusic.api;

import com.listenmusic.domain.Track;
import com.listenmusic.provider.HomepagePlaylist;
import com.listenmusic.provider.FavoriteOperationException;
import com.listenmusic.provider.PlaylistOrderConflictException;
import com.listenmusic.service.AccountCatalogService;
import com.listenmusic.service.AccountLoginRequiredException;
import com.listenmusic.auth.AccountView;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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
    @Test
    void exposesVerifiedRemovalPartitionsWithTheCapturedAccount() throws Exception {
        given(accountCatalogService.removePlaylistTracks("qq", "qq:900", List.of("qq:mid1", "qq:mid2"), "200"))
            .willReturn(new com.listenmusic.provider.PlaylistTrackBatchResult(List.of("qq:mid1"), List.of("qq:mid2"), java.util.Map.of("qq:mid2", "平台尚未确认操作结果，请刷新歌单后再检查。")));
        mockMvc.perform(post("/account/qq/playlists/qq:900/tracks/remove-batch").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"qq:mid1\",\"qq:mid2\"],\"expectedAccountId\":\"200\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.succeeded[0]").value("qq:mid1"))
            .andExpect(jsonPath("$.failed[0]").value("qq:mid2"))
            .andExpect(jsonPath("$.errors['qq:mid2']").value("平台尚未确认操作结果，请刷新歌单后再检查。"));
    }

    @Test
    void batchEndpointSafelyReportsUnexpectedExceptionsPerId() throws Exception {
        given(accountCatalogService.removePlaylistTracks("netease", "netease:900", List.of("netease:123"), "100"))
            .willThrow(new IllegalStateException("MUSIC_U=secret; G:/Private/file", new java.net.SocketTimeoutException("Cookie=secret")));
        mockMvc.perform(post("/account/netease/playlists/netease:900/tracks/remove-batch").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"netease:123\"],\"expectedAccountId\":\"100\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.succeeded").isEmpty())
            .andExpect(jsonPath("$.errors['netease:123']").value("连接超时，请检查网络后重试。"));
    }

    @Test
    void exposesQqRecentReportAndReturnsItsFailureReason() throws Exception {
        String session = "cf3dac35-7a99-4706-9c69-11a4742486a1";
        given(accountCatalogService.reportRecentPlay("200", "qq:mid1", session, 30, 180)).willReturn(List.of());
        String body = "{\"accountId\":\"200\",\"trackId\":\"qq:mid1\",\"sessionId\":\"" + session
            + "\",\"listenedSeconds\":30,\"totalSeconds\":180}";
        mockMvc.perform(post("/account/qq/recent-play-reports").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true)).andExpect(jsonPath("$.tracks").isArray());
        given(accountCatalogService.reportRecentPlay("200", "qq:mid1", session, 30, 180))
            .willThrow(new com.listenmusic.provider.RecentPlayReportException("QQ 音乐接口返回错误: 80105"));
        mockMvc.perform(post("/account/qq/recent-play-reports").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("RECENT_PLAY_REPORT_FAILED"))
            .andExpect(jsonPath("$.message").value("QQ 音乐接口返回错误: 80105"));
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
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
    void preservesFavoriteProviderRejectionWithoutReturningGeneric500() throws Exception {
        org.mockito.Mockito.doThrow(new FavoriteOperationException("QQ 音乐接口返回错误: 80105"))
            .when(accountCatalogService).addFavorite(org.mockito.ArgumentMatchers.eq("qq"), any(Track.class));
        org.mockito.Mockito.doThrow(new FavoriteOperationException("QQ 音乐接口返回错误: 80105"))
            .when(accountCatalogService).removeFavorite("qq", "qq:0034QXzv2ptMdw");

        mockMvc.perform(post("/account/qq/favorites")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"id\":\"qq:0034QXzv2ptMdw\",\"title\":\"歌曲\",\"artist\":\"歌手\",\"source\":\"qq\"}"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("FAVORITE_WRITE_FAILED"))
            .andExpect(jsonPath("$.message").value("QQ 音乐接口返回错误: 80105"));
        mockMvc.perform(delete("/account/qq/favorites/qq:0034QXzv2ptMdw"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("FAVORITE_WRITE_FAILED"))
            .andExpect(jsonPath("$.message").value("QQ 音乐接口返回错误: 80105"));
    }

    @Test
    void routesPlaylistDeletionToTheAccountService() throws Exception {
        mockMvc.perform(delete("/account/qq/playlists/qq:900"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        verify(accountCatalogService).deletePlaylist("qq", "qq:900");
    }

    @Test
    void returnsASafePlaylistWriteFailureReasonInsteadOfAnOpaque500() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalStateException("QQ 音乐接口返回错误: 80105; MUSIC_U=secret"))
            .when(accountCatalogService).addPlaylistTracks("qq", "qq:900", List.of("qq:mid1"));
        mockMvc.perform(post("/account/qq/playlists/qq:900/tracks").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"qq:mid1\"]}"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("PLAYLIST_TRACK_WRITE_FAILED"))
            .andExpect(jsonPath("$.message").value("QQ 音乐加入歌单失败：平台返回错误码 80105，请稍后重试。"));
    }

    @Test
    void preservesExpiredLoginAndHttpFailureReasonsForPlaylistWrites() throws Exception {
        org.mockito.Mockito.doThrow(new AccountLoginRequiredException("登录已过期，请重新登录"))
            .when(accountCatalogService).addPlaylistTracks("netease", "netease:900", List.of("netease:123"));
        mockMvc.perform(post("/account/netease/playlists/netease:900/tracks").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"netease:123\"]}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("登录已过期，请重新登录"));
        org.mockito.Mockito.doThrow(new IllegalStateException("Transport failure",
            org.springframework.web.client.HttpServerErrorException.create(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Unavailable",
                org.springframework.http.HttpHeaders.EMPTY, new byte[0], java.nio.charset.StandardCharsets.UTF_8)))
            .when(accountCatalogService).addPlaylistTracks("netease", "netease:900", List.of("netease:123"));
        mockMvc.perform(post("/account/netease/playlists/netease:900/tracks").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"netease:123\"]}"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.message").value("网易云音乐加入歌单失败：接口返回 HTTP 503，请稍后重试。"));
    }

    @Test
    void removesOnlyTheRequestedPlaylistTrack() throws Exception {
        mockMvc.perform(delete("/account/qq/playlists/qq:900/tracks/qq:mid1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        verify(accountCatalogService).removePlaylistTrack("qq", "qq:900", "qq:mid1");
    }

    @Test
    void returnsSafeRemovalFailureAndPreservesLoginStatus() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalStateException("网易云账号接口调用失败: 502; MUSIC_U=secret"))
            .when(accountCatalogService).removePlaylistTrack("netease", "netease:900", "netease:123");
        mockMvc.perform(delete("/account/netease/playlists/netease:900/tracks/netease:123"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("PLAYLIST_TRACK_REMOVE_FAILED"))
            .andExpect(jsonPath("$.message").value("网易云音乐移出歌单失败：平台返回错误码 502，请稍后重试。"));
        org.mockito.Mockito.doThrow(new AccountLoginRequiredException("登录已过期，请重新登录"))
            .when(accountCatalogService).removePlaylistTrack("netease", "netease:900", "netease:123");
        mockMvc.perform(delete("/account/netease/playlists/netease:900/tracks/netease:123"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("登录已过期，请重新登录"));
    }

    @Test
    void routesOrderAndPreviousSnapshotToTheService() throws Exception {
        mockMvc.perform(post("/account/qq/playlists/qq:900/order").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"qq:b\",\"qq:a\"],\"previousTrackIds\":[\"qq:a\",\"qq:b\"]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        verify(accountCatalogService).reorderPlaylistTracks("qq", "qq:900", List.of("qq:b", "qq:a"), List.of("qq:a", "qq:b"));
    }

    @Test
    void returnsConflictWithAnActionableMessageForAStalePlaylistOrder() throws Exception {
        org.mockito.Mockito.doThrow(new PlaylistOrderConflictException("QQ 歌单已发生变化，请刷新后重新排序"))
            .when(accountCatalogService).reorderPlaylistTracks(
                "qq", "qq:900", List.of("qq:b", "qq:a"), List.of("qq:a", "qq:b")
            );

        mockMvc.perform(post("/account/qq/playlists/qq:900/order").contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"qq:b\",\"qq:a\"],\"previousTrackIds\":[\"qq:a\",\"qq:b\"]}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("QQ 歌单已发生变化，请刷新后重新排序"));
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

    @Test
    void exposesRangeAwareListeningRankingAndQqDeltaRecording() throws Exception {
        given(accountCatalogService.loadListeningRank("qq", "custom", "2026-10-01", "2026-10-08"))
            .willReturn(List.of());

        mockMvc.perform(get("/account/qq/listening-rank")
                .param("period", "custom")
                .param("from", "2026-10-01")
                .param("to", "2026-10-08"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
        mockMvc.perform(post("/account/qq/listening-stats")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "accountId":"100",
                      "accountNickname":"QQ用户",
                      "accountAvatarUrl":"https://img.test/avatar.jpg",
                      "track":{"id":"qq:mid","title":"歌曲","artist":"歌手","album":"专辑","duration":180,"source":"qq"},
                      "listenedSeconds":15,
                      "playCount":1
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(accountCatalogService).loadListeningRank("qq", "custom", "2026-10-01", "2026-10-08");
        verify(accountCatalogService).recordQqListeningDelta(
            org.mockito.ArgumentMatchers.eq("qq"),
            org.mockito.ArgumentMatchers.eq("100"),
            org.mockito.ArgumentMatchers.eq("QQ用户"),
            org.mockito.ArgumentMatchers.eq("https://img.test/avatar.jpg"),
            any(Track.class),
            org.mockito.ArgumentMatchers.eq(15.0), org.mockito.ArgumentMatchers.eq(1)
        );
    }

    @Test
    void exposesPersistentQqListeningSummariesAndExplicitDeletion() throws Exception {
        given(accountCatalogService.loadQqListeningDataSummaries()).willReturn(List.of(
            new com.listenmusic.domain.QqListeningDataSummary(
                "100", "QQ用户", null, 2, 90, "2026-10-01", "2026-10-08"
            )
        ));

        mockMvc.perform(get("/account/qq/listening-stats/accounts"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].accountId").value("100"));
        mockMvc.perform(delete("/account/qq/listening-stats/100")
                .param("from", "2026-10-01")
                .param("to", "2026-10-08"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(accountCatalogService).deleteQqListeningStats("100", false, "2026-10-01", "2026-10-08");
    }
}
