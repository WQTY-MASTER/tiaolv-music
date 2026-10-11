# QQ Local Listening Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist QQ Music listening activity per QQ account, expose range-based rankings, and let users explicitly delete those local records from the cache settings page while preserving the existing NetEase cloud ranking and QQ cloud recent-play behavior.

**Architecture:** Add dedicated SQLite tables and a focused repository/service for QQ listening deltas, ranking queries, and account summaries. Route only QQ ranking traffic through this local service; all other providers keep using `MusicProvider.loadAccountListeningRank`. In the renderer, a small playback-session state machine accumulates continuous QQ playback time and posts bounded deltas, while the existing account pages render the selected range and the cache page owns destructive cleanup.

**Tech Stack:** Java 21, Spring Boot MVC/JDBC, Flyway Java migrations, SQLite, Vue 3 Composition API, TypeScript, Node test runner, JUnit 5/Mockito.

---

### Task 1: Persistent QQ listening data

**Files:**
- Create: `backend/src/main/java/db/migration/V11__qq_listening_rank.java`
- Create: `backend/src/main/java/com/listenmusic/domain/QqListeningRankEntry.java`
- Create: `backend/src/main/java/com/listenmusic/domain/QqListeningDataSummary.java`
- Create: `backend/src/main/java/com/listenmusic/repository/QqListeningStatsRepository.java`
- Test: `backend/src/test/java/com/listenmusic/repository/QqListeningStatsRepositoryTest.java`
- Modify: `backend/src/test/java/db/migration/MigrationSequenceTest.java`

- [x] **Step 1: Write repository and migration tests first**

  Cover account isolation, metadata upsert, delta accumulation, sort order, `week`/`7d`/`all`/custom bounds, range deletion, full account deletion, and migration version 11.

- [x] **Step 2: Run the focused tests and confirm RED**

  Run: `mvn -Dtest=QqListeningStatsRepositoryTest,MigrationSequenceTest test`

  Expected: compilation or assertion failure because V11 and the QQ repository do not exist.

- [x] **Step 3: Implement the schema and repository**

  Create `qq_listening_accounts(account_id, nickname, avatar_url, updated_at)`, `qq_listening_tracks(account_id, track_id, title, artist, album, duration, source, cover_url, updated_at)`, and `qq_listening_day_stats(account_id, track_id, listen_date, play_count, listened_seconds, last_listened_at)`. Use account-scoped primary keys, transactional upserts, inclusive date predicates, and aggregate ordering by seconds, count, and last time.

- [x] **Step 4: Run the focused tests and confirm GREEN**

  Run: `mvn -Dtest=QqListeningStatsRepositoryTest,MigrationSequenceTest test`

  Expected: all selected tests pass.

### Task 2: QQ-only backend API and validation

**Files:**
- Create: `backend/src/main/java/com/listenmusic/api/QqListeningDeltaRequest.java`
- Create: `backend/src/main/java/com/listenmusic/service/QqListeningStatsService.java`
- Create: `backend/src/test/java/com/listenmusic/service/QqListeningStatsServiceTest.java`
- Modify: `backend/src/main/java/com/listenmusic/api/AccountController.java`
- Modify: `backend/src/main/java/com/listenmusic/service/AccountCatalogService.java`
- Modify: `backend/src/test/java/com/listenmusic/api/AccountControllerTest.java`
- Modify: `backend/src/test/java/com/listenmusic/service/AccountCatalogServiceTest.java`

- [x] **Step 1: Write service and controller tests first**

  Require an active QQ account for writes and ranking reads; reject non-QQ IDs, non-finite/negative seconds, deltas above 60 seconds, and play-count deltas outside 0/1. Verify QQ accepts `period=week|7d|all|custom`, custom dates must be complete and ordered, NetEase still calls the provider method, summaries can be listed after logout, and deletion targets only the requested local QQ account/range.

- [x] **Step 2: Run the focused tests and confirm RED**

  Run: `mvn -Dtest=QqListeningStatsServiceTest,AccountCatalogServiceTest,AccountControllerTest test`

  Expected: compilation or route assertion failure because the new API is missing.

- [x] **Step 3: Implement service routing and endpoints**

  Add `POST /account/qq/listening-stats`, range-aware `GET /account/{provider}/listening-rank`, `GET /account/qq/listening-stats/accounts`, and `DELETE /account/qq/listening-stats/{accountId}` with optional inclusive `from`/`to`. QQ uses local storage scoped by the active `providerUserId`; NetEase keeps the existing provider call unchanged.

- [x] **Step 4: Run the focused tests and confirm GREEN**

  Run: `mvn -Dtest=QqListeningStatsServiceTest,AccountCatalogServiceTest,AccountControllerTest test`

  Expected: all selected tests pass.

### Task 3: Renderer API and playback-session accounting

