# 多模式音乐库与账号体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有本地扫描、歌词、队列和播放能力的前提下，为“调律音乐”建立本地模式、网易云流媒体模式、二维码登录、账号数据和聚合歌单的可运行基础，并为未来 QQ 音乐保留 Provider 边界。

**Architecture:** Electron/Vue 只负责界面和播放器，通过 `services/api.ts` 调用 Java 后端。Java 后端以统一 `MusicProvider` 处理公开内容，以独立的账号会话服务处理网易云二维码、Cookie 和用户数据；聚合歌单及本地播放状态始终属于调律音乐本地数据库，不随平台账号退出而删除。第一阶段先完成前端模式模型和网易云二维码会话，随后接入账号内容与聚合歌单。

**Tech Stack:** Vue 3、TypeScript、Electron、Spring Boot 3、Java 21、Spring JDBC、SQLite/Flyway、本地 NeteaseCloudMusicApi。

---

## 文件职责地图

- `electron/src/renderer/src/App.vue`：保留播放器编排和现有歌词逻辑，新增模式、账号、登录页和页面状态的协调，不把网易云请求直接放进组件。
- `electron/src/renderer/src/components/SidebarNav.vue`：只负责根据模式渲染导航和账号入口，通过事件通知父组件切换页面或打开登录。
- `electron/src/renderer/src/components/AuthPanel.vue`：独立承载二维码登录状态、二维码刷新、账号资料和退出操作。
- `electron/src/renderer/src/services/api.ts`：集中定义 Java 后端的模式、认证、账号内容和聚合歌单请求。
- `electron/src/renderer/src/services/appMode.ts`：定义模式和本地持久化读写，避免 `App.vue` 散落字符串判断。
- `electron/tests/mode-contract.test.cjs`：验证模式、导航和本地音乐入口契约。
- `electron/tests/auth-ui-contract.test.cjs`：验证二维码登录界面和轮询停止契约。
- `backend/src/main/java/com/listenmusic/auth/`：账号会话、二维码会话、凭据存储和账号资料服务。
- `backend/src/main/java/com/listenmusic/api/AuthController.java`：只暴露应用级认证接口，不把网易云 Cookie 返回给前端。
- `backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java`：保留公开内容能力；账号请求通过会话上下文附加 Cookie。
- `backend/src/main/java/com/listenmusic/repository/AccountRepository.java`：保存当前平台账号元数据和加密凭据引用。
- `backend/src/main/java/db/migration/V4__provider_accounts.java`：平台账号和二维码会话所需的数据库结构。
- `backend/src/main/java/com/listenmusic/aggregate/`：聚合歌单领域模型、仓储和服务。
- `backend/src/main/java/db/migration/V5__aggregate_playlists.java`：聚合歌单及歌曲顺序表。

## 实施边界

- 本阶段只实现 `netease` 账号；`qq` 只在 Provider 接口和数据字段中保留，不请求 QQ 上游。
- 前端永远不接收或保存网易云密码、Cookie 或原始登录凭据。
- 本地模式不是离线模式；模式切换不清空播放器、队列、最近播放或当前歌曲。
- 公开搜索和公开歌单继续允许未登录使用；每日推荐、个人收藏和私人歌单返回结构化登录要求。
- 受会员或版权限制的音频只显示平台返回的可播放状态，不生成伪造播放地址。

### Task 1: 建立前端模式与导航模型

**Files:**
- Create: `G:\倾听音乐\electron\src\renderer\src\services\appMode.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\components\SidebarNav.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\api.ts`
- Modify: `G:\倾听音乐\electron\tests\player-ui-contract.test.cjs`
- Create: `G:\倾听音乐\electron\tests\mode-contract.test.cjs`

- [ ] **Step 1: Write the failing mode contract test**

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const mode = fs.readFileSync(path.join(root, "src/renderer/src/services/appMode.ts"), "utf8");

assert.match(mode, /export type AppMode\s*=\s*"local"\s*\|\s*"streaming"/);
assert.match(mode, /readAppMode/);
assert.match(mode, /writeAppMode/);
assert.match(app, /appMode/);
assert.match(app, /toggleAppMode/);
assert.match(app, /本地模式/);
assert.match(app, /流媒体模式/);
assert.match(sidebar, /mode/);
assert.match(sidebar, /切换到流媒体模式/);
assert.match(sidebar, /切换到本地模式/);

