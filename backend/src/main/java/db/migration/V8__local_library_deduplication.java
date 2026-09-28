package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V8__local_library_deduplication extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("""
                create table if not exists local_library_roots (
                  path_key text primary key,
                  directory text not null,
                  created_at text not null
                )
                """);
            statement.executeUpdate("""
                create table if not exists ignored_local_files (
                  path_key text primary key,
                  file_path text not null,
                  created_at text not null
                )
                """);
            statement.executeUpdate("""
                delete from tracks
                where source = 'local'
                  and file_path is not null
                  and rowid not in (
                    select min(rowid)
                    from tracks
                    where source = 'local' and file_path is not null
                    group by lower(file_path)
                  )
                """);
            statement.executeUpdate("""
                create unique index if not exists idx_tracks_local_file_path_unique
                on tracks(lower(file_path))
                where source = 'local' and file_path is not null
                """);
        }
    }
}
