package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V4__provider_accounts extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists provider_accounts (
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
            statement.executeUpdate("""
                create table if not exists qr_login_sessions (
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
            statement.executeUpdate("create index if not exists idx_provider_accounts_active on provider_accounts(provider, active)");
            statement.executeUpdate("create index if not exists idx_qr_login_sessions_expiry on qr_login_sessions(provider, expires_at)");
        }
    }
}
