# Reliability and Playlist Optimization Implementation Plan

> **For agentic workers:** Use test-driven-development with executing-plans or
> subagent-driven-development. Do not commit, publish, change version, or package.

**Goal:** Fix the five confirmed defects, speed up bulk online removal, manage
unused original covers safely, and extract the affected App.vue responsibilities.

**Architecture:** Preserve current persistence schemas and view coordination.
Move request lifecycle, local playlist snapshots, captured-account batch actions,
cover-reference collection, and serialized queue saving into focused modules.
Batch APIs expose verified per-track outcomes; cleanup operates on managed files
only with complete references and a 24-hour import grace period.

**Tech Stack:** Vue 3, Electron, TypeScript, Node tests, Spring Boot, JUnit,
isolated Playwright and Electron fixtures.

## Task 1: Verification and Request Lifecycle

Files: scripts/verify.cjs; electron/package.json;
electron/src/renderer/src/services/api.ts; electron/src/preload/preload.ts;
electron/src/shared/requestLifecycle.ts (new);
backend/src/main/java/com/listenmusic/config/LocalAccessConfiguration.java;
electron/tests/release-verification.test.cjs;
electron/tests/request-lifecycle.test.cjs (new).

- [x] Add a failing discovery test for `node --test tests/a.test.cjs tests/b.test.cjs`
  combined with repeated files carrying transform flags. Assert both files are
  discovered once, with all flags retained; reject shell commands and unsafe paths.
- [x] Add a stalled JSON-body test using a local stream response. Assert timeout
  and caller abort after headers reject the promise and clear every listener.
- [x] Extract a shared `requestJson(url, init, options)` lifecycle retaining its
  timer through body reads, typed HTTP error messages, and caller cancellation.
  Keep renderer and preload diagnostic reporting and absent-account semantics.
- [x] Support all validated test-file tokens after allowed Node flags, register
  recently added offline tests, and expose isolated browser acceptance separately.
- [x] Bound backend HTTP connect/read waits without changing token boundaries.
- [x] Run `node --experimental-transform-types --test tests/request-lifecycle.test.cjs
  tests/release-verification.test.cjs tests/page-api-cache.test.cjs` from electron;
  then `node scripts/verify.cjs frontend` and `node scripts/verify.cjs typecheck`.

Task 1: focused request/discovery/route tests 30/30, backend access tests 7/7,
typecheck and two isolated browser fixtures passed. Standard frontend discovery
works; two pre-existing UI static assertions will be aligned with current batch
and platform-confirmation behavior in Task 2. Spec and quality review approved.

## Task 2: Save-Before-Publish Playlist State

Files: electron/src/renderer/src/App.vue;
electron/src/renderer/src/services/localPlaylistPersistence.ts (new);
electron/src/renderer/src/services/aggregatePlaylists.ts;
electron/tests/local-playlist-persistence.test.cjs (new);
electron/tests/playlist-persistence.smoke.cjs (new).

- [x] Test failed local/aggregate create, add, rename, and reorder persistence;
  assert stored and visible snapshots remain unchanged and input stays available.
- [x] Define immutable snapshot-save helpers using existing storage keys and
  track snapshot fields; serialize/save before publishing reactive values.
- [x] Persist local favorites metadata under a new backward-compatible name key;
  keep favorites ID and song storage unchanged. Test reload and rejected saves.
- [x] Integrate helpers and error notices into App.vue without modifying unrelated
  account/song/queue fields. Extract this ownership out of the coordinator.
- [x] Run unit and isolated browser fixtures, including original source regressions
  `playlist-batch-removal.smoke.cjs` and account playlist actions.

Task 2: storage unit regressions and isolated persistence fixture passed, including
mini-player failure/retry, acknowledgement matching, timeout, and narrow-window
geometry. Standard frontend verification (111 explicit Electron test files and
script tests), typecheck, and diff whitespace checks passed. Spec and quality
reviews approved. Real Electron IPC remains part of the Task 6 native acceptance.

## Task 3: Captured-Account Chunked Addition

