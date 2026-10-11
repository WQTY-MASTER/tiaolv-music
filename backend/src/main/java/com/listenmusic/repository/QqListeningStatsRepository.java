package com.listenmusic.repository;

import com.listenmusic.domain.QqListeningDataSummary;
import com.listenmusic.domain.QqListeningRankEntry;
import com.listenmusic.domain.Track;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class QqListeningStatsRepository {
    private final JdbcTemplate jdbcTemplate;

    public QqListeningStatsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void recordDelta(
        String accountId,
        String nickname,
        String avatarUrl,
        Track track,
        LocalDate listenDate,
        double listenedSeconds,
        int playCount,
        OffsetDateTime lastListenedAt
    ) {
        String timestamp = lastListenedAt.toString();
        jdbcTemplate.update("""
            insert into qq_listening_accounts(account_id, nickname, avatar_url, updated_at)
            values (?, ?, ?, ?)
            on conflict(account_id) do update set
              nickname = coalesce(excluded.nickname, qq_listening_accounts.nickname),
              avatar_url = coalesce(excluded.avatar_url, qq_listening_accounts.avatar_url),
              updated_at = excluded.updated_at
            """, accountId, blankToNull(nickname), blankToNull(avatarUrl), timestamp);
        jdbcTemplate.update("""
            insert into qq_listening_tracks(
              account_id, track_id, title, artist, album, duration, source, cover_url, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(account_id, track_id) do update set
              title = excluded.title,
              artist = coalesce(excluded.artist, qq_listening_tracks.artist),
              album = coalesce(excluded.album, qq_listening_tracks.album),
              duration = coalesce(excluded.duration, qq_listening_tracks.duration),
              source = excluded.source,
              cover_url = coalesce(excluded.cover_url, qq_listening_tracks.cover_url),
              updated_at = excluded.updated_at
            """,
            accountId, track.id(), normalizedTitle(track.title()), blankToNull(track.artist()),
            blankToNull(track.album()), track.duration(), track.source(), blankToNull(track.coverUrl()), timestamp
        );
        jdbcTemplate.update("""
            insert into qq_listening_day_stats(
              account_id, track_id, listen_date, play_count, listened_seconds, last_listened_at
            ) values (?, ?, ?, ?, ?, ?)
            on conflict(account_id, track_id, listen_date) do update set
              play_count = qq_listening_day_stats.play_count + excluded.play_count,
              listened_seconds = qq_listening_day_stats.listened_seconds + excluded.listened_seconds,
              last_listened_at = case
                when excluded.last_listened_at > qq_listening_day_stats.last_listened_at
                then excluded.last_listened_at
                else qq_listening_day_stats.last_listened_at
              end
            """, accountId, track.id(), listenDate.toString(), playCount, listenedSeconds, timestamp);
    }

    public List<QqListeningRankEntry> findRanking(
        String accountId,
        LocalDate from,
        LocalDate to,
        int limit
    ) {
        String fromValue = from == null ? null : from.toString();
        String toValue = to == null ? null : to.toString();
        return jdbcTemplate.query("""
            select t.track_id, t.title, t.artist, t.album, t.duration, t.source, t.cover_url,
                   sum(s.play_count) as play_count,
                   sum(s.listened_seconds) as listened_seconds,
                   max(s.last_listened_at) as last_listened_at
            from qq_listening_day_stats s
            join qq_listening_tracks t
              on t.account_id = s.account_id and t.track_id = s.track_id
            where s.account_id = ?
              and (? is null or s.listen_date >= ?)
              and (? is null or s.listen_date <= ?)
            group by t.account_id, t.track_id, t.title, t.artist, t.album, t.duration, t.source, t.cover_url
            order by listened_seconds desc, play_count desc, last_listened_at desc
            limit ?
            """, this::mapRankEntry, accountId, fromValue, fromValue, toValue, toValue, limit);
    }

    public List<QqListeningDataSummary> findAccountSummaries() {
        return jdbcTemplate.query("""
            select a.account_id, a.nickname, a.avatar_url,
                   count(distinct s.track_id) as track_count,
                   sum(s.listened_seconds) as listened_seconds,
                   min(s.listen_date) as first_date,
                   max(s.listen_date) as last_date,
                   max(s.last_listened_at) as last_listened_at
            from qq_listening_accounts a
            join qq_listening_day_stats s on s.account_id = a.account_id
            group by a.account_id, a.nickname, a.avatar_url
            order by last_listened_at desc, a.account_id asc
            """, this::mapSummary);
    }

    @Transactional
    public void deleteRange(String accountId, LocalDate from, LocalDate to) {
        jdbcTemplate.update("""
            delete from qq_listening_day_stats
            where account_id = ? and listen_date >= ? and listen_date <= ?
            """, accountId, from.toString(), to.toString());
        deleteOrphanedMetadata(accountId);
    }

    @Transactional
    public void deleteAll(String accountId) {
        jdbcTemplate.update("delete from qq_listening_day_stats where account_id = ?", accountId);
        deleteOrphanedMetadata(accountId);
    }

    private void deleteOrphanedMetadata(String accountId) {
        jdbcTemplate.update("""
            delete from qq_listening_tracks
            where account_id = ? and not exists (
              select 1 from qq_listening_day_stats s
              where s.account_id = qq_listening_tracks.account_id
                and s.track_id = qq_listening_tracks.track_id
            )
            """, accountId);
        jdbcTemplate.update("""
            delete from qq_listening_accounts
            where account_id = ? and not exists (
              select 1 from qq_listening_day_stats s
              where s.account_id = qq_listening_accounts.account_id
            )
            """, accountId);
    }

    private QqListeningRankEntry mapRankEntry(ResultSet rs, int rowNum) throws SQLException {
        String timestamp = rs.getString("last_listened_at");
        Track track = new Track(
            rs.getString("track_id"),
            rs.getString("title"),
            rs.getString("artist"),
            rs.getString("album"),
            rs.getObject("duration", Long.class),
            rs.getString("source"),
            null,
            null,
            rs.getString("cover_url"),
            null,
            null,
            null,
            null,
            timestamp,
            timestamp
        );
        return new QqListeningRankEntry(
            track,
            rs.getLong("play_count"),
            rs.getDouble("listened_seconds"),
            timestamp
        );
    }

    private QqListeningDataSummary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        return new QqListeningDataSummary(
            rs.getString("account_id"),
            rs.getString("nickname"),
            rs.getString("avatar_url"),
            rs.getLong("track_count"),
            rs.getDouble("listened_seconds"),
            rs.getString("first_date"),
            rs.getString("last_date")
        );
    }

    private static String normalizedTitle(String title) {
        return title == null || title.isBlank() ? "未知歌曲" : title.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
