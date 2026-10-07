package com.listenmusic.repository;

import com.listenmusic.domain.Track;
import com.listenmusic.domain.ListeningStats;
import com.listenmusic.domain.ListeningStatsSummary;
import com.listenmusic.service.StaleListeningStatsException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class UserDataRepository {
    private static final String TRACK_COLUMNS = """
        t.track_id as id, t.title, t.artist, t.album, t.duration, t.source,
        t.file_path, t.url, t.cover_url, t.lyrics, t.lyrics_source, t.lyrics_format,
        t.cover_mime_type, t.created_at, t.updated_at, t.meta_source
        """;

    private final JdbcTemplate jdbcTemplate;

    public UserDataRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Track> findFavorites(String profileId) {
        return jdbcTemplate.query("""
            select %s
            from favorites f
            join user_tracks t on t.profile_id = f.profile_id and t.track_id = f.track_id
            where f.profile_id = ?
            order by f.created_at desc
            """.formatted(TRACK_COLUMNS), this::mapTrack, profileId);
    }

    public void saveFavorite(String profileId, Track track) {
        saveTrack(profileId, track);
        jdbcTemplate.update("""
            insert into favorites(profile_id, track_id, created_at) values (?, ?, ?)
            on conflict(profile_id, track_id) do update set created_at = excluded.created_at
            """, profileId, track.id(), OffsetDateTime.now().toString());
    }

    public void removeFavorite(String profileId, String trackId) {
        jdbcTemplate.update(
            "delete from favorites where profile_id = ? and track_id = ?",
            profileId,
            trackId
        );
    }

    public List<Track> findHistory(String profileId) {
        return jdbcTemplate.query("""
            select %s
            from recent_tracks h
            join user_tracks t on t.profile_id = h.profile_id and t.track_id = h.track_id
            where h.profile_id = ?
            order by h.played_at desc
            limit 100
            """.formatted(TRACK_COLUMNS), this::mapTrack, profileId);
    }

    public void recordHistory(String profileId, Track track) {
        saveTrack(profileId, track);
        jdbcTemplate.update("""
            insert into recent_tracks(profile_id, track_id, played_at) values (?, ?, ?)
            on conflict(profile_id, track_id) do update set played_at = excluded.played_at
            """, profileId, track.id(), OffsetDateTime.now().toString());
        jdbcTemplate.update("""
            delete from recent_tracks
            where profile_id = ? and track_id not in (
              select track_id from recent_tracks where profile_id = ? order by played_at desc limit 100
            )
            """, profileId, profileId);
    }

    public List<Track> findQueue(String profileId) {
        return jdbcTemplate.query("""
            select %s
            from playback_queue q
            join user_tracks t on t.profile_id = q.profile_id and t.track_id = q.track_id
            where q.profile_id = ?
            order by q.position
            """.formatted(TRACK_COLUMNS), this::mapTrack, profileId);
    }

    public void replaceQueue(String profileId, List<Track> tracks) {
        jdbcTemplate.update("delete from playback_queue where profile_id = ?", profileId);
        for (int index = 0; index < tracks.size(); index++) {
            Track track = tracks.get(index);
            saveTrack(profileId, track);
            jdbcTemplate.update(
                "insert into playback_queue(profile_id, position, track_id) values (?, ?, ?)",
                profileId,
                index,
                track.id()
            );
        }
    }

    public Optional<Map<String, Object>> findPlaybackState(String profileId) {
        return jdbcTemplate.query("""
            select current_track_id, position_seconds, volume, play_mode
            from playback_state where profile_id = ?
            """, (rs, rowNum) -> {
                Map<String, Object> state = new LinkedHashMap<>();
                state.put("trackId", rs.getString("current_track_id"));
                state.put("positionSeconds", rs.getDouble("position_seconds"));
                state.put("volume", rs.getInt("volume"));
                state.put("playMode", rs.getString("play_mode"));
                return state;
            }, profileId).stream().findFirst();
    }

    public void savePlaybackState(String profileId, Map<String, Object> state) {
        jdbcTemplate.update("""
            insert into playback_state(
              profile_id, current_track_id, position_seconds, volume, play_mode, updated_at
            ) values (?, ?, ?, ?, ?, ?)
            on conflict(profile_id) do update set
              current_track_id = excluded.current_track_id,
              position_seconds = excluded.position_seconds,
              volume = excluded.volume,
              play_mode = excluded.play_mode,
              updated_at = excluded.updated_at
            """,
            profileId,
            state.get("trackId"),
            state.get("positionSeconds"),
            state.get("volume"),
            state.get("playMode"),
            OffsetDateTime.now().toString()
        );
    }

    public ListeningStats findListeningStats(String profileId) {
        ensureListeningStatsMeta(profileId);
        Map<String, ListeningStats.TrackStat> tracks = new LinkedHashMap<>();
        jdbcTemplate.query("""
            select s.track_id, s.play_count, s.listened_seconds, s.last_listened_at,
                   (select d.listen_date
                    from listening_track_day_stats d
                    where d.profile_id = s.profile_id and d.track_id = s.track_id
                    order by julianday(d.last_listened_at) desc
                    limit 1) as last_listened_date
            from listening_track_stats s
            where s.profile_id = ?
            """, result -> {
                String trackId = result.getString("track_id");
                tracks.put(trackId, new ListeningStats.TrackStat(
                    trackId,
                    result.getInt("play_count"),
                    result.getDouble("listened_seconds"),
                    result.getString("last_listened_at"),
                    result.getString("last_listened_date")
                ));
            }, profileId);

        Map<String, ListeningStats.DayStat> days = new LinkedHashMap<>();
        jdbcTemplate.query("""
            select listen_date, listened_seconds
            from listening_day_stats
            where profile_id = ?
            order by listen_date
            """, result -> {
                String date = result.getString("listen_date");
                days.put(date, new ListeningStats.DayStat(
                    date,
                    result.getDouble("listened_seconds")
                ));
            }, profileId);
        return new ListeningStats(currentListeningStatsRevision(profileId), tracks, days);
    }

    @Transactional
    public void mergeListeningStats(String profileId, ListeningStats stats) {
        ListeningStats safeStats = stats == null
            ? new ListeningStats(Map.of(), Map.of())
            : stats;
        ensureListeningStatsMeta(profileId);
        long currentRevision = currentListeningStatsRevision(profileId);
        if (safeStats.revision() != currentRevision) {
            throw new StaleListeningStatsException(safeStats.revision(), currentRevision);
        }
        ListeningStats current = findListeningStats(profileId);

        safeStats.tracks().forEach((key, stat) -> {
            if (stat == null) {
                return;
            }
            String trackId = nonBlank(stat.trackId(), key);
            if (trackId == null) {
                return;
            }
            String lastListenedAt = nonBlank(stat.lastListenedAt(), OffsetDateTime.now().toString());
            ListeningStats.TrackStat existing = current.tracks().get(trackId);
            int playCount = Math.max(0, stat.playCount());
            double listenedSeconds = finiteNonNegative(stat.listenedSeconds());
            int playDelta = Math.max(0, playCount - (existing == null ? 0 : existing.playCount()));
            double secondsDelta = Math.max(0, listenedSeconds - (existing == null ? 0 : existing.listenedSeconds()));
            String listenDate = normalizeListeningDate(stat.lastListenedDate(), lastListenedAt);
            if (playDelta > 0 || secondsDelta > 0) {
                jdbcTemplate.update("""
                    insert into listening_track_day_stats(
                      profile_id, track_id, listen_date, play_count, listened_seconds, last_listened_at
                    ) values (?, ?, ?, ?, ?, ?)
                    on conflict(profile_id, track_id, listen_date) do update set
                      play_count = listening_track_day_stats.play_count + excluded.play_count,
                      listened_seconds = listening_track_day_stats.listened_seconds + excluded.listened_seconds,
                      last_listened_at = case
                        when coalesce(julianday(excluded.last_listened_at), 0)
                          >= coalesce(julianday(listening_track_day_stats.last_listened_at), 0)
                        then excluded.last_listened_at
                        else listening_track_day_stats.last_listened_at
                      end
                    """, profileId, trackId, listenDate, playDelta, secondsDelta, lastListenedAt);
                if (secondsDelta > 0) {
                    jdbcTemplate.update("""
                        insert into listening_day_stats(profile_id, listen_date, listened_seconds)
                        values (?, ?, ?)
                        on conflict(profile_id, listen_date) do update set
                          listened_seconds = listening_day_stats.listened_seconds + excluded.listened_seconds
                        """, profileId, listenDate, secondsDelta);
                }
            }
            jdbcTemplate.update("""
                insert into listening_track_stats(
                  profile_id, track_id, play_count, listened_seconds, last_listened_at
                ) values (?, ?, ?, ?, ?)
                on conflict(profile_id, track_id) do update set
                  play_count = max(listening_track_stats.play_count, excluded.play_count),
                  listened_seconds = max(listening_track_stats.listened_seconds, excluded.listened_seconds),
                  last_listened_at = case
                    when coalesce(julianday(excluded.last_listened_at), 0)
                      >= coalesce(julianday(listening_track_stats.last_listened_at), 0)
                    then excluded.last_listened_at
                    else listening_track_stats.last_listened_at
                  end
                """,
                profileId,
                trackId,
                playCount,
                listenedSeconds,
                lastListenedAt
            );
        });
        safeStats.days().forEach((key, stat) -> {
            if (stat == null) {
                return;
            }
            String date = nonBlank(stat.date(), key);
            if (date == null) {
                return;
            }
            jdbcTemplate.update("""
                insert into listening_day_stats(profile_id, listen_date, listened_seconds)
                values (?, ?, ?)
                on conflict(profile_id, listen_date) do update set
                  listened_seconds = max(listening_day_stats.listened_seconds, excluded.listened_seconds)
                """, profileId, date, finiteNonNegative(stat.listenedSeconds()));
        });
    }

    public ListeningStatsSummary summarizeListeningStats(String profileId, LocalDate from, LocalDate to) {
        ListeningStats stats = findListeningStats(profileId);
        List<Integer> years = jdbcTemplate.query("""
            select distinct cast(substr(listen_date, 1, 4) as integer) as year
            from listening_day_stats where profile_id = ? order by year desc
            """, (rs, rowNum) -> rs.getInt("year"), profileId);
        List<String> months = jdbcTemplate.query("""
            select distinct substr(listen_date, 1, 7) as month
            from listening_day_stats where profile_id = ? order by month desc
            """, (rs, rowNum) -> rs.getString("month"), profileId);
        int trackCount = stats.tracks().size();
        int activeDays = stats.days().size();
        double totalSeconds = stats.days().values().stream()
            .mapToDouble(ListeningStats.DayStat::listenedSeconds)
            .sum();
        if (from == null || to == null) {
            return new ListeningStatsSummary(
                stats.revision(), trackCount, activeDays, totalSeconds, years, months,
                trackCount, activeDays, totalSeconds
            );
        }
        String fromDate = from.toString();
        String toDate = to.toString();
        int rangeTrackCount = jdbcTemplate.queryForObject("""
            select count(distinct track_id) from listening_track_day_stats
            where profile_id = ? and listen_date between ? and ?
            """, Integer.class, profileId, fromDate, toDate);
        Map<String, Object> range = jdbcTemplate.queryForMap("""
            select count(*) as active_days, coalesce(sum(listened_seconds), 0) as listened_seconds
            from listening_day_stats where profile_id = ? and listen_date between ? and ?
            """, profileId, fromDate, toDate);
        return new ListeningStatsSummary(
            stats.revision(), trackCount, activeDays, totalSeconds, years, months,
            rangeTrackCount,
            ((Number) range.get("active_days")).intValue(),
            ((Number) range.get("listened_seconds")).doubleValue()
        );
    }

    @Transactional
    public ListeningStats deleteListeningStats(String profileId, LocalDate from, LocalDate to) {
        ensureListeningStatsMeta(profileId);
        int deletedDetails = jdbcTemplate.update("""
            delete from listening_track_day_stats
            where profile_id = ? and listen_date between ? and ?
            """, profileId, from.toString(), to.toString());
        int deletedDays = jdbcTemplate.update("""
            delete from listening_day_stats
            where profile_id = ? and listen_date between ? and ?
            """, profileId, from.toString(), to.toString());
        if (deletedDetails == 0 && deletedDays == 0) {
            return findListeningStats(profileId);
        }
        rebuildListeningStats(profileId);
        incrementListeningStatsRevision(profileId);
        return findListeningStats(profileId);
    }

    @Transactional
    public ListeningStats deleteAllListeningStats(String profileId) {
        ensureListeningStatsMeta(profileId);
        long storedRows = jdbcTemplate.queryForObject("""
            select
              (select count(*) from listening_track_day_stats where profile_id = ?)
              + (select count(*) from listening_track_stats where profile_id = ?)
              + (select count(*) from listening_day_stats where profile_id = ?)
            """, Long.class, profileId, profileId, profileId);
        jdbcTemplate.update("delete from listening_track_day_stats where profile_id = ?", profileId);
        jdbcTemplate.update("delete from listening_track_stats where profile_id = ?", profileId);
        jdbcTemplate.update("delete from listening_day_stats where profile_id = ?", profileId);
        if (storedRows > 0) {
            incrementListeningStatsRevision(profileId);
        }
        return findListeningStats(profileId);
    }

    private void rebuildListeningStats(String profileId) {
        jdbcTemplate.update("delete from listening_track_stats where profile_id = ?", profileId);
        jdbcTemplate.update("""
            insert into listening_track_stats(
              profile_id, track_id, play_count, listened_seconds, last_listened_at
            )
            select profile_id, track_id, sum(play_count), sum(listened_seconds), max(last_listened_at)
            from listening_track_day_stats
            where profile_id = ?
            group by profile_id, track_id
            """, profileId);
        jdbcTemplate.update("""
            insert into listening_day_stats(profile_id, listen_date, listened_seconds)
            select profile_id, listen_date, sum(listened_seconds)
            from listening_track_day_stats
            where profile_id = ?
            group by profile_id, listen_date
            on conflict(profile_id, listen_date) do update set
              listened_seconds = excluded.listened_seconds
            """, profileId);
    }

    private void ensureListeningStatsMeta(String profileId) {
        jdbcTemplate.update("""
            insert into listening_stats_meta(profile_id, revision) values (?, 0)
            on conflict(profile_id) do nothing
            """, profileId);
    }

    private long currentListeningStatsRevision(String profileId) {
        return jdbcTemplate.queryForObject(
            "select revision from listening_stats_meta where profile_id = ?",
            Long.class,
            profileId
        );
    }

    private void incrementListeningStatsRevision(String profileId) {
        jdbcTemplate.update(
            "update listening_stats_meta set revision = revision + 1 where profile_id = ?",
            profileId
        );
    }

    private static String normalizeListeningDate(String preferred, String timestamp) {
        if (preferred != null && !preferred.isBlank()) {
            try {
                return LocalDate.parse(preferred.trim()).toString();
            } catch (DateTimeParseException ignored) {
                // Fall back to the timestamp for legacy clients.
            }
        }
        try {
            return OffsetDateTime.parse(timestamp)
                .atZoneSameInstant(ZoneId.systemDefault())
                .toLocalDate()
                .toString();
        } catch (DateTimeParseException ignored) {
            return LocalDate.now().toString();
        }
    }

    private static String nonBlank(String preferred, String fallback) {
        String value = preferred == null || preferred.isBlank() ? fallback : preferred;
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static double finiteNonNegative(double value) {
        return Double.isFinite(value) ? Math.max(0, value) : 0;
    }

    private void saveTrack(String profileId, Track track) {
        if (track == null || track.id() == null || track.id().isBlank()) {
            throw new IllegalArgumentException("歌曲 ID 不能为空");
        }
        String now = OffsetDateTime.now().toString();
        String title = track.title() == null || track.title().isBlank() ? "未知歌曲" : track.title();
        String source = track.source() == null || track.source().isBlank() ? "local" : track.source();
        jdbcTemplate.update("""
            insert into user_tracks(
              profile_id, track_id, title, artist, album, duration, source, file_path,
              url, cover_url, lyrics, lyrics_source, lyrics_format, cover_mime_type, created_at, updated_at,
              meta_source
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(profile_id, track_id) do update set
              title = excluded.title,
              artist = excluded.artist,
              album = excluded.album,
              duration = excluded.duration,
              source = excluded.source,
              file_path = coalesce(excluded.file_path, user_tracks.file_path),
              url = coalesce(excluded.url, user_tracks.url),
              cover_url = coalesce(excluded.cover_url, user_tracks.cover_url),
              lyrics = coalesce(excluded.lyrics, user_tracks.lyrics),
              lyrics_source = coalesce(excluded.lyrics_source, user_tracks.lyrics_source),
              lyrics_format = coalesce(excluded.lyrics_format, user_tracks.lyrics_format),
              cover_mime_type = coalesce(excluded.cover_mime_type, user_tracks.cover_mime_type),
              meta_source = coalesce(excluded.meta_source, user_tracks.meta_source),
              updated_at = excluded.updated_at
            """,
            profileId,
            track.id(),
            title,
            track.artist(),
            track.album(),
            track.duration(),
            source,
            track.filePath(),
            track.url(),
            track.coverUrl(),
            track.lyrics(),
            track.lyricsSource(),
            track.lyricsFormat(),
            track.coverMimeType(),
            track.createdAt() == null ? now : track.createdAt(),
            now,
            track.metaSource()
        );
    }

    private Track mapTrack(ResultSet rs, int rowNum) throws SQLException {
        return new Track(
            rs.getString("id"),
            rs.getString("title"),
            rs.getString("artist"),
            rs.getString("album"),
            rs.getObject("duration", Long.class),
            rs.getString("source"),
            rs.getString("file_path"),
            rs.getString("url"),
            rs.getString("cover_url"),
            rs.getString("lyrics"),
            rs.getString("lyrics_source"),
            rs.getString("lyrics_format"),
            rs.getString("cover_mime_type"),
            rs.getString("created_at"),
            rs.getString("updated_at"),
            rs.getString("meta_source")
        );
    }
}
