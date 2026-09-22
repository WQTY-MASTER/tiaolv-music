package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V3__user_data extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists user_tracks (
                  profile_id text not null,
                  track_id text not null,
                  title text not null,
                  artist text,
                  album text,
                  duration integer,
                  source text not null,
                  file_path text,
                  url text,
                  cover_url text,
                  lyrics text,
                  lyrics_source text,
                  cover_mime_type text,
                  created_at text not null,
                  updated_at text not null,
                  primary key (profile_id, track_id)
                )
                """);
            statement.executeUpdate("""
                create table if not exists favorites (
                  profile_id text not null,
                  track_id text not null,
                  created_at text not null,
                  primary key (profile_id, track_id)
                )
                """);
            statement.executeUpdate("""
                create table if not exists recent_tracks (
                  profile_id text not null,
                  track_id text not null,
                  played_at text not null,
                  primary key (profile_id, track_id)
                )
                """);
            statement.executeUpdate("""
                create table if not exists playback_queue (
                  profile_id text not null,
                  position integer not null,
                  track_id text not null,
                  primary key (profile_id, position)
                )
                """);
            statement.executeUpdate("""
                create table if not exists playback_state (
                  profile_id text primary key,
                  current_track_id text,
                  position_seconds real not null default 0,
                  volume integer not null default 72,
                  play_mode text not null default 'sequence',
                  updated_at text not null
                )
                """);
            statement.executeUpdate("create index if not exists idx_recent_tracks_profile_time on recent_tracks(profile_id, played_at desc)");
        }
    }
}
