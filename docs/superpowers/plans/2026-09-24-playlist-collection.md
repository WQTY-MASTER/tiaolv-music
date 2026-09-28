# Playlist Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-synchronized playlist collection for NetEase and QQ Music, expose collected playlists in the streaming library, and reserve “like” terminology for tracks.

**Architecture:** Extend the existing QQ API with one authenticated playlist-collection mutation instead of introducing another service. Normalize NetEase and QQ mutations behind the Java `MusicProvider` boundary, then let the Vue client refresh account playlists after each successful mutation so displayed state always comes from the provider account.

**Tech Stack:** TypeScript, Koa, Vitest, Java 21, Spring Boot, JUnit/Mockito, Vue 3, Electron Vite, Node contract tests.

---

### Task 1: QQ Music playlist collection mutation

**Files:**
- Create: `music-api/qq-music-api/src/services/apis/user/playlistSubscription.ts`
- Create: `music-api/qq-music-api/src/controllers/playlistSubscription.ts`
- Create: `music-api/qq-music-api/tests/unit/services/apis/user/playlistSubscription.test.ts`
- Modify: `music-api/qq-music-api/src/services/index.ts`
- Modify: `music-api/qq-music-api/src/controllers/index.ts`
- Modify: `music-api/qq-music-api/src/routes/api-metadata.ts`

- [ ] Write a failing service test asserting that subscribe maps to `optype=1`, unsubscribe maps to `optype=2`, the raw playlist ID is sent as `dissid`, and the supplied Cookie is forwarded.
- [ ] Run the focused Vitest test and confirm it fails because the service does not exist.
- [ ] Implement the authenticated request to `https://c.y.qq.com/folder/fcgi-bin/fcg_qm_order_diss.fcg` and a validated POST controller accepting `{ id, subscribed }`.
- [ ] Register and document `POST /user/setPlaylistSubscription` in the existing route metadata/controller registry.
- [ ] Run the focused test and QQ API type/build checks.

### Task 2: Unified Java backend contract

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/provider/MusicProvider.java`
- Modify: `backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java`
- Modify: `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`
- Modify: `backend/src/main/java/com/listenmusic/service/AccountCatalogService.java`
- Modify: `backend/src/main/java/com/listenmusic/api/AccountController.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/NetEaseProviderTest.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/QqMusicProviderTest.java`
- Modify: `backend/src/test/java/com/listenmusic/service/AccountCatalogServiceTest.java`
- Modify: `backend/src/test/java/com/listenmusic/api/AccountControllerTest.java`

- [ ] Add failing tests for `setPlaylistSubscription(accountId, playlistId, subscribed, credential)` on both providers.
- [ ] Add failing service/controller tests for `POST /account/{provider}/playlists/{id}/subscription?subscribed=true|false`.
- [ ] Implement the provider interface method, raw provider ID normalization, NetEase `/playlist/subscribe`, and QQ `/user/setPlaylistSubscription` calls.
- [ ] Implement service validation and the controller endpoint returning `{ subscribed }`.
- [ ] Run the focused Maven tests.

### Task 3: Vue account state and playlist detail action

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/StreamingDailyMixPage.vue`
- Create: `electron/tests/playlist-subscription-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] Add a failing contract test requiring a playlist collection API function, a styled collection action, own/virtual playlist exclusion, and account-playlist refresh after mutation.
- [ ] Add `setAccountPlaylistSubscription()` to the renderer API service.
- [ ] Derive selected-playlist collection state from `accountPlaylists`, and add a guarded mutation that reloads account playlists after success.
- [ ] Add an optional collection button to the shared streaming playlist detail hero; show “收藏” or “已收藏” and disable it while saving.
- [ ] Bind the action only for real remote playlists that are not created by the signed-in account or synthetic application lists.
- [ ] Run the focused renderer contract tests.

### Task 4: Track-like terminology and library display

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/src/renderer/src/components/StreamingLibraryPage.vue`
- Modify: `electron/src/renderer/src/components/StreamingDailyMixPage.vue`
- Modify: `electron/src/renderer/src/components/StreamingArtistDetailPage.vue`
- Modify: `electron/src/renderer/src/components/MiniPlayer.vue`
- Modify: `electron/src/renderer/src/components/PlayerControlButton.vue`
- Modify: `electron/tests/streaming-library-page-contract.test.cjs`
- Modify: `electron/tests/mini-player-queue-contract.test.cjs`

- [ ] Change contract expectations from song “collection” wording to “like” wording.
- [ ] Rename the streaming library badge/title and account favorites detail title to “我的喜欢 / 我喜欢的歌曲”.
- [ ] Replace visible single-track “收藏 / 取消收藏” labels and aria text with “喜欢 / 取消喜欢” while preserving existing favorite persistence APIs.
- [ ] Run the affected renderer tests.

### Task 5: End-to-end verification

**Files:**
- Verify only.

- [ ] Run QQ API focused tests and build/type checks.
- [ ] Run focused Maven tests for providers, service, and controller.
- [ ] Run Electron playlist, library, and global context-menu tests.
- [ ] Run `npm run build` in `electron`.
- [ ] Review `git diff --check` and confirm unrelated dirty-worktree changes were not reverted.