console.log("应用模式契约通过");
```

- [ ] **Step 2: Run the contract and verify it fails because the model is absent**

Run: `node electron/tests/mode-contract.test.cjs`

Expected: FAIL with a missing `appMode.ts` or missing mode model assertion.

- [ ] **Step 3: Implement the smallest mode model**

Create `appMode.ts` with the exact public surface:

```ts
export type AppMode = "local" | "streaming";

const STORAGE_KEY = "listenmusic.app-mode";

export function readAppMode(storage: Pick<Storage, "getItem"> = window.localStorage): AppMode {
  return storage.getItem(STORAGE_KEY) === "streaming" ? "streaming" : "local";
}

export function writeAppMode(
  mode: AppMode,
  storage: Pick<Storage, "setItem"> = window.localStorage
) {
  storage.setItem(STORAGE_KEY, mode);
}
```

In `SidebarNav.vue`, accept `mode: AppMode`, emit `toggleMode`, rename the visible product name to `调律音乐`, show local navigation (`主页、所有歌曲、艺术家、专辑、流派、歌单、聚合歌单、文件夹、最近播放`) in local mode, and show streaming navigation (`主页、发现歌单、音乐库、音乐云盘、最近播放`) in streaming mode. The bottom button must emit the toggle event and use the exact opposite-mode label.

In `App.vue`, import `AppMode`, `readAppMode`, and `writeAppMode`; initialize `const appMode = ref<AppMode>(readAppMode())`; add `function toggleAppMode()` that switches the value, persists it, clears only page-specific search/selection state, and keeps `currentTrack`, `playbackQueue`, `isPlaying`, and `volume` unchanged. Pass `:mode="appMode"` and `@toggle-mode="toggleAppMode"` to `SidebarNav`.

- [ ] **Step 4: Run the focused contract and existing player contract**

Run: `node electron/tests/mode-contract.test.cjs`

Expected: `应用模式契约通过`.

Run: `node electron/tests/player-ui-contract.test.cjs`

Expected: `播放器交互契约通过`.

- [ ] **Step 5: Build the renderer**

Run: `npm --prefix electron run build`

Expected: Vite completes without TypeScript or Vue template errors.

### Task 2: 分离本地主页与流媒体主页

**Files:**
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\components\SidebarNav.vue`
- Modify: `G:\倾听音乐\electron\tests\mode-contract.test.cjs`

- [ ] **Step 1: Add failing rendering assertions**

Append these assertions to `mode-contract.test.cjs`:

```js
assert.match(app, /local-home-page/);
assert.match(app, /streaming-home-page/);
assert.match(app, /activeView === "library"/);
assert.match(app, /选择文件夹/);
assert.match(app, /扫描音乐/);
assert.match(app, /appMode === "local"/);
assert.match(app, /appMode === "streaming"/);
```

- [ ] **Step 2: Run the test and verify the page split assertions fail**

Run: `node electron/tests/mode-contract.test.cjs`

Expected: FAIL on the missing page marker or mode guard.

- [ ] **Step 3: Add explicit mode guards without changing player state**

Wrap the existing local toolbar and local-library empty state with `appMode === "local"`. Add two named sections in the main template:

```vue
<section v-if="appMode === 'local' && activeView === 'home' && !submittedKeyword" class="local-home-page">
  <!-- existing local summary, recent tracks, and aggregate-playlist entry -->
</section>
<section v-if="appMode === 'streaming' && activeView === 'home' && !submittedKeyword" class="streaming-home-page">
  <!-- existing public homepage content and account-aware daily recommendations -->
</section>
```

Only render the folder input, “选择文件夹”, and “扫描音乐” buttons when `appMode === "local" && activeView === "library"`. For a streaming-mode click on a local-only view, route to streaming home rather than showing local controls. Keep the bottom `PlayerBar` outside both sections.

- [ ] **Step 4: Run frontend tests and build**

Run: `npm --prefix electron test`

Expected: all existing contracts and `应用模式契约通过` pass.

Run: `npm --prefix electron run build`

Expected: build succeeds.

### Task 3: 增加后端平台账号与二维码会话数据结构

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\auth\ProviderAccount.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\auth\QrLoginSession.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\auth\CredentialStore.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\auth\EncryptedFileCredentialStore.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\repository\AccountRepository.java`
- Create: `G:\倾听音乐\backend\src\main\java\db\migration\V4__provider_accounts.java`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\auth\AccountRepositoryTest.java`
- Modify: `G:\倾听音乐\backend\src\test\java\com\listenmusic\repository\UserDataMigrationContractTest.java`

