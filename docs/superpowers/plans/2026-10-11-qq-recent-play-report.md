# QQ Cloud Recent Playback Reporting Implementation Plan

> Execute inline with the executing-plans and test-driven-development workflows. Keep the dirty workspace intact; no commits or unrelated rewrites.

**Goal:** Record a newly qualifying QQ playback in official cloud recent history, once, with verified read-back.

**Architecture:** Existing media/wall-clock sampling produces a UUID-bound one-shot report. Java checks account ownership; the QQ gateway resolves numeric identity, submits the official RPC once, and confirms a fresh cloud row. Only the confirmed snapshot updates the account-scoped UI/cache.

**Tech Stack:** Vue/TypeScript, Spring/Java 21, Koa/TypeScript, Vitest, JUnit, Node test runner.

## Task 1: QQ Gateway

- [x] Add `tests/unit/services/apis/user/reportRecentPlay.test.ts` with actual expected RPC `ReportPlayRecentlyInfo`, `data: [{id: '11', type: 2, lastTime: now, listenCnt: 1}]`. Test one write for concurrent duplicate UUIDs, rejected/malformed writes, private-login failures and missing/stale cloud confirmation.
- [x] Run `npm test -- tests/unit/services/apis/user/reportRecentPlay.test.ts`; observe RED before adding the service.
- [x] Add `src/services/apis/user/reportRecentPlay.ts`, strict controller, barrel exports and POST metadata. Use original credential, terminal attempt caching and bounded read-only verification. Validate source IDs, UUID, 30-second threshold and duration before network requests.
- [x] Run the new tests plus existing recent-delete/favorite/session tests; require GREEN.

## Task 2: Java Account Boundary

- [x] Add regressions to `QqMusicProviderTest`, `AccountCatalogServiceTest` and `AccountControllerTest`: confirmed snapshot mapping; request payload/cookie; account mismatch; short playback; rejected/unconfirmed gateway response without retry; HTTP 502 error message.
- [x] Run focused Maven tests; observe RED.
- [x] Add `MusicProvider.reportAccountRecentTrack`, QQ override, account-service validation, QQ-only POST request/response and `RecentPlayReportException` mapping. Keep NetEase DTO and scrobble behavior unchanged.
- [x] Run focused Maven tests, then `mvn -q package`; require GREEN.

## Task 3: Playback and Cache

- [x] Extend `tests/qq-listening-session.test.cjs`: no report before 30 seconds; one UUID/report after threshold; pause/seek wall time excluded; failed report never reopens; local-stat retry remains independent.
- [x] Add scoped-cache/UI integration tests for the new API and actual audio-event flow. Observe RED before implementing.
- [x] Extend `qqListeningSession.ts` with UUID/status and `beginQqRecentPlayReport`. Add the dedicated API payload/result and one-shot App handler. Cache/display only returned confirmed tracks for the captured account; show errors once.
- [x] Run new tests, `node scripts/verify.cjs frontend`, Electron typecheck and production build; require GREEN.

## Task 4: Protocol Validation and Delivery

- [x] Document the route and privacy/threshold/error contract. Run QQ build/full tests/lint/docs build. Two pre-existing Windows symlink-permission failures are documented.
- [x] Use only a newly observed 30-second real playback for a guarded live report/read-back; no historical or fabricated playback. Preserve all current favorites/history.
- [x] Stage rebuilt backend and QQ dist; build the NSIS installer and run packaged-assets smoke. Record hashes and any live-validation/environment limitations in a validation document.
- [x] Prepare the final handoff distinguishing implementation/tests from actual cloud synchronization evidence.

Delivery evidence: `docs/qq-recent-play-validation-2026-10-11.md`. Browser regressions additionally prove that login-panel opening and local-stat deletion preserve one cloud playback session, and small native seeks reset sampling.
