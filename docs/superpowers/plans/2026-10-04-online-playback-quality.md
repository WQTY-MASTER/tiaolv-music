# Online Playback Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real, globally persisted NetEase and QQ Music quality selection to playback settings and the bottom player bar, with ordered backend fallback and read-only local file-format display.

**Architecture:** The renderer owns one persisted preference per provider and passes a semantic quality value to the catalog audio redirect URL. The backend validates the semantic value, performs provider-specific availability checks and ordered fallback, and redirects to the first playable media URL. Local and preferred-local playback bypass online quality resolution and expose only the file format.

**Tech Stack:** Vue 3 Composition API, TypeScript, Electron/Vite, Java 21, Spring Boot, JUnit 5, MockRestServiceServer, Node contract tests.

**Execution constraint:** Do not create commits or push to GitHub; the user explicitly requested uncommitted local development.

---

## File Map

- Create `backend/src/main/java/com/listenmusic/provider/PlaybackQuality.java`: semantic quality enum and parser shared by the catalog boundary and providers.
- Modify `backend/src/main/java/com/listenmusic/provider/MusicProvider.java`: quality-aware playback method with backward-compatible default.
- Modify `backend/src/main/java/com/listenmusic/service/OnlineCatalogService.java`: pass the requested quality to the selected provider.
- Modify `backend/src/main/java/com/listenmusic/api/CatalogController.java`: accept and validate `quality`, defaulting to `auto`.
- Modify `backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java`: `/check/music`, `/song/url/v1` fallback, and `/song/url/v1/302` transport backup.
- Modify `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`: `flac`, `320`, and `128` fallback.
- Modify backend provider/controller tests: prove parsing, fallback order, authentication boundaries, and route selection.
- Create `electron/src/renderer/src/services/playbackQuality.ts`: renderer types, option lists, persistence, source selection, and local format labels.
- Create `electron/tests/playback-quality.test.cjs`: executable tests for pure quality preference behavior.
- Create `electron/tests/playback-quality-contract.test.cjs`: UI/API wiring contract tests.
- Modify `electron/src/renderer/src/services/api.ts`: append the semantic quality query.
- Modify `electron/src/renderer/src/components/PlayerBar.vue`: replace placeholder HiFi action with the quality popover.
- Modify `electron/src/renderer/src/App.vue`: global refs, settings rows, shared player props, preferred-local display, and optional current-track reload.
- Modify `electron/package.json`: include the new tests in the normal Electron suite.

---

### Task 1: Define and Validate Semantic Playback Quality

**Files:**
- Create: `backend/src/main/java/com/listenmusic/provider/PlaybackQuality.java`
- Modify: `backend/src/main/java/com/listenmusic/provider/MusicProvider.java`
- Modify: `backend/src/main/java/com/listenmusic/service/OnlineCatalogService.java`
- Modify: `backend/src/main/java/com/listenmusic/api/CatalogController.java`
- Test: `backend/src/test/java/com/listenmusic/api/CatalogControllerTest.java`

- [ ] **Step 1: Write failing controller tests**

Add tests proving an omitted quality becomes `AUTO`, `quality=lossless` reaches the service as `LOSSLESS`, and an unknown quality returns HTTP 400. Mock or spy only the service boundary already used by the controller test.

```java
mockMvc.perform(get("/catalog/tracks/netease:1/audio").param("quality", "lossless"))
    .andExpect(status().isFound());
verify(onlineCatalogService).resolveAudioUrl("netease:1", PlaybackQuality.LOSSLESS);

mockMvc.perform(get("/catalog/tracks/netease:1/audio").param("quality", "studio"))
    .andExpect(status().isBadRequest());
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `mvn -Dtest=CatalogControllerTest test`

Expected: compilation or verification failure because `PlaybackQuality` and the quality-aware service method do not exist.

- [ ] **Step 3: Implement the semantic enum and boundary**

Create an enum with `AUTO`, `HIRES`, `LOSSLESS`, `EXHIGH`, `HIGH`, and `STANDARD`, plus a case-insensitive parser that maps blank input to `AUTO` and throws `IllegalArgumentException` for unknown values.

```java
public enum PlaybackQuality {
    AUTO, HIRES, LOSSLESS, EXHIGH, HIGH, STANDARD;

