package com.listenmusic.auth;

import java.util.Optional;

public interface CredentialStore {
    String put(String provider, String secret);

    Optional<String> get(String reference);

    void delete(String reference);
}
