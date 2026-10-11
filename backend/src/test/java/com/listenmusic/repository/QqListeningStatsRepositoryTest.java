package com.listenmusic.repository;

import com.listenmusic.domain.QqListeningDataSummary;
import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.domain.Track;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QqListeningStatsRepositoryTest {
    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbcTemplate;
    private QqListeningStatsRepository repository;

    @BeforeEach
    void createSchema() throws SQLException {
        dataSource = new SingleConnectionDataSource(
            DriverManager.getConnection("jdbc:sqlite::memory:"), true
        );
        jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("""
            create table qq_listening_accounts (
              account_id text primary key,
              nickname text,
              avatar_url text,
              updated_at text not null
            )
            """);
        jdbcTemplate.execute("""
            create table qq_listening_tracks (
              account_id text not null,
              track_id text not null,
              title text not null,
              artist text,
              album text,
              duration integer,
              source text not null,
              cover_url text,
              updated_at text not null,
              primary key (account_id, track_id)
            )
            """);
        jdbcTemplate.execute("""
            create table qq_listening_day_stats (
              account_id text not null,
              track_id text not null,
              listen_date text not null,
              play_count integer not null default 0,
              listened_seconds real not null default 0,
              last_listened_at text not null,
              primary key (account_id, track_id, listen_date)
            )
            """);
        repository = new QqListeningStatsRepository(jdbcTemplate);
    }

    @AfterEach
    void closeDatabase() {
        if (dataSource != null) dataSource.destroy();
    }

    @Test
    void accumulatesDeltasAndKeepsAccountsIsolated() {
        Track first = track("qq:first", "第一首", "歌手甲");
        OffsetDateTime morning = at("2026-10-08T01:00:00Z");

        repository.recordDelta("100", "账号一", "avatar-1", first, LocalDate.parse("2026-10-08"), 15.5, 0, morning);
        repository.recordDelta("100", "账号一", "avatar-1", first, LocalDate.parse("2026-10-08"), 20.0, 1, morning.plusMinutes(1));
        repository.recordDelta("200", "账号二", null, track("qq:second", "第二首", "歌手乙"), LocalDate.parse("2026-10-08"), 40, 1, morning);

        assertThat(repository.findRanking("100", null, null, 100))
            .singleElement()
            .satisfies(entry -> {
                assertThat(entry.track().id()).isEqualTo("qq:first");
                assertThat(entry.track().title()).isEqualTo("第一首");
                assertThat(entry.playCount()).isEqualTo(1);
                assertThat(entry.listenedSeconds()).isEqualTo(35.5);
                assertThat(entry.lastListenedAt()).isEqualTo("2026-10-08T01:01Z");
            });
        assertThat(repository.findRanking("200", null, null, 100))
            .extracting(entry -> entry.track().id())
            .containsExactly("qq:second");
    }

    @Test
    void filtersInclusiveRangesAndSortsBySecondsCountThenLastTime() {
        record("100", "qq:a", "A", "2026-10-01", 20, 1, "2026-10-01T10:00:00Z");
        record("100", "qq:a", "A", "2026-10-08", 30, 0, "2026-10-08T10:00:00Z");
        record("100", "qq:b", "B", "2026-10-08", 50, 0, "2026-10-08T09:00:00Z");
        record("100", "qq:c", "C", "2026-10-08", 50, 2, "2026-10-08T08:00:00Z");
        record("100", "qq:d", "D", "2026-10-08", 50, 2, "2026-10-08T11:00:00Z");

        List<QqListeningRankEntry> range = repository.findRanking(
            "100", LocalDate.parse("2026-10-02"), LocalDate.parse("2026-10-08"), 100
        );

        assertThat(range).extracting(entry -> entry.track().id())
            .containsExactly("qq:d", "qq:c", "qq:b", "qq:a");
        assertThat(range.get(3).listenedSeconds()).isEqualTo(30);
        assertThat(repository.findRanking(
            "100", LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-01"), 100
        )).extracting(entry -> entry.track().id()).containsExactly("qq:a");
    }

    @Test
    void summarizesAccountsAndDeletesOnlyTheSelectedAccountRange() {
        record("100", "qq:a", "A", "2026-09-30", 20, 1, "2026-09-30T10:00:00Z");
        record("100", "qq:a", "A", "2026-10-08", 30, 1, "2026-10-08T10:00:00Z");
        record("100", "qq:b", "B", "2026-10-08", 10, 0, "2026-10-08T11:00:00Z");
        repository.recordDelta("200", "账号二", "avatar-2", track("qq:c", "C", "歌手"),
            LocalDate.parse("2026-10-08"), 60, 1, at("2026-10-08T12:00:00Z"));

        assertThat(repository.findAccountSummaries())
            .extracting(QqListeningDataSummary::accountId)
            .containsExactly("200", "100");
        QqListeningDataSummary first = repository.findAccountSummaries().stream()
            .filter(summary -> summary.accountId().equals("100"))
            .findFirst().orElseThrow();
        assertThat(first.trackCount()).isEqualTo(2);
        assertThat(first.listenedSeconds()).isEqualTo(60);
        assertThat(first.firstDate()).isEqualTo("2026-09-30");
        assertThat(first.lastDate()).isEqualTo("2026-10-08");

        repository.deleteRange("100", LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-31"));

        assertThat(repository.findRanking("100", null, null, 100))
            .singleElement().satisfies(entry -> {
                assertThat(entry.track().id()).isEqualTo("qq:a");
                assertThat(entry.listenedSeconds()).isEqualTo(20);
            });
        assertThat(repository.findRanking("200", null, null, 100)).hasSize(1);

        repository.deleteAll("100");

        assertThat(repository.findRanking("100", null, null, 100)).isEmpty();
        assertThat(repository.findAccountSummaries())
            .extracting(QqListeningDataSummary::accountId)
            .containsExactly("200");
    }

    private void record(String accountId, String id, String title, String date, double seconds, int plays, String timestamp) {
        repository.recordDelta(accountId, "账号" + accountId, null, track(id, title, "歌手"),
            LocalDate.parse(date), seconds, plays, at(timestamp));
    }

    private static Track track(String id, String title, String artist) {
        return new Track(
            id, title, artist, "专辑", 180L, "qq", null, null,
            "https://img.test/cover.jpg", null, null, null, null, null
        );
    }

    private static OffsetDateTime at(String value) {
        return OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
