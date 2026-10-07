package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V9__listening_stats extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists listening_track_stats (
                  profile_id text not null,
                  track_id text not null,
                  play_count integer not null default 0,
                  listened_seconds real not null default 0,
                  last_listened_at text not null,
                  primary key (profile_id, track_id)
                )
                """);
            statement.executeUpdate("""
                create table if not exists listening_day_stats (
                  profile_id text not null,
                  listen_date text not null,
                  listened_seconds real not null default 0,
                  primary key (profile_id, listen_date)
                )
                """);
            statement.executeUpdate("""
                create index if not exists idx_listening_day_stats_profile_date
                on listening_day_stats(profile_id, listen_date)
                """);
        }
    }
}
