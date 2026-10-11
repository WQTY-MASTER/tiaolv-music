package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V11__qq_listening_rank extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists qq_listening_accounts (
                  account_id text primary key,
                  nickname text,
                  avatar_url text,
                  updated_at text not null
                )
                """);
            statement.executeUpdate("""
                create table if not exists qq_listening_tracks (
                  account_id text not null,
                  track_id text not null,
                  title text not null,
                  artist text,
                  album text,
                  duration integer,
                  source text not null,
                  cover_url text,
                  updated_at text not null,
                  primary key (account_id, track_id)
                )
                """);
            statement.executeUpdate("""
                create table if not exists qq_listening_day_stats (
                  account_id text not null,
                  track_id text not null,
                  listen_date text not null,
                  play_count integer not null default 0,
                  listened_seconds real not null default 0,
                  last_listened_at text not null,
                  primary key (account_id, track_id, listen_date)
                )
                """);
            statement.executeUpdate("""
                create index if not exists idx_qq_listening_day_account_date
                on qq_listening_day_stats(account_id, listen_date)
                """);
        }
    }
}
