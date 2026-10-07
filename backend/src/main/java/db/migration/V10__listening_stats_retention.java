package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V10__listening_stats_retention extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists listening_track_day_stats (
                  profile_id text not null,
                  track_id text not null,
                  listen_date text not null,
                  play_count integer not null default 0,
                  listened_seconds real not null default 0,
                  last_listened_at text not null,
                  primary key (profile_id, track_id, listen_date)
                )
                """);
            statement.executeUpdate("""
                create index if not exists idx_listening_track_day_profile_date
                on listening_track_day_stats(profile_id, listen_date)
                """);
            statement.executeUpdate("""
                create table if not exists listening_stats_meta (
                  profile_id text primary key,
                  revision integer not null default 0
                )
                """);
            statement.executeUpdate("""
                insert or ignore into listening_track_day_stats(
                  profile_id, track_id, listen_date, play_count, listened_seconds, last_listened_at
                )
                select profile_id,
                       track_id,
                       coalesce(date(last_listened_at, 'localtime'), substr(last_listened_at, 1, 10)),
                       play_count,
                       listened_seconds,
                       last_listened_at
                from listening_track_stats
                where play_count > 0 or listened_seconds > 0
                """);
            statement.executeUpdate("""
                insert or ignore into listening_stats_meta(profile_id, revision)
                select profile_id, 0 from listening_track_stats
                union
                select profile_id, 0 from listening_day_stats
                """);
        }
    }
}
