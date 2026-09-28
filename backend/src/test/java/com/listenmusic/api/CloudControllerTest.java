package com.listenmusic.api;

import com.listenmusic.config.WebConfig;
import com.listenmusic.provider.CloudTrack;
import com.listenmusic.service.AccountCatalogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import com.listenmusic.provider.LyricData;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CloudController.class)
@Import(WebConfig.class)
class CloudControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AccountCatalogService accountCatalogService;

    @Test
    void proxiesAccountCloudListAndUpload() throws Exception {
        CloudTrack track = new CloudTrack(
            "netease:123", "夜曲", "周杰伦", "十一月的萧邦", 235,
            "夜曲.flac", "FLAC", 1024L, "2026-09-23T01:00:00Z",
            "https://audio.test/123.flac", "https://img.test/123.jpg"
        );
        given(accountCatalogService.loadCloudTracks("netease")).willReturn(List.of(track));
        given(accountCatalogService.uploadCloudTrack(eq("netease"), any())).willReturn(track);
        given(accountCatalogService.loadCloudLyrics("netease", "netease:123")).willReturn(Optional.of(
            new LyricData("[00:01.00]夜曲", null, "LRC", "netease-cloud", List.of())
        ));

        mockMvc.perform(get("/account/netease/cloud/tracks"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].title").value("夜曲"))
            .andExpect(jsonPath("$[0].audioUrl").value("https://audio.test/123.flac"));

        MockMultipartFile file = new MockMultipartFile(
            "file", "夜曲.flac", "audio/flac", "fLaC-test".getBytes()
        );
        mockMvc.perform(multipart("/account/netease/cloud/tracks").file(file))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("netease:123"));

        mockMvc.perform(get("/account/netease/cloud/tracks/netease:123/lyrics"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lyrics").value("[00:01.00]夜曲"))
            .andExpect(jsonPath("$.source").value("netease-cloud"));
    }
}
