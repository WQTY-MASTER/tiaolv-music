package com.listenmusic.api;

import com.listenmusic.provider.CloudTrack;
import com.listenmusic.provider.CloudUpload;
import com.listenmusic.provider.LyricData;
import com.listenmusic.service.AccountCatalogService;
import com.listenmusic.service.AccountLoginRequiredException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/account/{provider}/cloud/tracks")
public class CloudController {
    private final AccountCatalogService accountCatalogService;

    public CloudController(AccountCatalogService accountCatalogService) {
        this.accountCatalogService = accountCatalogService;
    }

    @GetMapping
    public List<CloudTrack> tracks(@PathVariable String provider) {
        return accountCatalogService.loadCloudTracks(provider);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CloudTrack upload(@PathVariable String provider, @RequestPart("file") MultipartFile file) {
        try {
            return accountCatalogService.uploadCloudTrack(provider, new CloudUpload(
                file.getOriginalFilename(), file.getContentType(), file.getBytes()
            ));
        } catch (IOException ex) {
            throw new UncheckedIOException("读取待上传音频失败", ex);
        }
    }

    @GetMapping("/{id}/lyrics")
    public ResponseEntity<LyricData> lyrics(@PathVariable String provider, @PathVariable String id) {
        return accountCatalogService.loadCloudLyrics(provider, id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @ExceptionHandler(AccountLoginRequiredException.class)
    public ResponseEntity<Map<String, String>> loginRequired(AccountLoginRequiredException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("code", "LOGIN_REQUIRED", "message", ex.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, UnsupportedOperationException.class})
    public ResponseEntity<Map<String, String>> badRequest(RuntimeException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
    }
}
