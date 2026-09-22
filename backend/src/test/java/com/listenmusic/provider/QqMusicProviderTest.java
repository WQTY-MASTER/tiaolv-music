package com.listenmusic.provider;

import com.listenmusic.auth.CredentialStore;
import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.domain.Track;
import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
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
        server.expect(requestTo(containsString("/recommend/daily?ownCookie=1")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"result":100,"data":{"songlist":[
                  {"songmid":"mid-1","songname":"推荐歌曲","singer":[{"name":"歌手"}],
                   "albumname":"专辑","albummid":"album-1","interval":180}
                ]}}
                """, MediaType.APPLICATION_JSON));

        List<Track> tracks = provider.loadAccountRecommendations("200", cookie);

        assertEquals(1, tracks.size());
        assertEquals("qq:mid-1", tracks.getFirst().id());
        assertEquals("推荐歌曲", tracks.getFirst().title());
        server.verify();
    }

    @Test
    void mapsPersonalizedPlaylistsUsingTheAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        server.expect(requestTo(containsString("/recommend/playlist/u?ownCookie=1")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"result":100,"data":{"list":[
                  {"dissid":"99","dissname":"为你推荐","imgurl":"https://img.test/list.jpg","songnum":20}
                ]}}
                """, MediaType.APPLICATION_JSON));

        List<HomepagePlaylist> playlists = provider.loadAccountPlaylists("200", cookie);

        assertEquals(1, playlists.size());
        assertEquals("qq:99", playlists.getFirst().id());
        assertEquals("为你推荐", playlists.getFirst().title());
        server.verify();
    }

    @Test
    void searchesPlaylistsWithQqPagination() {
        server.expect(requestTo(containsString("/search?key=%E9%B8%A3%E6%BD%AE&pageNo=3&pageSize=8&t=3")))
            .andRespond(withSuccess("""
                {"result":100,"data":{"total":18,"list":[
                  {"dissid":"99","dissname":"鸣潮精选","imgurl":"https://img.test/list.jpg","songnum":20,
                   "creator_name":"QQ 编辑"}
                ]}}
                """, MediaType.APPLICATION_JSON));

        SearchResultPage result = provider.search("鸣潮", SearchType.PLAYLIST, 8, 16);

        assertEquals(18, result.total());
        assertEquals(1, result.playlists().size());
        assertEquals("qq:99", result.playlists().getFirst().id());
        assertEquals("鸣潮精选", result.playlists().getFirst().title());
        server.verify();
    }

    @Test
    void resolvesAudioUrlUsingTheActiveAccountCookie() {
        String cookie = "uin=o200; qm_keyst=secret";
        when(accountRepository.findActive("qq")).thenReturn(Optional.of(new ProviderAccount(
            "qq", "200", "QQ 用户", null, "qq-ref", true, "now", "now"
        )));
        when(credentialStore.get("qq-ref")).thenReturn(Optional.of(cookie));
        server.expect(requestTo(containsString("/song/url?id=mid-1&type=128&ownCookie=1")))
            .andExpect(header(HttpHeaders.COOKIE, cookie))
            .andRespond(withSuccess("""
                {"result":100,"data":{"mid-1":"https://audio.test/song.mp3"}}
                """, MediaType.APPLICATION_JSON));

        Optional<String> audioUrl = provider.resolveAudioUrl("qq:mid-1");

        assertEquals("https://audio.test/song.mp3", audioUrl.orElseThrow());
        server.verify();
    }
}
