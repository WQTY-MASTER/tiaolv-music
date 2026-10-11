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
    void preservesPublishedMigrationVersionsAndAddsQqListeningRankInVersionEleven() throws Exception {
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
                "8:local library deduplication",
                "9:listening stats",
                "10:listening stats retention",
                "11:qq listening rank"
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
            assertThat(tableExists(connection, "listening_track_stats")).isTrue();
            assertThat(tableExists(connection, "listening_day_stats")).isTrue();
            assertThat(tableExists(connection, "listening_track_day_stats")).isTrue();
            assertThat(tableExists(connection, "listening_stats_meta")).isTrue();
            assertThat(tableExists(connection, "qq_listening_accounts")).isTrue();
            assertThat(tableExists(connection, "qq_listening_tracks")).isTrue();
            assertThat(tableExists(connection, "qq_listening_day_stats")).isTrue();
        }
    }

    @Test
    void versionTenBackfillsExistingTrackTotalsToTheirLastListeningDate() throws Exception {
        String jdbcUrl = "jdbc:sqlite:" + tempDir.resolve("legacy-listening-stats.db");
        Flyway.configure()
            .dataSource(jdbcUrl, null, null)
            .locations("classpath:db/migration")
            .target("9")
            .load()
            .migrate();

        try (var connection = DriverManager.getConnection(jdbcUrl);
             var statement = connection.createStatement()) {
            statement.executeUpdate("""
                insert into listening_track_stats(
                  profile_id, track_id, play_count, listened_seconds, last_listened_at
                ) values ('local', 'local:a', 4, 124.49, '2026-10-03T07:33:31.753Z')
                """);
            statement.executeUpdate("""
                insert into listening_day_stats(profile_id, listen_date, listened_seconds)
                values ('local', '2026-10-03', 124.49)
                """);
        }

        Flyway.configure()
            .dataSource(jdbcUrl, null, null)
            .locations("classpath:db/migration")
            .load()
            .migrate();

        try (var connection = DriverManager.getConnection(jdbcUrl);
             var statement = connection.createStatement();
             var result = statement.executeQuery("""
                 select track_id, listen_date, play_count, listened_seconds
                 from listening_track_day_stats
                 where profile_id = 'local'
                 """)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString("track_id")).isEqualTo("local:a");
            assertThat(result.getString("listen_date")).isEqualTo("2026-10-03");
            assertThat(result.getInt("play_count")).isEqualTo(4);
            assertThat(result.getDouble("listened_seconds")).isEqualTo(124.49);
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
