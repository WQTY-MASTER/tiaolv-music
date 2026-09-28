package com.listenmusic.repository;

import com.listenmusic.domain.Track;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
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
