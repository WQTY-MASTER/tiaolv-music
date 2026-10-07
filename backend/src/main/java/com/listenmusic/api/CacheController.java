package com.listenmusic.api;

import com.listenmusic.service.ProviderResourceCache;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/cache")
public class CacheController {
    public record Snapshot(
        ProviderResourceCache.Settings settings,
        ProviderResourceCache.Statistics statistics
    ) {
    }

    private final ProviderResourceCache resourceCache;

    public CacheController(ProviderResourceCache resourceCache) {
        this.resourceCache = resourceCache;
    }

    @GetMapping
    public Snapshot snapshot() {
        return currentSnapshot();
    }

    @PutMapping("/settings")
    public Snapshot updateSettings(@RequestBody ProviderResourceCache.Settings settings) {
        ProviderResourceCache.Settings updated = resourceCache.update(settings);
        return new Snapshot(updated, resourceCache.statistics());
    }

    @PostMapping("/default-directory")
    public Snapshot restoreDefaultDirectory() {
        ProviderResourceCache.Settings updated = resourceCache.restoreDefaultDirectory();
        return new Snapshot(updated, resourceCache.statistics());
    }

    @DeleteMapping
    public Snapshot clear() {
        ProviderResourceCache.Statistics statistics = resourceCache.clear();
        return new Snapshot(resourceCache.settings(), statistics);
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler({IllegalArgumentException.class})
    public void badRequest() {
    }

    private Snapshot currentSnapshot() {
        return new Snapshot(resourceCache.settings(), resourceCache.statistics());
    }
}
