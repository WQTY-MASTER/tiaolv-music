package com.listenmusic.repository;

import com.listenmusic.domain.Track;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class TrackRepository {
    private final JdbcTemplate jdbcTemplate;

    public TrackRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Track> findAll() {
        return jdbcTemplate.query("""
            select id, title, artist, album, duration, source, file_path, url, cover_url,
                   lyrics, lyrics_source, lyrics_format, cover_mime_type, created_at, updated_at,
                   meta_source
            from tracks
            order by title
            """, (rs, rowNum) -> new Track(
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
        ));
    }

    public List<Track> findLocalTracks() {
        return jdbcTemplate.query("""
            select id, title, artist, album, duration, source, file_path, url, cover_url,
                   lyrics, lyrics_source, lyrics_format, cover_mime_type, created_at, updated_at,
                   meta_source
            from tracks
            where source = 'local'
            order by title
            """, this::mapTrack);
    }

    public Optional<Track> findById(String id) {
        return jdbcTemplate.query("""
            select id, title, artist, album, duration, source, file_path, url, cover_url,
                   lyrics, lyrics_source, lyrics_format, cover_mime_type, created_at, updated_at,
                   meta_source
            from tracks
            where id = ?
            """, this::mapTrack, id).stream().findFirst();
    }

    public void upsert(Track track) {
        String now = OffsetDateTime.now().toString();
        jdbcTemplate.update("""
            insert into tracks (
              id, title, artist, album, duration, source, file_path, url, cover_url,
              lyrics, lyrics_source, lyrics_format, cover_mime_type, created_at, updated_at, meta_source
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              title = excluded.title,
              artist = excluded.artist,
              album = excluded.album,
              duration = excluded.duration,
              source = excluded.source,
              file_path = excluded.file_path,
              url = excluded.url,
              cover_url = excluded.cover_url,
              lyrics = excluded.lyrics,
              lyrics_source = excluded.lyrics_source,
              lyrics_format = excluded.lyrics_format,
              cover_mime_type = excluded.cover_mime_type,
              meta_source = excluded.meta_source,
              updated_at = excluded.updated_at
            """,
            track.id(),
            track.title(),
            track.artist(),
            track.album(),
            track.duration(),
            track.source(),
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

    public void removeLocalTracksNotIn(List<String> ids) {
        if (ids.isEmpty()) {
            jdbcTemplate.update("delete from tracks where source = 'local'");
            return;
        }
        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(", "));
        jdbcTemplate.update(
            "delete from tracks where source = 'local' and id not in (" + placeholders + ")",
            ids.toArray()
        );
    }

    public void removeLocalTracksByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        int batchSize = 500;
        for (int start = 0; start < ids.size(); start += batchSize) {
            List<String> batch = ids.subList(start, Math.min(start + batchSize, ids.size()));
            String placeholders = batch.stream().map(id -> "?").collect(Collectors.joining(", "));
            jdbcTemplate.update(
                "delete from tracks where source = 'local' and id in (" + placeholders + ")",
                batch.toArray()
            );
        }
    }

    public void clearLocalTracks() {
        jdbcTemplate.update("delete from tracks where source = 'local'");
    }

    private Track mapTrack(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
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
