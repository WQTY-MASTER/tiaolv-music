package db.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class MigrationSequenceTest {
    @TempDir
    Path tempDir;

    @Test
    void preservesPublishedMigrationVersionsAndAddsLocalLibraryDeduplicationInVersionEight() throws Exception {
        String jdbcUrl = "jdbc:sqlite:" + tempDir.resolve("migration-test.db");
        Flyway flyway = Flyway.configure()
            .dataSource(jdbcUrl, null, null)
            .locations("classpath:db/migration")
            .load();

        flyway.migrate();

        assertThat(Arrays.stream(flyway.info().all())
            .filter(info -> info.getVersion() != null)
            .map(MigrationSequenceTest::versionAndDescription))
            .containsExactly(
                "1:init",
                "2:local track assets",
                "3:user data",
                "4:provider accounts",
                "5:cloud tracks",
                "6:track lyrics format",
                "7:track metadata source",
                "8:local library deduplication"
            );

        try (var connection = DriverManager.getConnection(jdbcUrl)) {
            assertThat(tableExists(connection, "cloud_tracks")).isTrue();
            assertThat(columnExists(connection, "tracks", "lyrics_format")).isTrue();
            assertThat(columnExists(connection, "user_tracks", "lyrics_format")).isTrue();
            assertThat(columnExists(connection, "tracks", "meta_source")).isTrue();
            assertThat(columnExists(connection, "user_tracks", "meta_source")).isTrue();
            assertThat(tableExists(connection, "local_library_roots")).isTrue();
            assertThat(tableExists(connection, "ignored_local_files")).isTrue();
            assertThat(indexExists(connection, "idx_tracks_local_file_path_unique")).isTrue();
        }
    }

    @Test
    void versionEightCollapsesLegacyCaseInsensitivePathDuplicates() throws Exception {
        String jdbcUrl = "jdbc:sqlite:" + tempDir.resolve("legacy-duplicates.db");
        Flyway.configure()
            .dataSource(jdbcUrl, null, null)
            .locations("classpath:db/migration")
            .target("7")
            .load()
            .migrate();

        try (var connection = DriverManager.getConnection(jdbcUrl);
             var statement = connection.prepareStatement("""
                 insert into tracks (
                   id, title, artist, album, duration, source, file_path, created_at, updated_at
                 ) values (?, '歌曲', '歌手', '专辑', 180, 'local', ?, 'now', 'now')
                 """)) {
            statement.setString(1, "local-first");
            statement.setString(2, "G:\\Music\\歌曲.flac");
            statement.executeUpdate();
            statement.setString(1, "local-second");
            statement.setString(2, "g:\\music\\歌曲.flac");
            statement.executeUpdate();
        }

        Flyway.configure()
            .dataSource(jdbcUrl, null, null)
            .locations("classpath:db/migration")
            .load()
            .migrate();

        try (var connection = DriverManager.getConnection(jdbcUrl);
             var statement = connection.createStatement();
             var result = statement.executeQuery("""
                 select count(*)
                 from tracks
                 where source = 'local' and lower(file_path) = lower('G:\\Music\\歌曲.flac')
                 """)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).isEqualTo(1);
            assertThat(indexExists(connection, "idx_tracks_local_file_path_unique")).isTrue();
        }
    }

    private static String versionAndDescription(MigrationInfo info) {
        return info.getVersion().getVersion() + ":" + info.getDescription();
    }

    private static boolean tableExists(java.sql.Connection connection, String table) throws Exception {
        try (var statement = connection.prepareStatement(
            "select count(*) from sqlite_master where type = 'table' and name = ?"
        )) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                return result.next() && result.getInt(1) == 1;
            }
        }
    }

    private static boolean columnExists(
        java.sql.Connection connection,
        String table,
        String column
    ) throws Exception {
        try (var statement = connection.createStatement();
             var result = statement.executeQuery("pragma table_info(" + table + ")")) {
            while (result.next()) {
                if (column.equals(result.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static boolean indexExists(java.sql.Connection connection, String index) throws Exception {
        try (var statement = connection.prepareStatement(
            "select count(*) from sqlite_master where type = 'index' and name = ?"
        )) {
            statement.setString(1, index);
            try (var result = statement.executeQuery()) {
                return result.next() && result.getInt(1) == 1;
            }
        }
    }
}
