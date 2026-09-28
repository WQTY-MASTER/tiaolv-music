package com.listenmusic.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.listenmusic.service.LibraryService;
import com.listenmusic.service.LibraryScanResult;
import com.listenmusic.service.LocalLyricsMatchResult;
import com.listenmusic.service.LocalLyricsMatchService;
import com.listenmusic.domain.Track;
import com.listenmusic.config.WebConfig;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.http.MediaType;

@WebMvcTest({HealthController.class, LibraryController.class})
@Import(WebConfig.class)
class LibraryControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LibraryService libraryService;

    @MockBean
    private LocalLyricsMatchService localLyricsMatchService;

    @Test
    void healthEndpointReturnsOk() throws Exception {
        mockMvc.perform(get("/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
    }

    @Test
    void libraryEndpointsReturnArrays() throws Exception {
        given(libraryService.listTracks()).willReturn(java.util.List.of());
        given(libraryService.listPlaylists()).willReturn(java.util.List.of());

        mockMvc.perform(get("/library/tracks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/library/playlists"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    void browserOriginCanCallBackend() throws Exception {
        mockMvc.perform(get("/health").header("Origin", "http://127.0.0.1:5173"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                .string("Access-Control-Allow-Origin", "http://127.0.0.1:5173"));
    }

    @Test
    void favoritesAreScopedAndMutable() throws Exception {
        given(libraryService.listFavorites()).willReturn(java.util.List.of());

        mockMvc.perform(get("/library/favorites"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(post("/library/favorites")
                .contentType(MediaType.APPLICATION_JSON)
                .content(trackJson("netease:123")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        verify(libraryService).saveFavorite(any());

        mockMvc.perform(delete("/library/favorites/{id}", "netease:123"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        verify(libraryService).removeFavorite("netease:123");
    }

    @Test
    void historyCanBeRecordedAndLoaded() throws Exception {
        given(libraryService.listHistory()).willReturn(java.util.List.of());

        mockMvc.perform(get("/library/history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(post("/library/history")
                .contentType(MediaType.APPLICATION_JSON)
                .content(trackJson("local:abc")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        verify(libraryService).recordHistory(any());
    }

    @Test
    void localLibraryCanBeResetToFirstUseState() throws Exception {
        mockMvc.perform(delete("/library/tracks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(libraryService).resetLocalLibrary();
    }

    @Test
    void localLibraryDirectoryCanBeSelectedWithNativePicker() throws Exception {
        given(libraryService.selectMusicDirectory()).willReturn(java.util.Optional.of("G:\\本地音乐"));

        mockMvc.perform(get("/library/select-directory"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.directory").value("G:\\本地音乐"));
    }

    @Test
    void localLibraryCanBeScannedIncrementallyWithStatistics() throws Exception {
        given(libraryService.incrementalScanDirectory("G:\\本地音乐", true))
            .willReturn(new LibraryScanResult(java.util.List.of(), 12, 3, 2));

        mockMvc.perform(post("/library/scan/incremental")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"directory\":\"G:\\\\本地音乐\",\"useFilenameMetadata\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tracks").isArray())
            .andExpect(jsonPath("$.total").value(12))
            .andExpect(jsonPath("$.added").value(3))
            .andExpect(jsonPath("$.removed").value(2));
    }

    @Test
    void allRegisteredLibraryRootsCanBeScannedTogether() throws Exception {
        given(libraryService.incrementalScanAllDirectories(true))
            .willReturn(new LibraryScanResult(java.util.List.of(), 12, 2, 1));

        mockMvc.perform(post("/library/scan/all/incremental")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"useFilenameMetadata\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(12))
            .andExpect(jsonPath("$.added").value(2))
            .andExpect(jsonPath("$.removed").value(1));
    }

    @Test
    void duplicateCandidatesCanBeIgnoredWithoutDeletingFiles() throws Exception {
        given(libraryService.ignoreLocalTracks(java.util.List.of("local-2")))
            .willReturn(java.util.List.of());

        mockMvc.perform(post("/library/tracks/ignore")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackIds\":[\"local-2\"]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        verify(libraryService).ignoreLocalTracks(java.util.List.of("local-2"));
    }

    @Test
    void ignoredLocalFilesCanBeRestored() throws Exception {
        given(libraryService.restoreIgnoredLocalFiles()).willReturn(3);

        mockMvc.perform(delete("/library/ignored"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.restored").value(3));
    }

    @Test
    void localMetadataCanBeReparsedWithFilenameCompletionDisabled() throws Exception {
        given(libraryService.reparseAllMetadata("G:\\本地音乐", false))
            .willReturn(new com.listenmusic.service.LibraryMetadataReparseResult(
                java.util.List.of(), 8, 0
            ));

        mockMvc.perform(post("/library/metadata/reparse")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"directory\":\"G:\\\\本地音乐\",\"useFilenameMetadata\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tracks").isArray())
            .andExpect(jsonPath("$.total").value(8))
            .andExpect(jsonPath("$.filenameResolved").value(0));

        verify(libraryService).reparseAllMetadata("G:\\本地音乐", false);
    }

    @Test
    void localTrackLyricsCanBeMatchedManually() throws Exception {
        Track track = new Track(
            "local-1", "歌曲", "歌手", "专辑", 180L, "local", "G:/歌曲.flac",
            "/audio", null, "[1,500](1,500,0)歌", "online-netease", "YRC",
            null, null, null
        );
        given(localLyricsMatchService.match("local-1", true))
            .willReturn(new LocalLyricsMatchResult(true, track, "联网匹配到逐字歌词（来自网易云）"));

        mockMvc.perform(post("/library/tracks/{id}/lyrics/match", "local-1")
                .queryParam("saveBesideAudio", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.matched").value(true))
            .andExpect(jsonPath("$.track.lyricsFormat").value("YRC"));

        verify(localLyricsMatchService).match("local-1", true);
    }

    private String trackJson(String id) {
        return """
            {"id":"%s","title":"测试歌曲","artist":"测试歌手","album":"测试专辑",
             "duration":180,"source":"netease","url":"/audio","coverUrl":"/cover"}
            """.formatted(id);
    }
}
