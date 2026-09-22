package com.listenmusic.repository;

import com.listenmusic.domain.Playlist;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class PlaylistRepository {
    private final JdbcTemplate jdbcTemplate;

    public PlaylistRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Playlist> findAll() {
        return jdbcTemplate.query("""
            select id, name, source, created_at, updated_at
            from playlists
            order by name
            """, (rs, rowNum) -> new Playlist(
            rs.getString("id"),
            rs.getString("name"),
            rs.getString("source"),
            rs.getString("created_at"),
            rs.getString("updated_at")
        ));
    }
}
