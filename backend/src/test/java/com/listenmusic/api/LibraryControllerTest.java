package com.listenmusic.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.listenmusic.service.LibraryService;
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

    private String trackJson(String id) {
        return """
            {"id":"%s","title":"测试歌曲","artist":"测试歌手","album":"测试专辑",
             "duration":180,"source":"netease","url":"/audio","coverUrl":"/cover"}
            """.formatted(id);
    }
}
