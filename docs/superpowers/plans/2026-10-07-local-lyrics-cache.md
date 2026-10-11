# Local Lyrics Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本地歌曲立即显示本地歌词，并将 QQ/网易云歌词匹配结果持久缓存，避免重复联网。

**Architecture:** 扩展 `LocalLyricsCache` 保存成功与未找到两种查询结果；`LocalLyricsMatchService` 默认先读缓存，手动重新匹配通过 `force=true` 绕过缓存。前端播放流程继续立即解析歌曲自带歌词，仅在完全没有歌词时显示加载占位，后台结果到达后再无缝升级为 QQ 逐字歌词。

**Tech Stack:** Spring Boot、Jackson 文件缓存、Vue 3、Node 契约测试、JUnit 5/Mockito

---

### Task 1: 持久化匹配结果

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/service/LocalLyricsCache.java`
- Modify: `backend/src/test/java/com/listenmusic/service/LocalLyricsCacheTest.java`

- [ ] 添加缓存命中记录类型，区分成功结果和未找到标记，并兼容旧版 `LyricData` 缓存。
- [ ] 先运行 `mvn -Dtest=LocalLyricsCacheTest test` 确认新增测试失败。
- [ ] 实现成功结果读取、未找到标记写入和旧缓存回退。
- [ ] 再次运行测试确认通过。

### Task 2: 匹配服务优先读取缓存

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/service/LocalLyricsMatchService.java`
- Modify: `backend/src/test/java/com/listenmusic/service/LocalLyricsMatchServiceTest.java`
- Modify: `backend/src/main/java/com/listenmusic/api/LibraryController.java`
- Modify: `backend/src/test/java/com/listenmusic/api/LibraryControllerTest.java`

- [ ] 添加测试：缓存成功时不调用平台、缓存未找到时不调用平台、`force=true` 时绕过缓存。
- [ ] 默认匹配顺序保持为本地歌词立即可用，QQ 优先，只有无本地歌词时才回退网易云。
- [ ] 匹配成功写成功缓存，两平台失败写未找到标记。
- [ ] 控制器增加 `force` 参数并运行相关 JUnit 测试。

### Task 3: 前端即时显示本地歌词

**Files:**
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/tests/player-ui-contract.test.cjs`

- [ ] 添加契约测试：自动匹配不强制刷新、手动按钮传入强制刷新、有本地歌词时不显示遮挡层。
- [ ] API 增加 `force` 查询参数；自动调用使用 `false`，手动重新匹配使用 `true`。
- [ ] 加载占位仅在当前歌曲完全没有歌词时出现，本地内嵌或同目录歌词始终立即显示。
- [ ] 运行播放器契约测试和 Vue SFC 编译检查。

### Task 4: 集成验证

**Files:**
- Verify: `backend/src/test/java/com/listenmusic/service/LocalLyricsCacheTest.java`
- Verify: `backend/src/test/java/com/listenmusic/service/LocalLyricsMatchServiceTest.java`
- Verify: `backend/src/test/java/com/listenmusic/api/LibraryControllerTest.java`
- Verify: `electron/tests/player-ui-contract.test.cjs`

- [ ] 运行上述定向测试。
- [ ] 运行 `git diff --check`，确认没有格式错误或无关文件改动。
