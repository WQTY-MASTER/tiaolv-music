package com.listenmusic.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.listenmusic.service.LibraryService;
import com.listenmusic.service.LibraryScanResult;
import com.listenmusic.service.LocalLyricsMatchResult;
import com.listenmusic.service.LocalLyricsMatchService;
import com.listenmusic.domain.Track;
import com.listenmusic.domain.ListeningStats;
import com.listenmusic.domain.ListeningStatsSummary;
import com.listenmusic.service.StaleListeningStatsException;
import com.listenmusic.config.WebConfig;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest({HealthController.class, LibraryController.class})
@Import(WebConfig.class)
class LibraryControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LibraryService libraryService;

    @MockitoBean
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
    void listeningStatsCanBeSavedAndLoaded() throws Exception {
        given(libraryService.loadListeningStats()).willReturn(new ListeningStats(
            0,
            java.util.Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 2, 75.5, "2026-10-04T09:00:00Z"
            )),
            java.util.Map.of("2026-10-04", new ListeningStats.DayStat("2026-10-04", 75.5))
        ));

        mockMvc.perform(get("/library/listening-stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tracks['local:a'].playCount").value(2))
            .andExpect(jsonPath("$.days['2026-10-04'].listenedSeconds").value(75.5));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                "/library/listening-stats"
            )
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "revision": 0,
                      "tracks": {
                        "local:a": {
                          "trackId": "local:a",
                          "playCount": 2,
                          "listenedSeconds": 75.5,
                          "lastListenedAt": "2026-10-04T09:00:00Z"
                        }
                      },
                      "days": {
                        "2026-10-04": {"date": "2026-10-04", "listenedSeconds": 75.5}
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));

        verify(libraryService).saveListeningStats(any());
    }

    @Test
    void listeningStatsCanBePreviewedAndDeletedByRange() throws Exception {
        given(libraryService.summarizeListeningStats(
            java.time.LocalDate.parse("2026-07-01"),
            java.time.LocalDate.parse("2026-07-31")
        )).willReturn(new ListeningStatsSummary(
            0, 2, 3, 180, java.util.List.of(2026), java.util.List.of("2026-07"),
            1, 2, 120
        ));
        given(libraryService.deleteListeningStats(
            java.time.LocalDate.parse("2026-07-01"),
            java.time.LocalDate.parse("2026-07-31")
        )).willReturn(new ListeningStats(1, java.util.Map.of(), java.util.Map.of()));

        mockMvc.perform(get("/library/listening-stats/summary")
                .queryParam("from", "2026-07-01")
                .queryParam("to", "2026-07-31"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rangeActiveDays").value(2))
            .andExpect(jsonPath("$.rangeListenedSeconds").value(120));

        mockMvc.perform(delete("/library/listening-stats")
                .queryParam("from", "2026-07-01")
                .queryParam("to", "2026-07-31"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.revision").value(1));
    }

    @Test
    void allListeningStatsDeletionRequiresExplicitConfirmation() throws Exception {
        mockMvc.perform(delete("/library/listening-stats"))
            .andExpect(status().isBadRequest());

        given(libraryService.deleteAllListeningStats())
            .willReturn(new ListeningStats(2, java.util.Map.of(), java.util.Map.of()));
        mockMvc.perform(delete("/library/listening-stats").queryParam("all", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.revision").value(2));
    }

    @Test
    void invalidListeningStatsDateRangeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/library/listening-stats/summary")
                .queryParam("from", "2026-08-01")
                .queryParam("to", "2026-07-01"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void staleListeningStatsSaveReturnsConflict() throws Exception {
        doThrow(new StaleListeningStatsException(0, 1))
            .when(libraryService).saveListeningStats(any());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                "/library/listening-stats"
            )
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\":0,\"tracks\":{},\"days\":{}}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("请刷新")));
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
    void localLibraryRootCanBeRemovedWithoutDeletingSourceFiles() throws Exception {
        given(libraryService.removeLibraryRoot("G:\\本地音乐")).willReturn(java.util.List.of());

        mockMvc.perform(delete("/library/roots").param("directory", "G:\\本地音乐"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        verify(libraryService).removeLibraryRoot("G:\\本地音乐");
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
        given(localLyricsMatchService.match("local-1", true, true))
            .willReturn(new LocalLyricsMatchResult(true, track, "联网匹配到逐字歌词（来自网易云）"));

        mockMvc.perform(post("/library/tracks/{id}/lyrics/match", "local-1")
                .queryParam("saveBesideAudio", "true")
                .queryParam("force", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.matched").value(true))
            .andExpect(jsonPath("$.track.lyricsFormat").value("YRC"));

        verify(localLyricsMatchService).match("local-1", true, true);
    }

    private String trackJson(String id) {
        return """
            {"id":"%s","title":"测试歌曲","artist":"测试歌手","album":"测试专辑",
             "duration":180,"source":"netease","url":"/audio","coverUrl":"/cover"}
            """.formatted(id);
    }
}
