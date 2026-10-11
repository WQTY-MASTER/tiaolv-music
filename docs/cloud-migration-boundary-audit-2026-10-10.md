# 本地与云端接口归属核对

日期：2026-10-10。

状态：历史核对记录。用户随后于 2026-10-10 取消独立应用账号和邀请码，
确定为本地优先、平台按需登录；当前决定见 `docs/local-first-product-scope.md`。
下文的原云端目标、接口归属和迁移阶段仅记录当时的评估，不是当前实施计划，
也不是已实现的公网部署说明。第一阶段请求分类已保留，但实际请求仍走本机。

## 原评估目标（已停止实施）

服务器负责账号、推荐和 QQ/网易云平台接口；本地音乐由客户端管理。
用户拿到安装包后可以连接同一服务器，但不同用户的数据和平台登录状态必须隔离。
扫描、本地播放、队列、音量及本地设置不应依赖服务器在线或要求云端登录。

当时计划增加独立应用身份及平台绑定；该计划已取消。
当前平台登录保持本机独立存储，本地安装令牌继续只保护本机接口。

## 现有接口规模

核对 `backend/src/main/java/com/listenmusic/api` 下全部 8 个控制器，
按方法映射统计共 99 个接口，不把异常处理方法或控制器根映射计入。
以下分组覆盖全部控制器；分类表示目标归属，不表示现有代码已拆分。

| 控制器 | 数量 | 根路径 | 目标归属 |
| --- | ---: | --- | --- |
| LibraryController | 26 | `/library` | 本地；联网歌词匹配需拆分依赖 |
| PlaybackController | 7 | `/playback` | 本地 |
| CacheController | 4 | `/cache` | 客户端缓存设置；不得管理服务器目录 |
| AuthController | 10 | `/auth` | 云端平台账号绑定；不是调律应用用户登录 |
| AccountController | 29 | `/account` | 云端，必须按应用用户隔离 |
| CatalogController | 19 | `/catalog` | 云端；音频解析需适配播放器 |
| CloudController | 3 | `/account/{provider}/cloud/tracks` | 云端平台云盘；文件选择和读取仍在客户端 |
| HealthController | 1 | `/health` | 本地和云端分别报告健康状态 |

### 留在客户端

- `/library/tracks`、`/roots`、`/ignored`、`/select-directory`：本地索引、目录选择、移除及忽略记录。
- `/library/scan`、`/scan/incremental`、`/scan/all/incremental`：扫描和增量扫描。
- `/library/tracks/ignore`、`/metadata/reparse`：忽略歌曲及重新读取本地元数据。
- `/library/tracks/{id}/audio`、`/cover`、`/lyrics`：本地文件及本地歌词读取。
- `/library/playlists`、`/favorites`、`/history`、`/listening-stats`、`/listening-stats/summary`：
  当前设备的本地歌单、收藏、历史和统计，保留现有读写及清理行为。
- `/playback/play`、`/pause`、`/volume`、`/state`、`/queue`：当前设备播放状态和队列。
- `/cache`、`/cache/settings`、`/cache/default-directory`：用户设备上的缓存设置和清理。
- Electron IPC：目录/文件选择、背景、快捷键、托盘、迷你播放器、桌面歌词、系统媒体控制。

其中本地收藏或队列可能含在线歌曲引用，仍不因此自动变成云端同步数据。
本地文件路径、目录列表、音频字节、背景和封面选择不应随普通扫描上传。

### 迁到云端

- `/auth/{provider}/qr/start`、`/qr/status`：平台扫码绑定会话，创建和查询都属于当前应用用户。
- `/auth/current`、`/accounts`、`/{provider}/account`、`/{provider}/logout`：仅操作当前用户的平台绑定。
- `/auth/netease/sms/send`、`/sms/login`、`/password/login`、`/auth/qq/cookie`：
  现有平台绑定入口；云端是否继续开放这些敏感入口需在认证设计中确定。
