package com.listenmusic.repository;

import com.listenmusic.auth.ProviderAccount;
import com.listenmusic.auth.QrLoginSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class AccountRepository {
    private final JdbcTemplate jdbcTemplate;

    public AccountRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<ProviderAccount> findActive(String provider) {
        return jdbcTemplate.query("""
            select provider, provider_user_id, nickname, avatar_url, credential_reference,
                   active, created_at, updated_at
            from provider_accounts
            where provider = ? and active = 1
            order by updated_at desc
            limit 1
            """, this::mapAccount, provider).stream().findFirst();
    }

    public Optional<ProviderAccount> findAnyActive() {
        return jdbcTemplate.query("""
            select provider, provider_user_id, nickname, avatar_url, credential_reference,
                   active, created_at, updated_at
            from provider_accounts
            where active = 1
            order by updated_at desc
            limit 1
            """, this::mapAccount).stream().findFirst();
    }

    public List<ProviderAccount> findAllActive() {
        return jdbcTemplate.query("""
            select provider, provider_user_id, nickname, avatar_url, credential_reference,
                   active, created_at, updated_at
            from provider_accounts
            where active = 1
            order by updated_at desc
            """, this::mapAccount);
    }

    public void saveAccount(ProviderAccount account) {
        jdbcTemplate.update("""
            insert into provider_accounts(
              provider, provider_user_id, nickname, avatar_url, credential_reference,
              active, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(provider, provider_user_id) do update set
              nickname = excluded.nickname,
              avatar_url = excluded.avatar_url,
              credential_reference = excluded.credential_reference,
              active = excluded.active,
              updated_at = excluded.updated_at
            """,
            account.provider(), account.providerUserId(), account.nickname(), account.avatarUrl(),
            account.credentialReference(), account.active() ? 1 : 0,
            account.createdAt(), account.updatedAt()
        );
    }

    public void deactivateProvider(String provider) {
        jdbcTemplate.update("update provider_accounts set active = 0, updated_at = ? where provider = ?",
            OffsetDateTime.now().toString(), provider);
    }

    public void saveQrSession(QrLoginSession session) {
        jdbcTemplate.update("""
            insert into qr_login_sessions(
              session_id, provider, qr_key, status, expires_at, credential_reference, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(session_id) do update set
              status = excluded.status,
              expires_at = excluded.expires_at,
              credential_reference = excluded.credential_reference,
              updated_at = excluded.updated_at
            """,
            session.sessionId(), session.provider(), session.qrKey(), session.status(),
            session.expiresAt().toString(), session.credentialReference(), session.createdAt(), session.updatedAt()
        );
    }

    public Optional<QrLoginSession> findQrSession(String sessionId) {
        return jdbcTemplate.query("""
            select session_id, provider, qr_key, status, expires_at, credential_reference, created_at, updated_at
            from qr_login_sessions where session_id = ?
            """, this::mapQrSession, sessionId).stream().findFirst();
    }

    public void deleteExpiredQrSessions(OffsetDateTime now) {
        jdbcTemplate.update("delete from qr_login_sessions where expires_at < ?", now.toString());
    }

    public void deleteProviderAccount(String provider) {
        jdbcTemplate.update("delete from provider_accounts where provider = ?", provider);
    }

    private ProviderAccount mapAccount(ResultSet rs, int rowNum) throws SQLException {
        return new ProviderAccount(
            rs.getString("provider"),
            rs.getString("provider_user_id"),
            rs.getString("nickname"),
            rs.getString("avatar_url"),
            rs.getString("credential_reference"),
            rs.getInt("active") == 1,
            rs.getString("created_at"),
            rs.getString("updated_at")
        );
    }

    private QrLoginSession mapQrSession(ResultSet rs, int rowNum) throws SQLException {
        return new QrLoginSession(
            rs.getString("session_id"),
            rs.getString("provider"),
            rs.getString("qr_key"),
            rs.getString("status"),
            OffsetDateTime.parse(rs.getString("expires_at")),
            rs.getString("credential_reference"),
            rs.getString("created_at"),
            rs.getString("updated_at")
        );
    }
}
