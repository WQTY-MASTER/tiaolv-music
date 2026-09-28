package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Statement;

public class V7__track_metadata_source extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        try (Statement statement = context.getConnection().createStatement()) {
            statement.executeUpdate("alter table tracks add column meta_source text");
            statement.executeUpdate("alter table user_tracks add column meta_source text");
        }
    }
}
