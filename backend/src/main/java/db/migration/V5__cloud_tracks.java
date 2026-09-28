package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V5__cloud_tracks extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists cloud_tracks (
                  id text primary key,
                  provider text not null,
                  provider_user_id text not null,
                  title text not null,
                  artist text not null,
                  album text not null,
                  duration_seconds integer not null default 0,
                  original_file_name text not null,
                  stored_file_name text not null,
                  format text not null,
                  size_bytes integer not null,
                  cover_mime_type text,
                  uploaded_at text not null
                )
                """);
        }
    }
}