- [ ] **Step 1: Write a failing migration and repository test**

The test must migrate an in-memory SQLite database and assert that `provider_accounts` contains `provider`, `provider_user_id`, `nickname`, `avatar_url`, `credential_reference`, `active`, `created_at`, and `updated_at`, while `qr_login_sessions` contains `session_id`, `provider`, `qr_key`, `status`, `expires_at`, and `credential_reference`.

Use `JdbcTemplate` and assertions such as:

```java
assertThat(jdbcTemplate.queryForObject(
    "select count(*) from provider_accounts where provider = 'netease'", Integer.class
)).isEqualTo(0);
assertThat(jdbcTemplate.queryForObject(
    "select count(*) from qr_login_sessions", Integer.class
)).isEqualTo(0);
```

- [ ] **Step 2: Run the backend test and verify it fails before V4 exists**

Run: `mvn -q -f backend/pom.xml -Dtest=AccountRepositoryTest test`

Expected: FAIL because the V4 tables and repository do not exist.

- [ ] **Step 3: Add V4 and the repository contract**

Create the two tables with `text` IDs, a unique `(provider, provider_user_id)` key, one active account constraint enforced by service code, and indexes on `(provider, active)` and `(provider, expires_at)`. `AccountRepository` must expose:

```java
Optional<ProviderAccount> findActive(String provider);
void saveAccount(ProviderAccount account);
void deactivateProvider(String provider);
void saveQrSession(QrLoginSession session);
Optional<QrLoginSession> findQrSession(String sessionId);
void deleteExpiredQrSessions(OffsetDateTime now);
```

Store only a credential reference in the database. `CredentialStore` must expose `put(provider, secret)`, `get(reference)`, and `delete(reference)`. `EncryptedFileCredentialStore` must use AES-GCM with a per-installation key under the application data directory and never return the secret through a controller response.

- [ ] **Step 4: Run the focused backend test and the full backend suite**

Run: `mvn -q -f backend/pom.xml -Dtest=AccountRepositoryTest test`

Expected: PASS.

Run: `mvn -q -f backend/pom.xml test`

Expected: all existing backend tests pass.

### Task 4: 实现网易云二维码登录后端闭环

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\auth\NetEaseAuthService.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\api\AuthController.java`
- Modify: `G:\倾听音乐\backend\src\main\resources\application.yml`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\api\AuthControllerTest.java`
- Modify: `G:\倾听音乐\backend\src\test\java\com\listenmusic\provider\NetEaseProviderTest.java`

- [ ] **Step 1: Write controller tests for key/create/check and current session**

Mock the local NeteaseCloudMusicApi with `MockRestServiceServer` and assert:

1. `GET /auth/netease/qr/start` calls `/login/qr/key` and `/login/qr/create` with a numeric `timestamp`, returns `sessionId`, `qrimg` or `qrurl`, and never returns a cookie.
2. `GET /auth/netease/qr/status?sessionId=...` maps upstream codes `800`, `801`, `802`, `803` to `EXPIRED`, `WAITING`, `CONFIRMING`, `SUCCESS`.
3. On `803`, the service stores the cookie in `CredentialStore`, stores account metadata, and returns only `status`, `provider`, `userId`, `nickname`, and `avatarUrl`.
4. `POST /auth/netease/logout` deletes the credential reference and deactivates the account.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `mvn -q -f backend/pom.xml -Dtest=AuthControllerTest test`

Expected: FAIL because `/auth/netease/*` does not exist.

- [ ] **Step 3: Implement the upstream adapter with cache-safe timestamps**

Use the configured base URL and call:

```text
/login/qr/key?timestamp=<epoch-ms>
/login/qr/create?key=<key>&qrimg=true&timestamp=<epoch-ms>
/login/qr/check?key=<key>&timestamp=<epoch-ms>
/login/status?timestamp=<epoch-ms>
```

Do not poll more than once per request, do not call a login endpoint while an existing active account is valid, and stop treating a session as pollable after `EXPIRED` or `SUCCESS`. Enforce one active provider account by deactivating the current provider before saving a different provider account; the controller must reject a second active platform until logout with `409 ACCOUNT_ALREADY_ACTIVE`.

- [ ] **Step 4: Run controller, provider, and full backend tests**

Run: `mvn -q -f backend/pom.xml -Dtest=AuthControllerTest,NetEaseProviderTest test`

Expected: PASS.

Run: `mvn -q -f backend/pom.xml test`

Expected: PASS.