Execution grouping: Tasks 3-5 share the captured-account batch helper and the
frontend/backend result contract. Implement and review them as one account
batching unit, completing the addition defect first before removal optimization.
The approved requirements and delivery order remain unchanged.

Files: electron/src/renderer/src/services/accountPlaylistActions.ts;
electron/src/renderer/src/App.vue;
electron/src/renderer/src/services/streamingTrackManagement.ts;
electron/tests/account-playlist-actions.test.cjs;
electron/tests/account-playlist-actions.smoke.cjs.

- [x] Add failing tests for 101/205 IDs, deduplication, chunk failure, and an
  account/page change before the next chunk; successful IDs must not be retried.
- [x] Implement chunks of at most 100 with captured context, explicit progress,
  actual errors, and distinct succeeded/failed arrays. No automatic write retries.
- [x] Integrate with the existing target picker and preserve failed selections.
- [x] Run unit and both-provider isolated browser scenarios, including a partial
  failure and a retry that submits only failed songs.

## Task 4: Verified Backend Batch Removal

Files: backend/src/main/java/com/listenmusic/provider/MusicProvider.java;
backend/src/main/java/com/listenmusic/provider/PlaylistTrackBatchResult.java (new);
backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java;
backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java;
backend/src/main/java/com/listenmusic/service/AccountCatalogService.java;
backend/src/main/java/com/listenmusic/api/AccountController.java;
associated provider/controller/service JUnit tests.

- [x] Test a request of at most 100 distinct IDs and captured expected account ID;
  reject unauthorized playlists, stale accounts, mixed providers, and bad IDs.
- [x] NetEase: fetch ownership once, submit `op=del` with comma-separated IDs,
  read membership once, and return succeeded/failed plus safe per-ID reasons.
  Keep a failed readback distinct from verified success.
- [x] QQ: use the existing removal capability and bounded sequential writes;
  verify playlist ownership and return honest partial results. Keep single APIs.
- [x] Expose a batch-removal endpoint returning the explicit result instead of a
  single boolean; propagate safe platform errors through existing conventions.
- [x] Run `mvn.cmd -B test`; assert call counts are batch-level for NetEase, and
  operation credentials stay bound to the account at the start.

## Task 5: Batch Removal UI and Progress

Files: electron/src/renderer/src/services/api.ts;
electron/src/renderer/src/services/accountPlaylistActions.ts;
electron/src/renderer/src/components/StreamingDailyMixPage.vue;
electron/src/renderer/src/App.vue;
electron/tests/account-playlist-actions.smoke.cjs.

- [x] Test a multi-chunk removal, confirmation cancellation, progress, partial
  failure, retry, navigation, and account change without real platform calls.
- [x] Call batch removal in at most 100-item chunks; publish processed/total
  progress. Update rows and selection only for verified successes in current scope.
- [x] Keep failed rows selected and show safe reasons. Do not erase ordinary-playlist
  rows for a like/unlike operation or alter its fixed cover.
- [x] Run browser checks across both platforms and desktop/narrow viewports.

Tasks 3-5: independent backend offline suite passed 326/326 and both-provider
large-batch browser acceptance passed, including 205/101 tracks, failed-only
retry, progress, page/account changes, overlapping mutation cleanup, stale
reorder/toast prevention, keyboard-menu retirement, and normal reorder/cooldown.
Strict numeric batch status checks prevent malformed write/readback success;
legacy APIs remain compatible. Standard frontend (111 files and script checks),
typecheck, four isolated fixtures, and production build passed. Spec, incremental
spec, and quality reviews approved. Existing website and version are unchanged.

## Task 6: Original-Cover References and Cleanup

Files: electron/src/main/backgroundImageCache.ts;
electron/src/main/main.ts; electron/src/preload/preload.ts;
electron/src/renderer/src/env.d.ts;
electron/src/renderer/src/services/playlistCoverStorage.ts (new);
electron/src/renderer/src/App.vue;
electron/tests/background-image-cache.test.cjs;
electron/tests/playlist-cover-storage.test.cjs (new);
electron/tests/playlist-batch-native.smoke.cjs.