**Files:**
- Create: `electron/src/renderer/src/services/qqListeningSession.ts`
- Create: `electron/tests/qq-listening-session.test.cjs`
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/tests/page-api-cache.test.cjs`

- [x] **Step 1: Write state-machine and API tests first**

  Verify continuous playback accumulates elapsed wall-clock seconds, seeks add nothing, 30 accumulated seconds emits exactly one play-count increment, 15-second flushes emit bounded deltas, failures retain pending data, and API cache keys include ranking range without account-wide invalidation on each write.

- [x] **Step 2: Run the focused tests and confirm RED**

  Run: `node --test tests/qq-listening-session.test.cjs tests/page-api-cache.test.cjs`

  Expected: module or assertion failure because the session and API methods do not exist.

- [x] **Step 3: Implement the session and API bindings**

  Export typed calls for ranking ranges, delta writes, summary listing, and deletion. The session exposes start/resume/tick/pause/finish and acknowledge/fail semantics so network errors cannot discard unsubmitted time.

- [x] **Step 4: Run the focused tests and confirm GREEN**

  Run: `node --test tests/qq-listening-session.test.cjs tests/page-api-cache.test.cjs`

  Expected: all selected tests pass.

### Task 4: Player integration and QQ ranking ranges

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/StreamingLibraryPage.vue`
- Create: `electron/tests/qq-listening-ranking-contract.test.cjs`
- Modify: `electron/tests/streaming-library-page-contract.test.cjs`

- [x] **Step 1: Write UI contract tests first**

  Require QQ-only range controls (`本周`, `最近 7 天`, `全部`, `自定义`), validated custom dates, week data on the overview card, playback hooks for play/pause/time updates/track changes/account changes/shutdown, and unchanged NetEase rank calls.

- [x] **Step 2: Run the focused tests and confirm RED**

  Run: `node --test tests/qq-listening-ranking-contract.test.cjs tests/streaming-library-page-contract.test.cjs`

  Expected: assertion failure because controls and hooks are missing.

- [x] **Step 3: Integrate recording and range loading**

  Bind a QQ session to the QQ account ID and current `qq:` track, flush about every 15 seconds plus pause/change/shutdown, retry failed writes, query week data for account overview, and force-refresh the selected range when the ranking page opens or its range changes. Keep visible stale results if a refresh fails.

- [x] **Step 4: Run the focused tests and confirm GREEN**

  Run: `node --test tests/qq-listening-ranking-contract.test.cjs tests/streaming-library-page-contract.test.cjs`

  Expected: all selected tests pass.

### Task 5: Cache-page ownership and explicit deletion

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/settings-page-contract.test.cjs`
- Modify: `electron/tests/cache-settings-contract.test.cjs`

- [x] **Step 1: Write cache-page tests first**

  Require a QQ account selector with local summary, range/all deletion controls, explicit confirmation, disabled invalid ranges, copy stating that QQ cloud recent plays are unaffected, refresh after success, and no optimistic removal on failure.

- [x] **Step 2: Run the focused tests and confirm RED**

  Run: `node --test tests/settings-page-contract.test.cjs tests/cache-settings-contract.test.cjs`

  Expected: assertion failure because QQ ranking cleanup is not present.

- [x] **Step 3: Implement the cache-page controls**

  Load summaries on entering cache settings, default to one account without merging accounts, allow inclusive custom-range or full deletion, use the existing confirmation dialog pattern, and invalidate/refresh only affected QQ ranking cache entries after successful deletion.

- [x] **Step 4: Run the focused tests and confirm GREEN**

  Run: `node --test tests/settings-page-contract.test.cjs tests/cache-settings-contract.test.cjs`

  Expected: all selected tests pass.

### Task 6: Regression and live verification

**Files:**
- Modify only files required by failures caused by this feature.

- [x] **Step 1: Run the full backend suite**

  Run: `mvn test`

  Expected: zero failures and zero errors.

  Result: the full run completed 246 tests with zero assertion failures and 16 Windows sandbox temporary-directory cleanup errors. The QQ repository, service, controller, and Spring-construction checks pass; the final focused backend run completed 33 tests with zero failures and zero errors.

- [ ] **Step 2: Run the full renderer suite and production build**

  Run: `pnpm test`

  Run: `pnpm build`

  Expected: both commands exit successfully.

  Result: the production build succeeds when written outside the locked `electron/out` directory. Relevant session, cache, ranking, library, and settings tests pass. The full renderer suite was not repeated after the user requested avoiding broad tests without a concrete failure.

- [x] **Step 3: Restart the Java backend once**

  Stop only the existing process listening on port 17890, then start the updated backend with the repository's normal command. Do not start a duplicate server.

  Result: the fixed backend starts successfully on port 17890 and validates schema version 11.

- [ ] **Step 4: Verify live behavior**

  Confirm the V11 migration applies, QQ week/all/custom endpoints return account-scoped local results, a bounded write changes only the active QQ account, deletion changes only the requested range, QQ recent tracks still come from the cloud endpoint, and NetEase listening rank still comes from its provider API.

  Result: read-only live checks confirm health and summary routes return 200, while account routes consistently return 401 in the isolated no-login runtime rather than 500. Live POST/DELETE checks were intentionally omitted to avoid changing user data; focused repository and controller tests cover account isolation, bounded writes, date-range deletion, QQ cloud recent-play routing, and unchanged NetEase provider routing.

- [x] **Step 5: Review the final diff**

  Check that no credential/cookie values or unrelated dirty-worktree changes are included and that no automatic deletion path exists for QQ ranking data.

  Result: no credential values were added, QQ ranking deletion is reachable only from the explicit cache-page action, and QQ recent-play data remains on its existing cloud route.