- `/account/current`、`/{provider}/profile`、`/users/{userId}`、`/following`、`/followers`：平台资料及社交数据。
- `/account/{provider}/recommendations`、`/private-radar`、`/roaming`、`/featured-playlists`：个性推荐。
- `/account/{provider}/favorites`、`/recent-tracks`、`/listening-rank`、`/listening-scrobbles`：平台收藏与在线聆听记录。
- `/account/{provider}/listening-stats`、`/account/qq/listening-stats/accounts`、`/{accountId}`：
  调律收集的 QQ 在线聆听统计，不能仅依客户端提交的 QQ 账号 ID 授权。
- `/account/{provider}/playlists`、`/playlists/{id}`、`/tracks`、`/tracks/{trackId}`、`/order`、
  `/subscription`、`/artists/{artistId}/subscription`：平台歌单和关注管理。
- `/catalog/search`、`/cloudsearch`、`/provider`、`/homepage`、`/discovery`：在线检索与首页。
- `/catalog/playlist-categories`、`/playlists`、`/playlists/high-quality`、`/playlists/{id}`、`/play-count`：歌单浏览。
- `/catalog/tracks/{id}`、`/audio`、`/lyrics`、`/cover`：在线歌曲元数据和资源解析。
- `/catalog/daily-recommendations`、`/artist/detail`、`/top-songs`、`/songs`、`/albums`：每日推荐和歌手资料。
- `/account/{provider}/cloud/tracks`、`/{id}/lyrics`：平台云盘列表、用户明确选择的上传及歌词读取。

这里的简写后缀按对应控制器的真实映射组合；实施时以控制器源码为准。
平台账号 ID 与调律应用用户 ID 是两种不同身份，不能直接混用。

## 迁移前必须处理的现有依赖

| 证据位置 | 当前行为 | 云端风险或改动要求 |
| --- | --- | --- |
| `repository/AccountRepository.java` | `findActive(provider)` 没有应用用户条件；删除账号按 provider 操作 | 查询、更新、退出登录均需所有者条件，不能改动另一个用户 |
| `auth/NetEaseSessionStore.java` | 单个 `netease_cookie.json` 保存登录状态 | 不能共用；云端改为按用户持久化，不自动导入真实本地凭据 |
| `auth/NetEaseAuthService.java` | 启动时恢复单个会话，二维码只按 sessionId 查询 | 云端不能恢复一个全局登录人；二维码必须绑定创建用户 |
| `service/AccountCatalogService.java` | 根据平台寻找全局活跃账号，再读取凭据 | 调用链必须传递已验证的当前用户，不接受请求伪造所有者 |
| `provider/QqMusicProvider.java`、`NetEaseProvider.java` | 部分目录和资源请求隐式使用当前活跃凭据 | 普通搜索、音频、歌词等也需审计上下文，不能只改 account 控制器 |
| `service/QqListeningStatsService.java` | 接收账号 ID；汇总没有应用用户条件 | 所有读写/删除都需应用用户归属；在线统计重试需防重复累计 |
| `service/OnlineCatalogService.java`、`ProviderResourceCache.java` | 资源缓存键按 provider/resourceId，目录设置为全局 | 仅确认公开且内容一致的资源可共享；个人内容/授权相关结果按用户隔离 |
| `service/LibraryService.java`、`PlaybackService.java` | 本地资料使用固定 profile `local` | 留在设备，不把这套单机数据模型当成云端多用户模型 |
| `ListenMusicApplication.java` | 默认用户目录 SQLite，启动设为非 headless | 云端需独立数据目录和无桌面依赖启动，不能挂载开发者用户目录 |
| `renderer/src/services/api.ts` | 所有路由目前共用 loopback 地址和请求入口 | 拆分本地/云端请求，保留调用方取消、超时和缓存行为 |
| `preload/preload.ts` | 部分搜索直接请求本地 catalog，绕过 renderer 请求入口 | 同步梳理 preload，不只修改 renderer URL |
| `main/main.ts` | 上传、下载、封面读取自行请求后端 | 这些路径也需区分云端认证和本地令牌 |
| `main/backendAccess.ts`、`config/LocalAccessFilter.java` | 安装本地令牌只授权可信 loopback 请求 | 保留本地保护；云端采用独立用户认证，不共享或上传安装令牌 |
| `main/serviceRuntime.ts`、`scripts/stage-runtime.cjs` | 固定三服务及其打包资源 | 后续区分 standalone/cloud-client 模式，不能现在直接删除 API/Java 资源 |

