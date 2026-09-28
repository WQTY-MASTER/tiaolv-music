package com.listenmusic.repository;

import com.listenmusic.service.LocalPathKey;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Repository
public class LocalLibraryRepository {
    private final JdbcTemplate jdbcTemplate;

    public LocalLibraryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void addRoot(Path directory) {
        Path normalized = directory.toAbsolutePath().normalize();
        jdbcTemplate.update("""
            insert into local_library_roots(path_key, directory, created_at)
            values (?, ?, ?)
            on conflict(path_key) do update set directory = excluded.directory
            """, LocalPathKey.of(normalized), normalized.toString(), OffsetDateTime.now().toString());
    }

    public List<String> findRoots() {
        return jdbcTemplate.queryForList(
            "select directory from local_library_roots order by created_at, directory",
            String.class
        );
    }

    public Set<String> findIgnoredPathKeys() {
        return new LinkedHashSet<>(jdbcTemplate.queryForList(
            "select path_key from ignored_local_files order by created_at",
            String.class
        ));
    }

    public List<String> findIgnoredPaths() {
        return jdbcTemplate.queryForList(
            "select file_path from ignored_local_files order by created_at",
            String.class
        );
    }

    public void ignorePaths(Collection<String> paths) {
        if (paths == null || paths.isEmpty()) {
            return;
        }
        String now = OffsetDateTime.now().toString();
        for (String path : paths) {
            if (path == null || path.isBlank()) {
                continue;
            }
            Path normalized = Path.of(path).toAbsolutePath().normalize();
            jdbcTemplate.update("""
                insert into ignored_local_files(path_key, file_path, created_at)
                values (?, ?, ?)
                on conflict(path_key) do update set file_path = excluded.file_path
                """, LocalPathKey.of(normalized), normalized.toString(), now);
        }
    }

    public void clearIgnoredPaths() {
        jdbcTemplate.update("delete from ignored_local_files");
    }

    public void clearRoots() {
        jdbcTemplate.update("delete from local_library_roots");
    }
}
