package com.listenmusic.api;

import com.listenmusic.service.PlaybackService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlaybackController.class)
@Import(com.listenmusic.config.WebConfig.class)
class PlaybackControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PlaybackService playbackService;

    @Test
    void playbackStateCanBeRestoredAndSaved() throws Exception {
        given(playbackService.snapshot()).willReturn(Map.of(
            "trackId", "netease:123",
            "positionSeconds", 42.5,
            "volume", 72,
            "playMode", "sequence"
        ));

        mockMvc.perform(get("/playback/state"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trackId").value("netease:123"))
            .andExpect(jsonPath("$.positionSeconds").value(42.5))
            .andExpect(jsonPath("$.volume").value(72));

        Map<String, Object> state = Map.of(
            "trackId", "netease:123",
            "positionSeconds", 35,
            "volume", 65,
            "playMode", "loop"
        );
        mockMvc.perform(put("/playback/state")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackId\":\"netease:123\",\"positionSeconds\":35,\"volume\":65,\"playMode\":\"loop\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        verify(playbackService).saveState(state);
    }

    @Test
    void playbackQueueCanBeRestoredAndReplaced() throws Exception {
        given(playbackService.queue()).willReturn(List.of());

        mockMvc.perform(get("/playback/queue"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(put("/playback/queue")
                .contentType(MediaType.APPLICATION_JSON)
                .content("[]"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true));
        verify(playbackService).replaceQueue(List.of());
    }
}
