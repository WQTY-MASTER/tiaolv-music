package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V1__init extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        Statement statement = context.getConnection().createStatement();
        statement.executeUpdate("""
            create table if not exists tracks (
              id text primary key,
              title text not null,
              artist text,
              album text,
              duration integer,
              source text not null,
              file_path text,
              url text,
              cover_url text,
              created_at text not null,
              updated_at text not null
            )
            """);
        statement.executeUpdate("""
            create table if not exists playlists (
              id text primary key,
              name text not null,
              source text not null,
              created_at text not null,
              updated_at text not null
            )
            """);
        statement.executeUpdate("""
            create table if not exists playlist_items (
              playlist_id text not null,
              track_id text not null,
              position integer not null,
              primary key (playlist_id, track_id),
              foreign key (playlist_id) references playlists (id) on delete cascade,
              foreign key (track_id) references tracks (id) on delete cascade
            )
            """);
        statement.executeUpdate("""
            create table if not exists play_history (
              id integer primary key autoincrement,
              track_id text not null,
              played_at text not null,
              source text not null,
              foreign key (track_id) references tracks (id) on delete cascade
            )
            """);
        statement.executeUpdate("""
            create table if not exists provider_cache (
              cache_key text primary key,
              provider text not null,
              payload text not null,
              expires_at text not null,
              updated_at text not null
            )
            """);
        statement.close();
    }
}
