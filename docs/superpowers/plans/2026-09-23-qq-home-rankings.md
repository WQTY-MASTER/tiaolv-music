# QQ Home Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real QQ Music Rising and Hot chart cards below the QQ daily recommendation preview, with playable rows and navigation into the existing playlist detail template.

**Architecture:** Reuse synthetic playlist IDs `qq:rank-62` and `qq:rank-26` through the existing catalog playlist endpoint. The QQ API normalizes rank songs into playable song records, the Java provider maps them to the existing `Track` model, and a focused Vue component renders the two QQ-only cards.

**Tech Stack:** TypeScript/Koa QQ API, Java 21/Spring Boot, Vue 3, lucide-vue-next, Node contract tests, JUnit 5.

---

### Task 1: Normalize QQ rank tracks

**Files:**
- Modify: `music-api/qq-music-api/src/util/song-normalize.ts`
- Modify: `music-api/qq-music-api/src/controllers/getRanks.ts`

- [ ] Add `song` to the recognized rank-list keys.
- [ ] Limit the returned list before resolving details so `limit=30` performs at most 30 lookups.
- [ ] Resolve numeric song IDs to full `track_info` records and merge MID, duration, album, singer, file and pay fields into each rank row.
- [ ] Run `npx tsc --noEmit`; expect exit code 0.

### Task 2: Expose rank playlists through the Java catalog

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/QqMusicProviderTest.java`

- [ ] Add failing provider tests for `qq:rank-62` and the `response/req_1/data/data/song` response shape.
- [ ] Detect `rank-<topId>` playlist IDs in public and account playlist loading.
- [ ] Call `/getRanks?topId=<id>&limit=30&resolveMid=true` and map returned rank rows through the existing `Track` model.
- [ ] Extend QQ track mapping for rank camelCase fields and fallback covers.
- [ ] Run `mvn "-Dtest=QqMusicProviderTest" test`; expect all targeted tests to pass.

### Task 3: Render QQ ranking cards and interactions

**Files:**
- Create: `electron/src/renderer/src/components/StreamingQqRankingCards.vue`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/streaming-home-contract.test.cjs`

- [ ] Add a failing contract assertion that the QQ-only home branch mounts `StreamingQqRankingCards` after the daily preview.
- [ ] Add independent loading state for `qq:rank-62` and `qq:rank-26` using `loadCatalogPlaylist`.
- [ ] Render two responsive cards with eyebrow, title, description, top-three tracks, retry state and “查看全部 30 首”.
- [ ] On row click, rotate that ranking queue from the selected track and start playback.
- [ ] On “查看全部”, create a synthetic QQ playlist and navigate through `selectPlaylist`, which reuses the current streaming playlist template.
- [ ] Keep the component behind `streamingSource === "qq"` and a logged-in account.
- [ ] Run `node tests/streaming-home-contract.test.cjs`; expect PASS.
- [ ] Run `npm run build`; expect a successful renderer build.

### Task 4: Live verification

**Files:**
- No additional files.

- [ ] Restart the QQ API on port `3300` and Java backend on port `17890`.
- [ ] Request `/catalog/playlists/qq%3Arank-62` and `/catalog/playlists/qq%3Arank-26`; expect playable QQ tracks with non-empty cover URLs.
- [ ] Confirm the QQ homepage receives both lists while the NetEase branch has no ranking component.
