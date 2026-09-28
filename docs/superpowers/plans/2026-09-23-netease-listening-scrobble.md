# 网易云听歌打卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 网易云歌曲在本项目内累计有效播放满 30 秒后，通过后端安全上报一次听歌打卡。

**Architecture:** 前端用纯 TypeScript 状态机累计连续媒体时间，达到门槛后调用 Spring 账号接口。Spring 从现有凭据存储取 Cookie，经 `MusicProvider` 能力委托给 `NetEaseProvider` 请求 `/scrobble/v1`，渲染进程不接触 Cookie。

**Tech Stack:** Vue 3、TypeScript、Spring Boot 3、Java 21、RestClient、Node assert、JUnit 5、MockRestServiceServer

---

### Task 1: 有效播放状态机

**Files:**
- Create: `electron/src/renderer/src/services/listeningScrobble.ts`
- Create: `electron/tests/listening-scrobble.test.cjs`
- Modify: `electron/package.json`

- [ ] **Step 1: 写失败测试**

测试 `createScrobbleSession`、`sampleScrobblePlayback` 和 `beginScrobbleReport`：累计不足 30 秒不触发，达到 30 秒仅触发一次，倒退或大于 6 秒的跳变不累计，重建会话后可再次触发。

- [ ] **Step 2: 验证红灯**

Run: `node tests/listening-scrobble.test.cjs`
Expected: FAIL because `services/listeningScrobble.ts` does not exist.

- [ ] **Step 3: 实现最小状态机**

导出以下稳定接口：

```ts
export interface ListeningScrobbleSession {
  sessionId: number;
  trackId: string;
  listenedSeconds: number;
  lastMediaTime?: number;
  status: "tracking" | "reporting" | "reported" | "failed";
}

export function createScrobbleSession(sessionId: number, trackId: string): ListeningScrobbleSession;
export function sampleScrobblePlayback(session: ListeningScrobbleSession, mediaTime: number): ListeningScrobbleSession;
export function beginScrobbleReport(session: ListeningScrobbleSession): { session: ListeningScrobbleSession; shouldReport: boolean };
export function resetScrobbleSample(session: ListeningScrobbleSession): ListeningScrobbleSession;
```

门槛固定为 30 秒；仅接受 `0 <= delta <= 6` 的连续采样。

- [ ] **Step 4: 验证绿灯**

Run: `node tests/listening-scrobble.test.cjs`
Expected: PASS with one concise success line.

### Task 2: 后端账号代理与网易云上报

**Files:**
- Create: `backend/src/main/java/com/listenmusic/api/ListeningScrobbleRequest.java`
- Modify: `backend/src/main/java/com/listenmusic/api/AccountController.java`
- Modify: `backend/src/main/java/com/listenmusic/service/AccountCatalogService.java`
- Modify: `backend/src/main/java/com/listenmusic/provider/MusicProvider.java`
- Modify: `backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java`
- Modify: `backend/src/test/java/com/listenmusic/api/AccountControllerTest.java`
- Modify: `backend/src/test/java/com/listenmusic/provider/NetEaseProviderTest.java`

- [ ] **Step 1: 写两个聚焦的失败测试**

控制器测试 `POST /account/netease/listening-scrobbles` 将请求委托给 `AccountCatalogService`；provider 测试验证 `/scrobble/v1` 查询参数和 Cookie。

- [ ] **Step 2: 验证红灯**

Run: `./mvnw -Dtest=AccountControllerTest,NetEaseProviderTest test`
Expected: FAIL because endpoint and provider method do not exist.

- [ ] **Step 3: 增加请求模型与 provider 能力**

请求模型字段为 `trackId`、`title`、`artist`、`listenedSeconds`、`totalSeconds`。`MusicProvider` 增加：

```java
default void scrobble(
    String accountId,
    String trackId,
    String title,
    String artist,
    long listenedSeconds,
    long totalSeconds,
    String credential
) {
    throw new UnsupportedOperationException("该音乐源暂不支持听歌打卡");
}
```

控制器返回 `{ "ok": true }`。服务层要求 `trackId` 非空、`listenedSeconds >= 30`、`totalSeconds > 0`，并从账号上下文读取凭据。

- [ ] **Step 4: 实现网易云 `/scrobble/v1` 请求**

使用 GET 请求提交原始歌曲 ID、`time`、`total`、`name`、`artist`、`source=list`、`cookie` 和时间戳，并同时设置 Cookie 请求头。响应为空或 `code != 200` 时抛出已有风格的后端异常。

- [ ] **Step 5: 验证绿灯**

Run: `./mvnw -Dtest=AccountControllerTest,NetEaseProviderTest test`
Expected: PASS.

### Task 3: 播放器接入

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/online-playback-contract.test.cjs`

- [ ] **Step 1: 写失败契约测试**

断言渲染 API 提供 `reportListeningScrobble`，`App.vue` 只对已登录网易云歌曲创建会话，在播放采样中累计并达到门槛后上报，暂停和拖动时仅重置采样点，单曲循环重新创建会话。

- [ ] **Step 2: 验证红灯**

Run: `node tests/online-playback-contract.test.cjs`
Expected: FAIL because scrobble integration is absent.

- [ ] **Step 3: 接入渲染 API 与播放器生命周期**

`reportListeningScrobble(provider, payload)` POST 到 `/account/{provider}/listening-scrobbles`。`App.vue` 在新曲成功播放时创建会话，在现有 `updateProgressFromAudio` 采样，在暂停、拖动和错误时清除采样点但保留累计值；达到门槛时先标记 reporting，再异步上报，成功或失败后按会话序号更新状态。

- [ ] **Step 4: 处理单曲循环**

`handleAudioEnded` 的 single 分支在将媒体时间重置为 0 前创建新的打卡会话，使下一轮播放可独立累计并上报。

- [ ] **Step 5: 验证定向测试与构建**

Run: `node tests/listening-scrobble.test.cjs && node tests/online-playback-contract.test.cjs`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `./mvnw -DskipTests package`
Expected: PASS.

### Task 4: 最终回归

- [ ] **Step 1: 运行后端完整测试**

Run: `./mvnw test`
Expected: PASS.

- [ ] **Step 2: 运行 Electron 完整测试**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: 检查变更质量**

Run: `git diff --check`
Expected: no whitespace errors. Existing LF/CRLF warnings are acceptable.

工作区已有未提交修改，本计划不创建 Git 提交，避免混入用户现有工作。
