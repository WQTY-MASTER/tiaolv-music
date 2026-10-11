package com.listenmusic.repository;

import com.listenmusic.domain.ListeningStats;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserDataRepositoryListeningStatsTest {
    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbcTemplate;
    private UserDataRepository repository;

    @BeforeEach
    void createSchema() throws SQLException {
        dataSource = new SingleConnectionDataSource(
            DriverManager.getConnection("jdbc:sqlite::memory:"), true
        );
        jdbcTemplate = new JdbcTemplate(dataSource);
        repository = new UserDataRepository(jdbcTemplate);
        jdbcTemplate.execute("""
            create table listening_track_stats (
              profile_id text not null,
              track_id text not null,
              play_count integer not null,
              listened_seconds real not null,
              last_listened_at text not null,
              primary key (profile_id, track_id)
            )
            """);
        jdbcTemplate.execute("""
            create table listening_day_stats (
              profile_id text not null,
              listen_date text not null,
              listened_seconds real not null,
              primary key (profile_id, listen_date)
            )
            """);
        jdbcTemplate.execute("""
            create table listening_track_day_stats (
              profile_id text not null,
              track_id text not null,
              listen_date text not null,
              play_count integer not null default 0,
              listened_seconds real not null default 0,
              last_listened_at text not null,
              primary key (profile_id, track_id, listen_date)
            )
            """);
        jdbcTemplate.execute("""
            create table listening_stats_meta (
              profile_id text primary key,
              revision integer not null default 0
            )
            """);
    }

    @AfterEach
    void closeDatabase() {
        if (dataSource != null) dataSource.destroy();
    }

    @Test
    void mergesAndReloadsListeningStatsWithoutLeakingProfiles() {
        ListeningStats stats = new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 3, 125.5, "2026-10-04T09:00:00Z", "2026-10-04"
            )),
            Map.of("2026-10-04", new ListeningStats.DayStat("2026-10-04", 125.5))
        );

        repository.mergeListeningStats("local", stats);

        assertThat(repository.findListeningStats("local")).isEqualTo(stats);
        assertThat(repository.findListeningStats("other").tracks()).isEmpty();
        assertThat(repository.findListeningStats("other").days()).isEmpty();
    }

    @Test
    void staleOrEmptySnapshotsCannotEraseNewerListeningStats() {
        ListeningStats complete = new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 4, 124.49, "2026-10-03T07:33:31.753Z", "2026-10-03"
            )),
            Map.of("2026-10-03", new ListeningStats.DayStat("2026-10-03", 124.49))
        );
        ListeningStats stale = new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 1, 12, "2026-10-03T07:00:00Z", "2026-10-03"
            )),
            Map.of("2026-10-03", new ListeningStats.DayStat("2026-10-03", 12))
        );

        repository.mergeListeningStats("local", complete);
        repository.mergeListeningStats("local", new ListeningStats(Map.of(), Map.of()));
        repository.mergeListeningStats("local", stale);

        assertThat(repository.findListeningStats("local")).isEqualTo(complete);
    }

    @Test
    void deletesOnlyTheSelectedDateRangeAndRejectsTheOldRevision() {
        repository.mergeListeningStats("local", new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 2, 60, "2026-07-15T09:00:00Z", "2026-07-15"
            )),
            Map.of("2026-07-15", new ListeningStats.DayStat("2026-07-15", 60))
        ));
        repository.mergeListeningStats("local", new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 3, 90, "2026-08-02T09:00:00Z", "2026-08-02"
            )),
            Map.of(
                "2026-07-15", new ListeningStats.DayStat("2026-07-15", 60),
                "2026-08-02", new ListeningStats.DayStat("2026-08-02", 30)
            )
        ));

        var preview = repository.summarizeListeningStats(
            "local", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31")
        );
        assertThat(preview.rangeTrackCount()).isEqualTo(1);
        assertThat(preview.rangeActiveDays()).isEqualTo(1);
        assertThat(preview.rangeListenedSeconds()).isEqualTo(60);

        ListeningStats remaining = repository.deleteListeningStats(
            "local", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31")
        );
        assertThat(remaining.revision()).isEqualTo(1);
        assertThat(remaining.tracks().get("local:a").playCount()).isEqualTo(1);
        assertThat(remaining.tracks().get("local:a").listenedSeconds()).isEqualTo(30);
        assertThat(remaining.days()).containsOnlyKeys("2026-08-02");

        assertThatThrownBy(() -> repository.mergeListeningStats("local", new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 4, 120, "2026-08-03T09:00:00Z", "2026-08-03"
            )),
            Map.of()
        ))).isInstanceOf(com.listenmusic.service.StaleListeningStatsException.class);
    }

    @Test
    void deletesAllListeningStatsAndKeepsTheNewRevision() {
        repository.mergeListeningStats("local", new ListeningStats(
            0,
            Map.of("local:a", new ListeningStats.TrackStat(
                "local:a", 1, 30, "2026-07-15T09:00:00Z", "2026-07-15"
            )),
            Map.of("2026-07-15", new ListeningStats.DayStat("2026-07-15", 30))
        ));

        ListeningStats cleared = repository.deleteAllListeningStats("local");

        assertThat(cleared.revision()).isEqualTo(1);
        assertThat(cleared.tracks()).isEmpty();
        assertThat(cleared.days()).isEmpty();
    }

    @Test
    void deletesLegacyDayOnlyStatsInTheSelectedRange() {
        jdbcTemplate.update(
            "insert into listening_day_stats(profile_id, listen_date, listened_seconds) values (?, ?, ?)",
            "local", "2023-07-12", 45
        );
        jdbcTemplate.update(
            "insert into listening_day_stats(profile_id, listen_date, listened_seconds) values (?, ?, ?)",
            "local", "2023-08-03", 30
        );

        ListeningStats cleared = repository.deleteListeningStats(
            "local", LocalDate.parse("2023-07-01"), LocalDate.parse("2023-07-31")
        );

        assertThat(cleared.revision()).isEqualTo(1);
        assertThat(cleared.days()).containsOnlyKeys("2023-08-03");
    }

    @Test
    void deletingAllLegacyAggregatesIncrementsTheRevision() {
        jdbcTemplate.update(
            "insert into listening_day_stats(profile_id, listen_date, listened_seconds) values (?, ?, ?)",
            "local", "2023-07-12", 45
        );

        ListeningStats cleared = repository.deleteAllListeningStats("local");

        assertThat(cleared.revision()).isEqualTo(1);
        assertThat(cleared.days()).isEmpty();
    }
}
