package com.listenmusic.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

@Component
public class EncryptedFileCredentialStore implements CredentialStore {
    private static final String KEY_FILE = "credential.key";
    private static final int KEY_SIZE = 256;
    private static final int IV_SIZE = 12;
    private static final int TAG_SIZE_BITS = 128;

    private final Path directory;
    private final SecureRandom secureRandom = new SecureRandom();
    private SecretKey installationKey;

    public EncryptedFileCredentialStore(
        @Value("${listenmusic.credentials.directory:${user.home}/.tiaolv-music/credentials}") String directory
    ) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    @Override
    public synchronized String put(String provider, String secret) {
        if (provider == null || provider.isBlank()) {
            throw new IllegalArgumentException("音乐源不能为空");
        }
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("凭据不能为空");
        }
        String reference = provider.trim().toLowerCase() + "-" + UUID.randomUUID();
        try {
            Files.createDirectories(directory);
            byte[] iv = new byte[IV_SIZE];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, installationKey(), new GCMParameterSpec(TAG_SIZE_BITS, iv));
            byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
            ByteBuffer payload = ByteBuffer.allocate(1 + IV_SIZE + encrypted.length);
            payload.put((byte) 1).put(iv).put(encrypted);
            Files.write(credentialPath(reference), payload.array());
            return reference;
        } catch (IOException | GeneralSecurityException ex) {
            throw new IllegalStateException("平台凭据保存失败", ex);
        }
    }

    @Override
    public synchronized Optional<String> get(String reference) {
        if (!isSafeReference(reference)) {
            return Optional.empty();
        }
        try {
            byte[] payload = Files.readAllBytes(credentialPath(reference));
            if (payload.length <= 1 + IV_SIZE || payload[0] != 1) {
                return Optional.empty();
            }
            ByteBuffer buffer = ByteBuffer.wrap(payload);
            buffer.get();
            byte[] iv = new byte[IV_SIZE];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, installationKey(), new GCMParameterSpec(TAG_SIZE_BITS, iv));
            return Optional.of(new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8));
        } catch (IOException | GeneralSecurityException ex) {
            return Optional.empty();
        }
    }

    @Override
    public synchronized void delete(String reference) {
        if (!isSafeReference(reference)) {
            return;
        }
        try {
            Files.deleteIfExists(credentialPath(reference));
        } catch (IOException ex) {
            throw new IllegalStateException("平台凭据删除失败", ex);
        }
    }

    private SecretKey installationKey() throws IOException {
        if (installationKey != null) {
            return installationKey;
        }
        Files.createDirectories(directory);
        Path keyPath = directory.resolve(KEY_FILE);
        if (Files.exists(keyPath)) {
            byte[] encoded = Base64.getDecoder().decode(Files.readString(keyPath, StandardCharsets.US_ASCII));
            installationKey = new SecretKeySpec(encoded, "AES");
            return installationKey;
        }
        try {
            KeyGenerator generator = KeyGenerator.getInstance("AES");
            generator.init(KEY_SIZE, secureRandom);
            installationKey = generator.generateKey();
        } catch (GeneralSecurityException ex) {
            throw new IOException("无法生成凭据加密密钥", ex);
        }
        Files.writeString(
            keyPath,
            Base64.getEncoder().encodeToString(installationKey.getEncoded()),
            StandardCharsets.US_ASCII
        );
        return installationKey;
    }

    private Path credentialPath(String reference) {
        return directory.resolve(reference + ".bin").normalize();
    }

    private boolean isSafeReference(String reference) {
        return reference != null && reference.matches("[a-z0-9-]+")
            && credentialPath(reference).getParent().equals(directory);
    }
}
