package com.listenmusic.api;

import com.listenmusic.config.WebConfig;
import com.listenmusic.service.ProviderResourceCache;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CacheController.class)
@Import(WebConfig.class)
class CacheControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProviderResourceCache resourceCache;

    @Test
    void returnsSettingsAndUsageSnapshot() throws Exception {
        given(resourceCache.settings()).willReturn(settings("C:/cache"));
        given(resourceCache.statistics()).willReturn(statistics(1500, 3));

        mockMvc.perform(get("/cache"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.directory").value("C:/cache"))
            .andExpect(jsonPath("$.settings.coverEnabled").value(true))
            .andExpect(jsonPath("$.statistics.totalBytes").value(1500))
            .andExpect(jsonPath("$.statistics.totalEntries").value(3));
    }

    @Test
    void updatesCacheSettings() throws Exception {
        given(resourceCache.update(any())).willReturn(new ProviderResourceCache.Settings(
            "D:/TiaolvCache", false, true, true
        ));
        given(resourceCache.statistics()).willReturn(statistics(0, 0));

        mockMvc.perform(put("/cache/settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"directory":"D:/TiaolvCache","coverEnabled":false,"lyricsEnabled":true,"metadataEnabled":true}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.directory").value("D:/TiaolvCache"))
            .andExpect(jsonPath("$.settings.coverEnabled").value(false));

        verify(resourceCache).update(any());
    }

    @Test
    void restoresTheDefaultDirectory() throws Exception {
        given(resourceCache.restoreDefaultDirectory()).willReturn(settings("C:/default-cache"));
        given(resourceCache.statistics()).willReturn(statistics(0, 0));

        mockMvc.perform(post("/cache/default-directory"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.directory").value("C:/default-cache"));
    }

    @Test
    void clearsOnlyManagedCacheEntries() throws Exception {
        given(resourceCache.settings()).willReturn(settings("C:/cache"));
        given(resourceCache.clear()).willReturn(statistics(0, 0));

        mockMvc.perform(delete("/cache"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.directory").value("C:/cache"))
            .andExpect(jsonPath("$.statistics.totalBytes").value(0));
    }

    private static ProviderResourceCache.Settings settings(String directory) {
        return new ProviderResourceCache.Settings(directory, true, true, true);
    }

    private static ProviderResourceCache.Statistics statistics(long bytes, long entries) {
        ProviderResourceCache.CategoryStatistics empty = new ProviderResourceCache.CategoryStatistics(0, 0);
        return new ProviderResourceCache.Statistics(bytes, entries, empty, empty, empty);
    }
}
