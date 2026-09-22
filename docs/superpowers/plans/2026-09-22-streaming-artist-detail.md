# 流媒体歌手详情页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让搜索页歌手卡片可点击，并增加带热门歌曲、关注状态、Tab 和播放操作的歌手详情页。

**Architecture:** `StreamingSearchPage.vue` 只负责发出歌手选择事件；`App.vue` 持有详情页状态、请求生命周期、返回上下文和播放队列；`StreamingArtistDetailPage.vue` 负责详情页展示与用户操作；`api.ts` 增加类型化的歌手接口封装。

**Tech Stack:** Vue 3 Composition API, TypeScript, lucide-vue-next, Vite, Node contract tests。

---

### Task 1: 建立接口类型和契约测试

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Create: `electron/tests/streaming-artist-detail-contract.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write the failing contract test**

```js
assert.match(api, /artist\/detail/);
assert.match(api, /artist\/top\/song/);
assert.match(api, /artist\/songs/);
assert.match(api, /artist\/sublist/);
assert.match(api, /artist\/sub\?/);
assert.match(searchPage, /emit\('selectArtist'/);
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: FAIL because the artist API functions and search event do not exist.

- [ ] **Step 3: Add typed API functions**

Add `CatalogArtistDetail`, `CatalogArtistPage`, `loadCatalogArtistDetail`, `loadCatalogArtistTopSongs`, `loadCatalogArtistSongs`, `loadCatalogArtistSubscriptions`, and `toggleCatalogArtistSubscription` in `api.ts`. Each function must URL-encode the artist ID and use `/catalog/artist/...` paths.

- [ ] **Step 4: Add the test script entry and run the test**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: PASS after the API paths and exported functions exist.

### Task 2: Make search artist cards interactive

**Files:**
- Modify: `electron/src/renderer/src/components/StreamingSearchPage.vue`
- Modify: `electron/tests/streaming-artist-detail-contract.test.cjs`

- [ ] **Step 1: Add the failing event assertion**

```js
assert.match(searchPage, /class="streaming-search-artist"[\s\S]*@click="emit\('selectArtist', artist\)"/);
assert.match(searchPage, /role="button"/);
```

- [ ] **Step 2: Verify the assertion fails**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: FAIL because the card is currently a non-interactive `<article>`.

- [ ] **Step 3: Implement the click event**

Add `selectArtist: [artist: SearchArtist]` to `defineEmits`, change the artist result element to a keyboard-accessible button-like card, and emit the full artist object on click/Enter while preserving the existing image and statistics.

- [ ] **Step 4: Run the test**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: PASS.

### Task 3: Add the artist detail component

**Files:**
- Create: `electron/src/renderer/src/components/StreamingArtistDetailPage.vue`
- Modify: `electron/tests/streaming-artist-detail-contract.test.cjs`

- [ ] **Step 1: Add component contract assertions**

```js
assert.match(detailPage, /全部歌曲/);
assert.match(detailPage, /专辑/);
assert.match(detailPage, /创建的歌单/);
assert.match(detailPage, /播放全部/);
assert.match(detailPage, /随机播放/);
assert.match(detailPage, /toggleFollow/);
assert.match(detailPage, /emit\('back'\)/);
```

- [ ] **Step 2: Verify the assertions fail**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create a presentational component with props for artist metadata, songs, albums, playlists, active tab, loading/error state and follow state. Emit `back`, `tab-change`, `play-all`, `play-random`, `play-track`, `toggle-follow`, and `select-playlist`. Use a rounded hero, circular image, compact action buttons, pill tabs, and a responsive song table with cover, title, artist, album, duration and heart button.

- [ ] **Step 4: Run the contract test**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: PASS.

### Task 4: Connect detail state, requests and transitions in App.vue

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/streaming-artist-detail-contract.test.cjs`

- [ ] **Step 1: Add the failing App.vue assertions**

```js
assert.match(app, /selectedStreamingArtist/);
assert.match(app, /loadCatalogArtistTopSongs/);
assert.match(app, /StreamingArtistDetailPage/);
assert.match(app, /@select-artist="selectStreamingArtist"/);
```

- [ ] **Step 2: Verify the assertions fail**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: FAIL because App.vue has no online artist-detail state.

- [ ] **Step 3: Implement the parent integration**

Add selected artist state and request IDs, normalize returned tracks through `toTrack`, load detail/top songs/subscriptions on selection, load songs/albums/playlists when the Tab changes, and expose the component before the general search result branch. Keep `submittedKeyword`, `searchTab`, `searchPage`, and `keyword` intact while the detail page is open. Return to search by clearing only the selected artist. Use existing `playTrack`, queue helpers, toast and transition classes.

- [ ] **Step 4: Run tests and build**

Run: `node tests/streaming-artist-detail-contract.test.cjs`; `npm test`; `npm run build`

Expected: all contract tests and existing tests pass, and the production build completes.

### Task 5: Final verification

**Files:**
- Verify: `electron/src/renderer/src/components/StreamingArtistDetailPage.vue`
- Verify: `electron/src/renderer/src/App.vue`
- Verify: `electron/src/renderer/src/services/api.ts`

- [ ] **Step 1: Check the changed files and working tree**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; only the intended artist-detail files and test/docs changes are present.

- [ ] **Step 2: Run the focused test once more**

Run: `node tests/streaming-artist-detail-contract.test.cjs`

Expected: PASS with the artist detail contract message.