- [x] Test complete reference collection from persisted local/aggregate/custom
  metadata and active choices. Invalid structures refuse cleanup, not default empty.
- [x] Test statistics and pruning using referenced/unreferenced originals, a recent
  import, in-progress writes, missing references, links, and an unrelated user file.
- [x] Add managed-original statistics and unused cleanup retaining all referenced
  files and files younger than 24 hours, with serialized imports/cleanup.
- [x] Restrict new IPC to the trusted main window. Add a confirmed manual action
  and original-cover statistics to cache settings, independent of other caches.
- [x] Run unit tests and native fixture; assert retained images are byte-identical
  and load after cleanup/reload with the source image moved.

Task 6: focused cache/reference/IPC checks passed 16 with one Windows file-symlink
EPERM skip; junction and hardlink tests passed. Native Electron acceptance verified
backend-independent statistics, fresh references, safe pruning, retained exact
bytes and image decoding after source moves/cleanup/reload, actual mini request
acknowledgements, and main-frame ownership. A confirmed busy-dialog focus defect
was reproduced and fixed, with held-IPC Tab/Shift+Tab/Escape regression checks.
Latest frontend 113-file/script checks, typecheck, build and native fixture passed;
four isolated browser fixtures passed individually after one transition retry.
Settled desktop/narrow screenshots were inspected. Spec and quality approved.

## Task 7: Serialized Queue Persistence Extraction

Files: electron/src/renderer/src/services/playbackQueuePersistence.ts (new);
electron/src/renderer/src/App.vue;
electron/tests/playback-queue-persistence.test.cjs (new).

- [x] Test ordered snapshots, a failed write followed by a successful write,
  unchanged queue identity, and no blocked chain after failure.
- [x] Extract the current serialized queue-save chain into a focused service;
  leave audio selection, fade, lyrics, queue keys, and playback timing untouched.
- [x] Run queue/player/mini-window contracts and isolated queue regression checks.

Task 7: four FIFO/snapshot/identity/failure-recovery units and 13 focused player
contracts passed. The actual App wrapper passed isolated browser checks with a
held first request, failed first save, queued recovery, duplicate queue identities,
unchanged serialization and subsequent empty save. Spec and quality approved.

## Final Acceptance

- [x] Standard frontend verification and new offline tests pass.
- [x] Backend tests, type checking, and production build pass.
- [x] Isolated browser/native acceptance covers all five reproductions and new
  partial-failure/progress/cleanup behavior; inspect relevant screenshots.
- [x] Stage rebuilt backend runtime only if needed for `npm run dev` compatibility;
  verify source/runtime hashes and avoid installers or upload archives.

Backend development runtime staged after independent offline test/package runs
(326/326 each) and runtime resource validation. Source and staged JAR SHA-256:
`7A87336E8DD61991172A274CEED1AD728EC6117F1017EFB44EE4892C6DA6FB6F`.
No user-owned workspace Java process was running; no services were stopped.

Independent final verification on 2026-10-14: frontend 114 explicit test files
plus script tests; backend offline JUnit 326/326; all three TypeScript projects;
production compilation; the entire four-fixture isolated browser acceptance;
and native Electron development acceptance passed. The first sandboxed Maven
attempt could not use the Mockito attach pipe; only its verified owned test
process was stopped, then the audited offline suite passed outside the sandbox.
Fresh desktop/narrow screenshots were inspected, and the isolated native process
exited. Runtime validation and matching JAR hashes passed again. Version remains
0.1.6, website hashes and HEAD are unchanged; no installer, upload archive or Git
publication was produced. The Windows file-symlink EPERM skip remains documented
above; real platform writes were intentionally not exercised.

- [x] Review spec compliance before code quality, address all findings, then rerun
  affected tests. Inspect diff whitespace and verify no version/site/Git changes.

Final read-only integration review approved all seven tasks, including synchronous
account/page invalidation, old-request cleanup ownership, correlated mini-player
acknowledgements and unchanged queue serialization. No critical or important
integration findings remain. Diff whitespace checks passed.
