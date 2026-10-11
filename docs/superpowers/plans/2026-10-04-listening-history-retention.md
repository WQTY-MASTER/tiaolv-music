# Listening History Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe month/year/all deletion of listening-footprint data from the renamed “缓存与数据” settings page.

**Architecture:** SQLite gains per-track-per-day detail plus a profile revision. Existing cumulative snapshots are converted into positive deltas on the backend; range deletion rebuilds aggregate tables from remaining detail and increments the revision so stale renderer snapshots cannot restore deleted history. The renderer adds revision-aware synchronization and a settings panel that previews and confirms destructive operations.

**Tech Stack:** Java 21, Spring Boot, JdbcTemplate, Flyway Java migrations, SQLite, Vue 3, TypeScript, Node contract tests.

---

### Task 1: Add dated listening detail and revision schema

**Files:**
- Create: `backend/src/main/java/db/migration/V10__listening_stats_retention.java`
- Modify: `backend/src/test/java/db/migration/MigrationSequenceTest.java`

- [ ] Write a migration test asserting `listening_track_day_stats` and `listening_stats_meta` exist after V10, and that V9 aggregate rows are backfilled to the local date derived from `last_listened_at`.
- [ ] Run `mvn -q -Dtest=MigrationSequenceTest test` and verify the new assertions fail.
- [ ] Implement V10 with composite primary keys, date/profile indexes, revision row initialization, and conservative legacy backfill.
- [ ] Run the migration test and verify it passes.

### Task 2: Implement revision-aware repository persistence and deletion

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/domain/ListeningStats.java`
- Modify: `backend/src/main/java/com/listenmusic/repository/UserDataRepository.java`
- Modify: `backend/src/test/java/com/listenmusic/repository/UserDataRepositoryListeningStatsTest.java`

- [ ] Add failing repository tests for positive-delta allocation by `lastListenedDate`, stale revision rejection, month deletion, year deletion, full deletion, and aggregate rebuilding.
- [ ] Run `mvn -q -Dtest=UserDataRepositoryListeningStatsTest test` and verify failures.
- [ ] Extend `ListeningStats` with `revision` and `lastListenedDate`; add summary/result records for deletion previews.
- [ ] Change repository saving to require the expected revision, allocate only positive cumulative differences into `listening_track_day_stats`, and preserve monotonic totals.
- [ ] Add transactional summary and deletion methods. Range deletion uses an inclusive date interval, rebuilds aggregate tables from detail, increments the revision, and returns the new snapshot.
- [ ] Run the focused repository tests and verify they pass.

### Task 3: Expose preview and deletion APIs

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/service/LibraryService.java`
- Modify: `backend/src/main/java/com/listenmusic/api/LibraryController.java`
- Modify: `backend/src/test/java/com/listenmusic/api/LibraryControllerTest.java`

- [ ] Add failing controller tests for range preview, inclusive range deletion, explicit `all=true`, missing confirmation, invalid dates, reversed dates, and stale revision conflict.
- [ ] Run `mvn -q -Dtest=LibraryControllerTest test` and verify failures.
- [ ] Add `GET /library/listening-stats/summary`, range `DELETE /library/listening-stats`, and explicit-all deletion with validated ISO dates.
- [ ] Return HTTP 409 for stale revisions and HTTP 400 for invalid destructive requests.
- [ ] Run focused controller tests and verify they pass.

### Task 4: Add revision-aware renderer statistics

**Files:**
- Modify: `electron/src/renderer/src/services/listeningStats.ts`
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/listening-stats.test.cjs`
- Modify: `electron/tests/persistence-contract.test.cjs`

- [ ] Add failing tests showing a newer server revision replaces local state, equal revisions merge monotonically, and play/listen updates retain `lastListenedDate`.
- [ ] Run `node tests/listening-stats.test.cjs` and verify failures.
- [ ] Extend renderer state with `revision`; implement revision-aware reconciliation and local date tracking.
- [ ] Send revision with saves. On HTTP 409, reload the server snapshot and replace local storage before accepting further saves.
- [ ] Add summary and deletion API client functions.
- [ ] Run focused renderer tests and verify they pass.

### Task 5: Build the “缓存与数据” listening-data controls

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/cache-settings-contract.test.cjs`
- Modify: `electron/tests/settings-page-contract.test.cjs`

- [ ] Add failing contract assertions for the renamed navigation item, listening summary, month/year/all segmented range control, date selectors, disabled empty state, and confirmation copy.
- [ ] Run `node tests/cache-settings-contract.test.cjs` and verify failures.
- [ ] Add the “聆听数据” settings section below cache controls using existing settings surfaces and controls.
- [ ] Load preview data when the section/range changes. Require confirmation before deletion and state that recent plays, playlists, local music, cache, and offline downloads are unaffected.
- [ ] After success, replace renderer/localStorage statistics with the returned revisioned snapshot so the home ranking and calendar update immediately.
- [ ] Run focused UI contract tests and verify they pass.

### Task 6: Verify migration, persistence, and the real UI

**Files:**
- Modify only if a verification failure requires a scoped fix.

- [ ] Run `mvn -q test` in `backend`.
- [ ] Run `npm test` and `npm run build` in `electron`.
- [ ] Restart the local backend so V10 is applied to the real database.
- [ ] Verify existing recovered listening data remains visible before deletion.
- [ ] Exercise a nonmatching range and confirm no data changes.
- [ ] Exercise a temporary test range, confirm preview counts match deletion results, and verify ranking/calendar refresh together.
- [ ] Run `git diff --check` and inspect the final diff without committing or pushing.
