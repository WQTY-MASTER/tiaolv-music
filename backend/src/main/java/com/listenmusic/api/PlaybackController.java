package com.listenmusic.api;

import com.listenmusic.service.PlaybackService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;
import com.listenmusic.domain.Track;

@RestController
@RequestMapping("/playback")
public class PlaybackController {
    private final PlaybackService playbackService;

    public PlaybackController(PlaybackService playbackService) {
        this.playbackService = playbackService;
    }

    @PostMapping("/play")
    public Map<String, Object> play(@RequestBody Map<String, String> body) {
        playbackService.play(body.get("trackId"));
        return Map.of("ok", true);
    }

    @PostMapping("/pause")
    public Map<String, Object> pause() {
        playbackService.pause();
        return Map.of("ok", true);
    }

    @PostMapping("/volume")
    public Map<String, Object> volume(@RequestBody Map<String, Object> body) {
        playbackService.setVolume(((Number) body.get("value")).intValue());
        return Map.of("ok", true);
    }

    @GetMapping("/state")
    public Map<String, Object> state() {
        return playbackService.snapshot();
    }

    @PutMapping("/state")
    public Map<String, Object> saveState(@RequestBody Map<String, Object> body) {
        playbackService.saveState(body);
        return Map.of("ok", true);
    }

    @GetMapping("/queue")
    public List<Track> queue() {
        return playbackService.queue();
    }

    @PutMapping("/queue")
    public Map<String, Object> replaceQueue(@RequestBody List<Track> tracks) {
        playbackService.replaceQueue(tracks);
        return Map.of("ok", true);
    }
}