### Task 5: 添加登录页、轮询、会话恢复和退出 UI

**Files:**
- Create: `G:\倾听音乐\electron\src\renderer\src\components\AuthPanel.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\api.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\components\SidebarNav.vue`
- Create: `G:\倾听音乐\electron\tests\auth-ui-contract.test.cjs`

- [ ] **Step 1: Write the failing UI contract**

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const panel = fs.readFileSync(path.join(root, "src/renderer/src/components/AuthPanel.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

assert.match(panel, /qr\/start/);
assert.match(panel, /qr\/status/);
assert.match(panel, /800|EXPIRED/);
assert.match(panel, /801|WAITING/);
assert.match(panel, /802|CONFIRMING/);
assert.match(panel, /803|SUCCESS/);
assert.match(panel, /setInterval|setTimeout/);
assert.match(panel, /clearInterval|clearTimeout/);
assert.match(api, /startQrLogin/);
assert.match(api, /pollQrLogin/);
assert.match(api, /logoutProvider/);
assert.match(app, /AuthPanel/);
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node electron/tests/auth-ui-contract.test.cjs`

Expected: FAIL because `AuthPanel.vue` and auth API methods are absent.

- [ ] **Step 3: Implement the API and panel lifecycle**

Add typed API functions for `/auth/current`, `/auth/netease/qr/start`, `/auth/netease/qr/status`, `/auth/netease/account`, and `/auth/netease/logout`. `AuthPanel` must start one poll timer after a successful QR start, use a 3-second interval, clear it on unmount, success, expiration, retry, or closing the page, and display Chinese states `加载二维码、等待扫码、待确认、登录成功、二维码已过期、加载失败`. It may display `qrimg` or generate from `qrurl`, but must never expose a raw cookie in reactive state.

On success, update the parent account state and switch to streaming mode without changing the current playback queue. On logout, clear only account-dependent UI data; leave local tracks, aggregate playlists, queue, history, and playback state untouched.

- [ ] **Step 4: Run focused UI contracts and build**

Run: `node electron/tests/auth-ui-contract.test.cjs`

Expected: `认证界面契约通过`.

Run: `npm --prefix electron test && npm --prefix electron run build`

Expected: all tests and the renderer build pass.

### Task 6: 接入账号资料、每日推荐、云端收藏和用户歌单

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\api\AccountController.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\service\AccountCatalogService.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\provider\MusicProvider.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\provider\NetEaseProvider.java`
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\api.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\api\AccountControllerTest.java`

- [ ] **Step 1: Add failing account endpoint tests**

Cover `GET /account/current`, `GET /account/netease/recommendations`, `GET /account/netease/favorites`, `GET /account/netease/playlists`, `POST /account/netease/favorites`, and `DELETE /account/netease/favorites/{id}`. Assert that absent credentials return HTTP `401` with `{ "code": "LOGIN_REQUIRED" }`, and valid credentials pass a `Cookie` header only to the upstream mock.

- [ ] **Step 2: Run the test and verify it fails**

Run: `mvn -q -f backend/pom.xml -Dtest=AccountControllerTest test`

Expected: FAIL because account endpoints do not exist.

- [ ] **Step 3: Implement account-scoped Provider methods and controllers**

Extend `MusicProvider` with account methods returning domain DTOs, keep public methods usable without a session, and have `NetEaseProvider` use the credential store through a request-scoped account context. Map upstream `301` to `LOGIN_REQUIRED` and preserve the existing cache rules. Never log Cookie values.

In `App.vue`, load account data only after `/auth/current` reports an active account; show the daily recommendation block only in streaming mode and show a login action instead of fake data when logged out. Use the same `source`-prefixed track ID for account tracks.

- [ ] **Step 4: Run backend and frontend verification**

Run: `mvn -q -f backend/pom.xml test`

Expected: PASS.

Run: `npm --prefix electron test && npm --prefix electron run build`

Expected: PASS.

### Task 7: 建立聚合歌单及跨来源歌曲操作

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\aggregate\AggregatePlaylist.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\aggregate\AggregatePlaylistItem.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\aggregate\AggregatePlaylistRepository.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\api\AggregatePlaylistController.java`
- Create: `G:\倾听音乐\backend\src\main\java\db\migration\V5__aggregate_playlists.java`
- Modify: `G:\倾听音乐\electron\src\renderer\src\services\api.ts`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Modify: `G:\倾听音乐\electron\src\renderer\src\components\SidebarNav.vue`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\aggregate\AggregatePlaylistRepositoryTest.java`

- [ ] **Step 1: Write failing repository tests**

Test creating a playlist, inserting a local track and a `netease:123` track, listing items in ascending `position`, moving an item, and deleting the playlist. Assert that `deactivateProvider("netease")` does not delete either aggregate row.

- [ ] **Step 2: Run the test and verify it fails**

Run: `mvn -q -f backend/pom.xml -Dtest=AggregatePlaylistRepositoryTest test`

Expected: FAIL because V5 and the aggregate repository do not exist.

- [ ] **Step 3: Implement schema, API, and renderer actions**

Create `aggregate_playlists` and `aggregate_playlist_items` with a unique `(playlist_id, track_id)` key and explicit integer position. Add endpoints to list/create/delete playlists and add/remove/reorder items. Add an action menu to track rows and playlist details with `加入聚合歌单` and `新建聚合歌单`. Render aggregate playlists only in local mode, but pass each stored track's `source` to the existing playback path.

- [ ] **Step 4: Verify aggregate behavior and no regression**

Run: `mvn -q -f backend/pom.xml test && npm --prefix electron test && npm --prefix electron run build`

Expected: all suites pass.

### Task 8: 播放与退出规则、同步队列和 QQ Provider 扩展边界

**Files:**
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\sync\SyncOperation.java`
- Create: `G:\倾听音乐\backend\src\main\java\com\listenmusic\sync\SyncQueueService.java`
- Create: `G:\倾听音乐\backend\src\main\java\db\migration\V6__provider_sync_queue.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\provider\MusicProvider.java`
- Modify: `G:\倾听音乐\backend\src\main\java\com\listenmusic\service\OnlineCatalogService.java`
- Modify: `G:\倾听音乐\electron\src\renderer\src\App.vue`
- Create: `G:\倾听音乐\backend\src\test\java\com\listenmusic\sync\SyncQueueServiceTest.java`

- [ ] **Step 1: Write failing sync and source-routing tests**

Assert that a failed favorite mutation creates one ordered queue row containing `provider`, `provider_user_id`, `operation`, and `source_track_id`; a retry removes it only after success; logout removes that provider's queue but leaves aggregate rows. Assert that `netease:1` routes to NetEaseProvider and `qq:1` routes to a future `QqMusicProvider` slot without changing local playback routing.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `mvn -q -f backend/pom.xml -Dtest=SyncQueueServiceTest test`

Expected: FAIL because V6 and the source-routing extension are absent.

- [ ] **Step 3: Implement ordered sync and explicit future QQ boundary**

Add V6 with a retry count, last error, and `created_at`; process operations in creation order; map network failures to retained queue rows; clear only the active provider's rows on logout. Keep the current NetEase provider fully functional. Add a `QqMusicProvider` interface-compatible placeholder that throws a clear `PROVIDER_NOT_CONFIGURED` error and is disabled by default; do not call a public QQ service or claim QQ functionality is implemented.

Update playback error mapping so unavailable member/版权 resources stop at the platform-provided boundary and show a clear message while preserving the full catalogue duration in the progress bar.

- [ ] **Step 4: Run the complete verification set**

Run: `mvn -q -f backend/pom.xml test`

Expected: PASS.

Run: `npm --prefix electron test && npm --prefix electron run build`

Expected: PASS.

Run manually with Java backend, local NeteaseCloudMusicApi, and Vite renderer:

```powershell
java -jar backend\target\listenmusic-backend-0.1.0.jar
npm run web:dev
```

Expected: local mode scans and plays local files, public search still works, QR login has no cookie leak in the renderer network/state, switching modes preserves the queue, and logging out preserves aggregate playlists.

## 自检清单

- [ ] 每个新增行为都有先失败后通过的自动化测试。
- [ ] 前端没有直接请求 `127.0.0.1:3000` 的代码。
- [ ] 二维码三类请求都带时间戳，登录成功或过期后停止轮询。
- [ ] 同一时间最多一个 active 平台账号。
- [ ] 退出平台只清理凭据、云端缓存和同步队列，不清理聚合歌单、本地曲库、队列、历史或播放状态。
- [ ] `local`、`netease`、`qq` 歌曲 ID 不使用裸数字互相覆盖。
- [ ] 本地模式仍可播放聚合歌单里的在线歌曲。
- [ ] 每日推荐未登录时不伪造内容，并返回登录入口。
- [ ] 既有本地扫描、歌词逐字高亮、试听边界、拖动进度条和播放状态恢复测试全部通过。

