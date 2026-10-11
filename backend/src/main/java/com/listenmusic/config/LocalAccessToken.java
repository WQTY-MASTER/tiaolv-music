package com.listenmusic.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

public final class LocalAccessToken {
    private final String value;

    private LocalAccessToken(String value) {
        this.value = value;
    }

    public static LocalAccessToken open(Path tokenPath) {
        Path path = tokenPath.toAbsolutePath().normalize();
        try {
            Files.createDirectories(path.getParent());
            if (Files.notExists(path, LinkOption.NOFOLLOW_LINKS)) {
                byte[] bytes = new byte[32];
                new SecureRandom().nextBytes(bytes);
                String generated = HexFormat.of().formatHex(bytes);
                try {
                    if (Files.getFileStore(path.getParent()).supportsFileAttributeView("posix")) {
                        try (var channel = Files.newByteChannel(path,
                            java.util.Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE),
                            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))) {
                            var buffer = StandardCharsets.US_ASCII.encode(generated);
                            while (buffer.hasRemaining()) channel.write(buffer);
                        }
                    } else {
                        Files.writeString(path, generated, StandardCharsets.US_ASCII,
                            StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
                    }
                } catch (FileAlreadyExistsException ignored) {
                    // Another instance may have initialized the installation token.
                }
            }
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || Files.size(path) > 66) {
                throw new IllegalStateException("Invalid local access token file");
            }
            String value = Files.readString(path, StandardCharsets.US_ASCII).trim();
            if (!value.matches("[a-f0-9]{64}")) throw new IllegalStateException("Invalid local access token file");
            return new LocalAccessToken(value);
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot initialize local API access", ex);
        }
    }

    String value() {
        return value;
    }

    boolean matches(String candidate) {
        return candidate != null && candidate.length() == value.length()
            && MessageDigest.isEqual(value.getBytes(StandardCharsets.US_ASCII), candidate.getBytes(StandardCharsets.US_ASCII));
    }
}
