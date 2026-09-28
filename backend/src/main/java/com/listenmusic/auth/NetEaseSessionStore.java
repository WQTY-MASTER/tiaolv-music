package com.listenmusic.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.Optional;

@Component
public class NetEaseSessionStore {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final Path sessionFile;

    public NetEaseSessionStore(
        @Value("${listenmusic.providers.netease.session-file:${user.home}/.tiaolv-music/netease_cookie.json}") String sessionFile
    ) {
        this.sessionFile = Path.of(sessionFile).toAbsolutePath().normalize();
    }

    public synchronized void save(String uid, String cookie) {
        if (!isUsableUid(uid) || cookie == null || cookie.isBlank()) {
            throw new IllegalArgumentException("网易云 uid 和 cookie 不能为空");
        }
        try {
            Files.createDirectories(sessionFile.getParent());
            Path temporaryFile = sessionFile.resolveSibling(sessionFile.getFileName() + ".tmp");
            String json = OBJECT_MAPPER.writerWithDefaultPrettyPrinter()
                .writeValueAsString(new Session(uid.trim(), cookie.trim(), OffsetDateTime.now().toString()));
            Files.writeString(temporaryFile, json, StandardCharsets.UTF_8);
            moveAtomically(temporaryFile, sessionFile);
        } catch (IOException ex) {
            throw new IllegalStateException("网易云登录状态保存失败", ex);
        }
    }

    public synchronized Optional<Session> read() {
        if (!Files.isRegularFile(sessionFile)) {
            return Optional.empty();
        }
        try {
            Session session = OBJECT_MAPPER.readValue(Files.readString(sessionFile, StandardCharsets.UTF_8), Session.class);
            if (!isUsableUid(session.uid()) || session.cookie() == null || session.cookie().isBlank()) {
                return Optional.empty();
            }
            return Optional.of(session);
        } catch (IOException | RuntimeException ex) {
            return Optional.empty();
        }
    }

    public synchronized void delete() {
        try {
            Files.deleteIfExists(sessionFile);
            Files.deleteIfExists(sessionFile.resolveSibling(sessionFile.getFileName() + ".tmp"));
        } catch (IOException ex) {
            throw new IllegalStateException("网易云登录状态清理失败", ex);
        }
    }

    private static void moveAtomically(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static boolean isUsableUid(String uid) {
        return uid != null && !uid.isBlank() && !"unknown".equalsIgnoreCase(uid.trim());
    }

    public record Session(String uid, String cookie, String savedAt) {
    }
}