    public static PlaybackQuality parse(String value) {
        if (value == null || value.isBlank()) return AUTO;
        return Arrays.stream(values())
            .filter(candidate -> candidate.name().equalsIgnoreCase(value.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported playback quality: " + value));
    }
}
```

Add `resolveAudioUrl(String trackId, PlaybackQuality quality)` to `MusicProvider`; keep the old one-argument method as a default call using `AUTO` so unrelated providers remain source-compatible. Thread the enum through `OnlineCatalogService`, and map invalid query values to HTTP 400 in `CatalogController`.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `mvn -Dtest=CatalogControllerTest test`

Expected: PASS.

---

### Task 2: Implement NetEase Availability and Ordered Fallback

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/NetEaseProviderTest.java`

- [ ] **Step 1: Write failing provider tests**

Add focused MockRestServiceServer tests for:

- `/check/music?id=123` runs before URL resolution;
- `AUTO` requests `hires`, then `lossless`, then `exhigh`, then `standard` until a non-empty URL appears;
- `LOSSLESS` starts at `lossless` and never requests `hires`;
- `STANDARD` makes only one v1 request;
- a failed availability check returns empty without calling a URL endpoint;
- code 301/401/403 invalidates credentials and stops fallback;
- malformed or transport-failed v1 resolution uses `/song/url/v1/302` once;
- no request ever targets legacy `/song/url`.

Example ordered expectations:

```java
server.expect(requestTo("http://api.test/check/music?id=123"))
    .andRespond(withSuccess("{\"success\":true,\"message\":\"ok\"}", APPLICATION_JSON));
server.expect(requestTo("http://api.test/song/url/v1?id=123&level=hires"))
    .andRespond(withSuccess("{\"data\":[{\"url\":null}]}", APPLICATION_JSON));
server.expect(requestTo("http://api.test/song/url/v1?id=123&level=lossless"))
    .andRespond(withSuccess("{\"data\":[{\"url\":\"https://audio.test/song.flac\"}]}", APPLICATION_JSON));
```

- [ ] **Step 2: Run NetEase tests and verify RED**

Run: `mvn -Dtest=NetEaseProviderTest test`

Expected: failures showing the current provider skips `/check/music` and always requests `level=standard`.

- [ ] **Step 3: Implement minimal NetEase resolution**

Map semantic preferences to these ladders:

```java
AUTO     -> ["hires", "lossless", "exhigh", "standard"]
HIRES    -> ["hires", "lossless", "exhigh", "standard"]
LOSSLESS -> ["lossless", "exhigh", "standard"]
EXHIGH   -> ["exhigh", "standard"]
STANDARD -> ["standard"]
```

Reject `HIGH` for NetEase. Call `/check/music` once, then `/song/url/v1` for each ladder entry. Treat empty URLs as unavailable quality, but treat login status codes as authentication failures. Add a dedicated redirect-header resolver for `/song/url/v1/302`; invoke it only after an unexpected v1 transport/malformed-response failure, not after ordinary empty-resource exhaustion.

- [ ] **Step 4: Run NetEase tests and verify GREEN**

Run: `mvn -Dtest=NetEaseProviderTest test`

Expected: PASS with ordered mock expectations fully consumed.

---

### Task 3: Implement QQ Music Quality Fallback

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/QqMusicProviderTest.java`

- [ ] **Step 1: Write failing QQ provider tests**

Prove these request sequences:

```text
AUTO or LOSSLESS: quality=flac, quality=320, quality=128
HIGH:             quality=320, quality=128
STANDARD:         quality=128
```

The first non-empty URL wins. A playback-login error must throw immediately and must not deactivate the account, preserving current behavior. `HIRES` and `EXHIGH` must be rejected for QQ.

- [ ] **Step 2: Run QQ tests and verify RED**

Run: `mvn -Dtest=QqMusicProviderTest test`

Expected: failures because the provider currently always requests `quality=128`.

- [ ] **Step 3: Implement the fallback loop**

Extract one method that requests a single native QQ quality and parses the existing response shape. Iterate the provider-specific ladder and return the first URL. Keep the existing login-error detection before continuing to a lower quality.

- [ ] **Step 4: Run QQ tests and verify GREEN**

Run: `mvn -Dtest=QqMusicProviderTest test`

Expected: PASS.

- [ ] **Step 5: Run all backend tests**

Run: `mvn test`

Expected: BUILD SUCCESS with no regression in catalog, account, playlist, cloud, or local-library behavior.

---

### Task 4: Add Renderer Quality State and Persistence

**Files:**
- Create: `electron/src/renderer/src/services/playbackQuality.ts`
- Create: `electron/tests/playback-quality.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: Write failing pure Node tests**

Test defaults, invalid persisted values, per-provider options, semantic query values, and local format display. Use an in-memory Storage-shaped object.

```js
assert.deepEqual(readPlaybackQualityPreferences(storage), {
  netease: "auto",
  qq: "auto",
  reloadCurrent: false
});
assert.equal(localPlaybackFormat({ filePath: "G:/Music/song.flac" }), "FLAC");
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node tests/playback-quality.test.cjs`

Expected: module-not-found failure for `playbackQuality.ts` or its compiled test adapter.

- [ ] **Step 3: Implement the pure quality module**

Export provider-specific types and stable option arrays:

```ts
export type NeteasePlaybackQuality = "auto" | "hires" | "lossless" | "exhigh" | "standard";
export type QqPlaybackQuality = "auto" | "lossless" | "high" | "standard";

export const NETEASE_QUALITY_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "hires", label: "Hi-Res" },
  { value: "lossless", label: "无损" },
  { value: "exhigh", label: "极高" },
  { value: "standard", label: "标准" }
] as const;
```

QQ options are Auto, Lossless, High, Standard. Add guarded localStorage readers/writers and `localPlaybackFormat`, preferring an explicit codec and falling back to the file extension or `本地音频`.

- [ ] **Step 4: Run the pure test and verify GREEN**

Run: `node tests/playback-quality.test.cjs`

Expected: PASS.

---

### Task 5: Pass Quality Through Online Playback and Support Reload

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Create: `electron/tests/playback-quality-contract.test.cjs`

- [ ] **Step 1: Write failing contract tests**

Assert that `loadCatalogAudio(id, quality)` appends `?quality=...`, online asset loading chooses the current provider preference, preferred-local playback records a local format, and immediate reload preserves current time and play/pause state without recording duplicate history.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node tests/playback-quality-contract.test.cjs`

Expected: failures because `loadCatalogAudio` has no quality parameter or shared state.

- [ ] **Step 3: Wire global refs and online URLs**

Read persisted preferences once into refs, watch them back to storage, and pass the appropriate semantic value to every NetEase/QQ `loadCatalogAudio` call. Do not reuse detail URLs that omit the query. When preferred-local matching wins, add a `playbackFormat` field derived from the selected local track.

- [ ] **Step 4: Implement optional current-track reload**

On a provider preference change, do nothing unless reload is enabled and the current track uses that provider without preferred-local playback. Preserve:

```ts
const resumeAt = audio.currentTime;
const shouldResume = !audio.paused;
```

Replace the catalog URL, call `load()`, restore `currentTime` after metadata is available, and resume only when `shouldResume` is true. If reload fails, restore the prior URL and state. Do not call the history-recording path.

- [ ] **Step 5: Run the contract and pure tests**

Run: `node tests/playback-quality.test.cjs && node tests/playback-quality-contract.test.cjs`

Expected: PASS.

---

### Task 6: Build the Settings and Player Quality UI

**Files:**
- Modify: `electron/src/renderer/src/components/PlayerBar.vue`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/playback-quality-contract.test.cjs`
- Modify: `electron/tests/player-ui-contract.test.cjs`

- [ ] **Step 1: Extend failing UI contract tests**

Assert the placeholder `HiFi 控制台` text and `hifi` event are absent; the player exposes an `音质` button, provider-specific options, an outside-click-closing popover, and a disabled local display. Assert playback settings contain both provider selectors and the reload toggle.

- [ ] **Step 2: Run UI contracts and verify RED**

Run: `node tests/playback-quality-contract.test.cjs && node tests/player-ui-contract.test.cjs`

Expected: failures against the existing placeholder button and missing settings rows.

- [ ] **Step 3: Implement the PlayerBar popover**

Replace the HiFi emit with a `qualityChange` emit. Add props for source mode, selected value, display label, and options. The icon button stays beside desktop lyrics, uses tooltip/ARIA label `音质`, and toggles a compact popover. Online options behave as radio choices; local mode shows `本地音频 · <FORMAT>` with no interactive options. Close on selection, outside click, and Escape.

- [ ] **Step 4: Add settings controls and shared bindings**

Add two select/menu rows and one switch to the playback settings card, using the same refs passed to `PlayerBar`. Copy states:

```text
网易云播放音质 — 自动按 Hi-Res、无损、极高和标准依次回退。
QQ 音乐播放音质 — 自动按无损、高清和标准依次回退。
切换音质后重载当前歌曲 — 关闭时从下一曲开始生效。
```

Keep the current settings visual language and avoid a nested card.

- [ ] **Step 5: Run UI contracts and verify GREEN**

Run: `node tests/playback-quality-contract.test.cjs && node tests/player-ui-contract.test.cjs`

Expected: PASS.

---

### Task 7: Full Verification and Desktop Visual Check

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run the complete backend suite**

Run: `mvn test` from `backend`.

Expected: BUILD SUCCESS.

- [ ] **Step 2: Run the complete Electron suite**

Run: `npm test` from `electron`.

Expected: all contract and behavior tests pass.

- [ ] **Step 3: Run renderer type checking and production build**

Run: `npx vue-tsc --noEmit -p src/renderer/tsconfig.json` and `npm run build` from `electron`.

Expected: zero type errors and successful main/preload/renderer output.

- [ ] **Step 4: Start the application and inspect both surfaces**

Run: `npm run dev` from `electron`. Open playback settings and the player quality popover for NetEase, QQ, and a local FLAC track. Verify no overlap at the app's normal desktop size, the menu closes correctly, local is read-only, and changing either online value immediately updates the other surface.

- [ ] **Step 5: Exercise real playback boundaries**

Verify one NetEase track at Auto, one forced lower level, one QQ track, and one local or preferred-local FLAC. Confirm the backend logs show `/check/music` plus `/song/url/v1` for NetEase, the selected `/getMusicPlay` quality for QQ, and no online quality request for local playback.

- [ ] **Step 6: Review the final diff without committing**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only intended quality files plus the user's pre-existing uncommitted work are present.
