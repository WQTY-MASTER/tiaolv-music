package com.listenmusic.auth;

import com.listenmusic.repository.AccountRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
public class AccountAuthService {
    private final AccountRepository accountRepository;
    private final CredentialStore credentialStore;
    private final QqMusicAuthService qqMusicAuthService;
    private final NetEaseSessionStore netEaseSessionStore;

    public AccountAuthService(
        AccountRepository accountRepository,
        CredentialStore credentialStore,
        QqMusicAuthService qqMusicAuthService,
        NetEaseSessionStore netEaseSessionStore
    ) {
        this.accountRepository = accountRepository;
        this.credentialStore = credentialStore;
        this.qqMusicAuthService = qqMusicAuthService;
        this.netEaseSessionStore = netEaseSessionStore;
    }

    public List<AccountView> accounts() {
        return accountRepository.findAllActive().stream()
            .map(account -> new AccountView(
                account.provider(), account.providerUserId(), account.nickname(), account.avatarUrl()
            ))
            .toList();
    }

    public AccountView loginQq(String cookie) {
        return qqMusicAuthService.login(cookie);
    }

    public synchronized void logout(String provider) {
        String normalizedProvider = normalizeProvider(provider);
        accountRepository.findActive(normalizedProvider).ifPresent(account -> {
            credentialStore.delete(account.credentialReference());
            accountRepository.deactivateProvider(normalizedProvider);
        });
        if ("netease".equals(normalizedProvider)) {
            netEaseSessionStore.delete();
        }
    }

    private static String normalizeProvider(String provider) {
        String normalized = provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
        if (!"netease".equals(normalized) && !"qq".equals(normalized)) {
            throw new IllegalArgumentException("暂不支持的平台: " + provider);
        }
        return normalized;
    }
}
