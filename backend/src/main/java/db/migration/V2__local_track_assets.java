package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V2__local_track_assets extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("alter table tracks add column lyrics text");
            statement.executeUpdate("alter table tracks add column lyrics_source text");
            statement.executeUpdate("alter table tracks add column cover_mime_type text");
        }
    }
}