表中 Java 路径相对 `backend/src/main/java/com/listenmusic`，Electron 路径相对 `electron/src`。
QQ worker 的 `src/config/user-info.ts` 存在全局 `user-info.json`；部分底层请求有全局凭据回退。
`src/util/cookieResolver.ts` 默认不回退全局 Cookie，扫码结果目前按请求返回会话。
不能因此认定整个 worker 已无状态：云端需逐条验证实际使用的控制器和刷新路径。

## 三个必须分别处理的跨边界流程

### 本地歌曲联网匹配歌词

`LocalLyricsMatchService` 同时读取本地曲目、查看 QQ 登录状态、调用在线检索、缓存歌词和写 sidecar。
本地读取/匹配评分/缓存/文件写入留在设备；云端只提供搜索及歌词。
发起匹配时只提交必要的标题、歌手或平台歌曲 ID，不发送完整文件路径、全库列表或音频。
离线或认证失败仍使用已有嵌入/同目录/缓存歌词，不影响本地播放。

### 在线音频解析与播放

当前 `/catalog/tracks/{id}/audio` 返回 302，播放器通过音频 URL 取流。
直接给 audio 元素改成云端地址并不等于完成用户认证，媒体请求不能依赖普通 fetch 的自定义头。
后续需独立设计播放器的鉴权解析入口，检查会员/版权错误、Range、跳转和凭据不泄露。
不把长期用户会话或平台 Cookie 放入播放 URL；不得默认把所有音频代理经过服务器。

### 主动上传平台云盘

文件选择和 `openAsBlob` 在 Electron 主进程；远程只接收用户明确选择上传的文件。
选择本地目录、扫描或播放不触发上传；上传需文件大小限制、当前用户授权和失败处理。
音频下载、封面获取及跳转也不能向第三方 CDN 附带调律会话或本地令牌。

## 方案比较

1. **建议：保留本地 Java 服务，逐步增加独立云端服务。**
   复用现有扫描和播放实现，先拆分请求与账号上下文；后续再缩小安装包。
   暂时仍需随客户端附带 Java，不能马上承诺轻量客户端。
2. **本地能力全部改为 Electron，在线能力独立云端。**
   最终可去掉客户端 Java，但需要重写扫描、元数据、数据库和恢复逻辑，当前改动范围大。
3. **每人独立一套现有后端/API 容器。**
   运行环境隔离较直观，但资源成本和运维复杂度随用户增加；仍需登录和路由隔离，
   不解决客户端本地文件访问，不建议作为默认共享服务架构。

## 原迁移验收计划（历史记录）

1. 本轮完成接口/数据归属核对，确认应用用户登录方式；不开放公网。
2. 小范围实现本地/云端请求边界，默认仍使用现有本地后端，验证没有回归。
3. 设计并实现独立应用身份、用户级平台绑定、数据库/二维码/缓存隔离，双用户同时验收。
4. 接通云端目录、推荐、音频解析和联网歌词，验证注销、账号切换、断网和本地离线播放。
5. 最后提供服务器部署配置和 cloud-client 包，完成 HTTPS、配额、限流和安装验收。

第 2 阶段的地址切换不构成公开服务器上线许可；第 3/4 阶段验收完成前不能分发公网客户端。
不迁移或覆盖现有本地数据库；旧的在线统计若需要导入，需单独确认用户和去重策略。
域名、服务器系统和部署密钥等到第 5 阶段再确认，不需要提前提供 SSH 密码或平台 Cookie。

## 当前登录方向

无需独立应用账号、邀请码或前置激活。QQ/网易云按需登录，凭据保存在本机。
第一阶段请求边界设计见
`docs/superpowers/specs/2026-10-10-cloud-client-request-boundary-design.md`。
路由分类不代表启用公网连接。以后是否增加公共在线服务，需要单独设计和验收。

## 核对范围与安全参考

本轮是源码静态核对，没有新增运行功能，也没有重新进行发布测试。
没有读取真实账号凭据、音乐库内容或提交上游登录请求。
云端鉴权设计应默认拒绝、逐请求检查权限、验证对象所有者，不能依靠难猜的账号 ID。
参考：[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。
