package com.listenmusic.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NetEaseSessionStoreTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void persistsCookieAndUidToNeteaseCookieJson() throws Exception {
        Path sessionFile = temporaryDirectory.resolve("netease_cookie.json");
        NetEaseSessionStore store = new NetEaseSessionStore(sessionFile.toString());

        store.save("100", "MUSIC_U=secret");

        assertTrue(Files.exists(sessionFile));
        NetEaseSessionStore.Session session = store.read().orElseThrow();
        assertEquals("100", session.uid());
        assertEquals("MUSIC_U=secret", session.cookie());
        assertTrue(Files.readString(sessionFile).contains("\"uid\""));
        assertTrue(Files.readString(sessionFile).contains("\"cookie\""));

        store.delete();
        assertFalse(Files.exists(sessionFile));
    }
}
