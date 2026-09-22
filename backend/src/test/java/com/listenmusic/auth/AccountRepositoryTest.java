package com.listenmusic.auth;

import com.listenmusic.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class AccountRepositoryTest {
    private JdbcTemplate jdbcTemplate;
    private AccountRepository accountRepository;

    @org.junit.jupiter.api.AfterEach
    void closeDatabase() throws SQLException {
        ((SingleConnectionDataSource) jdbcTemplate.getDataSource()).destroy();
    }

    @BeforeEach
    void createSchema() throws SQLException {
        jdbcTemplate = new JdbcTemplate(new SingleConnectionDataSource(
            DriverManager.getConnection("jdbc:sqlite::memory:"), true
        ));
        accountRepository = new AccountRepository(jdbcTemplate);
        jdbcTemplate.execute("""
            create table provider_accounts (
              provider text not null,
              provider_user_id text not null,
              nickname text,
              avatar_url text,
              credential_reference text,
              active integer not null default 1,
              created_at text not null,
              updated_at text not null,
              primary key (provider, provider_user_id)
            )
            """);
        jdbcTemplate.execute("""
            create table qr_login_sessions (
              session_id text primary key,
              provider text not null,
              qr_key text not null,
              status text not null,
              expires_at text not null,
              credential_reference text,
              created_at text not null,
              updated_at text not null
            )
            """);
    }

    @Test
    void savesAndFindsAnActiveProviderAccount() {
        accountRepository.saveAccount(new ProviderAccount(
            "netease", "100", "测试用户", "https://img.test/avatar.jpg",
            "credential-1", true, "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        ));

        assertThat(accountRepository.findActive("netease")).contains(new ProviderAccount(
            "netease", "100", "测试用户", "https://img.test/avatar.jpg",
            "credential-1", true, "2026-09-13T10:00:00Z", "2026-09-13T10:00:00Z"
        ));

        accountRepository.deactivateProvider("netease");

        assertThat(accountRepository.findActive("netease")).isEmpty();
    }

    @Test
    void listsActiveAccountsForMultipleProvidersIndependently() {
        accountRepository.saveAccount(new ProviderAccount(
            "netease", "100", "网易用户", null,
            "credential-netease", true, "2026-09-18T10:00:00Z", "2026-09-18T10:00:00Z"
        ));
        accountRepository.saveAccount(new ProviderAccount(
            "qq", "200", "QQ用户", null,
            "credential-qq", true, "2026-09-18T10:01:00Z", "2026-09-18T10:01:00Z"
        ));

        assertThat(accountRepository.findAllActive())
            .extracting(ProviderAccount::provider)
            .containsExactly("qq", "netease");

        accountRepository.deactivateProvider("qq");

        assertThat(accountRepository.findAllActive())
            .extracting(ProviderAccount::provider)
            .containsExactly("netease");
    }

    @Test
    void storesAndRemovesExpiredQrSessions() {
        OffsetDateTime now = OffsetDateTime.parse("2026-09-13T10:00:00Z");
        accountRepository.saveQrSession(new QrLoginSession(
            "session-1", "netease", "key-1", "WAITING",
            now.plusMinutes(5), null, now.toString(), now.toString()
        ));

        assertThat(accountRepository.findQrSession("session-1")).isPresent();
        accountRepository.deleteExpiredQrSessions(now.plusMinutes(6));
        assertThat(accountRepository.findQrSession("session-1")).isEmpty();
    }
}
