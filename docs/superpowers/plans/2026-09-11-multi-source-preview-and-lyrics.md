# Multi-Source Preview and Lyrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve NetEase, add a locally deployed QQ Music provider after its API contract is verified, and make lyrics and preview playback accurately represent the source data.

**Architecture:** Java remains the sole bridge from the Electron renderer to music providers. Provider-prefixed track IDs route search results, media URLs, lyrics, covers, and rights metadata to their source. The player distinguishes a song's catalogue duration from its currently playable duration so a legitimate preview is shown as a preview instead of being presented as a short full song.

**Tech Stack:** Electron, Vue 3, TypeScript, Spring Boot, Java 21, local Node music API services.

---

### Task 1: Preserve Pure Chinese Lyric Lines

**Files:**
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\lyricParser.ts`
- Test: `G:\倾听音乐\electron\tests\lyric-parser.test.cjs`

- [ ] Keep a Chinese line containing a word-space as one original lyric line.
- [ ] Retain inline translation handling only for an unambiguous foreign-language original followed by a Chinese translation.
- [ ] Run `node tests\lyric-parser.test.cjs` and verify pure Chinese lines have no translation while `Take me home 带我回家` remains bilingual.

### Task 2: Model Preview Playback Separately From Full Duration

**Files:**
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\playbackClock.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\components\PlayerBar.vue`
- Test: `G:\倾听音乐\electron\tests\lyric-sync.test.cjs`
- Test: `G:\倾听音乐\electron\tests\player-ui-contract.test.cjs`

- [ ] Keep the catalogue duration as the right-hand time label for a preview track.
- [ ] Clamp seeks to the media's actual allowed duration and render the remaining segment as locked.
- [ ] At the preview end, leave the playhead at the allowed endpoint and show the permission message instead of advancing the queue.
- [ ] Run the two tests and `vite build`.

### Task 3: Add QQ Music as a Local Provider

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\provider\QqMusicProvider.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\service\OnlineCatalogService.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\api\CatalogController.java`
- Modify: `G:\倾听音乐\backend\src\main\resources\application.yml`
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\api.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\provider\QqMusicProviderTest.java`

- [ ] Select only a GitHub QQ Music API that is locally deployable and documents search, track detail, audio URL, lyric/translation, cover, and legal account login behavior.
- [ ] Record the selected repository URL and endpoint mapping before implementation.
- [ ] Add the provider with a `qq` identifier and preserve `netease` IDs and local tracks.
- [ ] Add source selection for all, NetEase, and QQ search results.
- [ ] Verify each source's search, audio, lyric, cover, and rights data with provider tests and the full frontend build.
