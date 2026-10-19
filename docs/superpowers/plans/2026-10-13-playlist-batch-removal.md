# Playlist Batch Removal Implementation Plan

> Execute inline with executing-plans. No commits, publishing, installers, or upload packages in this phase.

**Goal:** Enable safe local/aggregate batch removal and repair ordinary NetEase song removal.

**Architecture:** Reuse `runTrackBatch` for per-song asynchronous operations. A shared `PlaylistBatchControls.vue` provides selection controls and an application confirmation dialog; its parents own selection and persistence. Aggregate removal operates on complete merged groups.

**Tech Stack:** Vue 3, TypeScript, Lucide, Java/Spring, Node tests and Playwright with isolated fixtures.

## 1. Streaming Removal

- [x] Add provider tests for `/playlist/tracks?op=del&pid=900&tracks=123`, wrapped refusal, and read-back that still contains the removed ID.
- [x] Add controller tests requiring safe `PLAYLIST_TRACK_REMOVE_FAILED` responses and preserved login failure handling.
- [x] Run `mvn -o -Dtest=NetEaseProviderTest,AccountControllerTest test`; observe the wrong route and opaque exception failures.
- [x] Change only the removal route/parameters and unwrap `body` using the existing addition pattern. Add endpoint-scoped safe removal error handling.
- [x] Run those tests again, plus the shipped gateway tests.

## 2. Local and Aggregate Selection

- [x] Add a UI regression that expects a batch button in local and aggregate details; observe it missing.
- [x] Add an aggregate helper test that removes two selected group IDs, leaves the unselected group, and does not mutate the original playlist.
- [x] Implement `removeAggregateTrackGroups(playlist, groupIds)` with `Set` membership on `normalizeTrackIdentity(track)`.
- [x] Implement shared controls with `enabled`, `count`, `total`, `allSelected`, `busy`, `message`, and `playlistName` props; emit `toggle`, `selectAll`, and `remove` after app-dialog confirmation.
- [x] Local selection uses `trackOrderKey`; aggregate selection uses group IDs. Prune on filtering and reset on navigation. Do not play or reorder rows while selecting.
- [x] For custom local playlists, persist a proposed track map before replacing reactive state. For favorites, await each `removeFavorite` and retain unsuccessful records.
- [x] For aggregate groups, save the proposed collection before replacing reactive state. Return successful/failed group IDs to the component; failures retain checked rows.

## 3. Verification and Handoff

- [x] Preserve a first concrete failure message in `runTrackBatch` and test mixed success/failure and account changes.
- [x] Run local custom/favorite and aggregate UI flows covering filtered select-all, cancel, persistence, save refusal, retry, and merged sources.
- [x] Run streaming single/multiple removal, partial refusal and retry against isolated account fixtures.
- [x] Run type checks, production build, and an Electron smoke test of the resulting UI using isolated user data.
- [x] Prepare the IDEA root-terminal command `npm run dev`; no packaging until the user finishes acceptance and requests a beta upload.

## Verification Results (2026-10-13)

- Backend: 137 tests passed across NetEaseProviderTest, QqMusicProviderTest, AccountControllerTest and AccountCatalogServiceTest.
- Focused Node regression: 10 tests passed, including the shipped ordinary-song gateway with `op=del`.
- Browser: playlist-batch-removal.smoke.cjs and account-playlist-actions.smoke.cjs passed with isolated storage and API fixtures.
- Native Electron: playlist-batch-native.smoke.cjs passed, including keyboard selection, dialog focus/cancel, bulk removal and reload persistence. Screenshots inspected.
- Type checks, Electron production build and touched-file diff checks passed.
- Built the backend JAR and copied it into the existing local development runtime; source and staged JAR SHA256 match: `36ff3072f105719d57d8f0b45bbe50cad7a36216bac272168cfad5ff1f3a527c`. Runtime validation passed.
- No real account writes, original audio deletion, installer/upload generation, GitHub changes or website edits in this phase.

For IDEA acceptance, stop the previously running desktop/development services first, then run `npm run dev` in `G:\倾听音乐`. The launcher can reuse already running protected services, so a stale backend must not remain running. Real-account verification is left to the user; automated account cases use isolated fixtures.
