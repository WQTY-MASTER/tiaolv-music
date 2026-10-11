# 倾听音乐交接文档（2026-10-07）

## 2026-10-08 统一页面数据缓存（优先于下文）

- Electron 渲染端新增会话内统一页面缓存 `pageDataCache.ts`：默认新鲜期 5 分钟、最多 100 项、LRU 淘汰；读取和写入都复制数据，避免页面修改缓存对象。缓存过期后先返回旧快照并在后台更新；同一请求并发时只发出一次网络调用；后台刷新失败会保留旧数据。
- `api.ts` 的安全 GET 页面请求统一接入缓存，覆盖首页、发现、搜索、音乐库、歌单详情、喜欢、关注/粉丝、最近播放、听歌排行、云盘、歌手及歌词等数据。健康检查、登录状态、缓存设置、播放状态和目录选择不缓存。`refresh=true` 会绕过并替换相同页面的普通快照。
- 缓存按平台和当前账号隔离；登录、启动恢复和账号重新校验时登记账号，退出仅清除对应账号。带 `provider` 查询参数的页面也纳入账号作用域，避免不同账号共用关注状态等结果。
- 成功的数据写操作会自动失效相关账号或本地页面缓存；播放进度、播放队列、听歌打卡、播放量及设置写入不会误清空页面缓存。云盘、流媒体音乐库、最近播放、每日推荐及歌单的手动刷新会先失效对应缓存。
- 缓存只在本次应用运行期间存在，不写入 localStorage、sessionStorage 或 IndexedDB；重启应用后重新加载。
- 新增 15 项缓存单元/接口/接入契约测试并纳入前端默认测试。前端完整测试通过，Electron 生产构建通过；因运行中的开发版占用 `electron/out`，构建输出到 `C:\Users\WQTY\.codex\visualizations\2026\10\07\01a11668-05e1-7570-ab7a-8f60ed87e395\electron-validation`。

## 2026-10-08 13:00 “我喜欢”数量与 QZone 目录（优先于下文）

- QQ 歌单摘要的 `song_cnt` 会把两首灰色“其他设备导入”歌曲计入，所以外层显示 4、详情只显示 2。`QqMusicProvider` 现在对 `dirid=201` 读取实际可见歌曲并用其数量和首曲封面生成“我喜欢”卡片，外层与详情一致。
- QQ 预置目录 `dirid=205`“QZone背景音乐”已与“本地上传”“默认列表”一并从音乐库隐藏。“我喜欢”仍正常显示且不可删除。
- 回归：`QqMusicProviderTest` 42/42 通过；Java 全量 233/233 通过。

## 2026-10-08 08:08 “我喜欢”排序 500 与预置目录隐藏（优先于下文）

- 用户拖动“我喜欢”时报 `Request failed: 500`。日志显示真实上游状态为 409；根因是 QQ 将两首灰色“其他设备导入”歌曲放在 `filtered_song`，前端只显示两首可播放歌曲，而排序服务此前要求前端提交包含灰色歌曲的完整顺序，因此每次都会判定快照不完整。
- `playlistTracks.ts` 现在区分可见歌曲与 `filtered_song`：只用可见歌曲校验前端旧顺序，写入 `SeqSonglist` 时把灰色歌曲及原始 `songType` 一并保留，写后分别校验可见顺序与灰色歌曲集合。其他设备新增、删除或调整可见歌曲仍会返回 409，不会覆盖并发变化。
- Java 新增排序冲突与频率限制异常映射：409/429 以 JSON `message` 返回前端，不再被 Spring 转成无说明的 500。
- QQ 预置目录 `dirid=206`“本地上传”和 `dirid=1`“默认列表”不再加入音乐库歌单列表。“我喜欢”仍显示且整张歌单不可删除。
- IntelliJ 的 `ListenMusicApplication` 运行配置已加入 `--enable-native-access=ALL-UNNAMED`，用于消除 OpenJDK 25 加载 SQLite 原生库的受限方法警告；这段警告本身不是本次 500 的原因。
- 真实验证：在用户当前“我喜欢”中交换两首可见歌曲，回读顺序一致；等待 4 秒后恢复原顺序并再次回读一致。灰色歌曲未删除，喜欢状态未改变。QQ API 已用新代码重启在 3300。
- 回归：QQ 排序测试 20/20 通过；QQ API 全量 631 项中 629 通过，仅原有 2 项 Windows 符号链接 EPERM；core/MCP 构建和 lint 通过。Java 全量 233/233 通过。

## 2026-10-08 00:00 歌曲排序与批量管理（优先于下文）

- “本地上传”（dirid 206）和“默认列表”（dirid 1）是 QQ 返回的预置目录，本项目继续禁止删除；这项保护是保守规则，不表示已尝试删除真实目录。“我喜欢”（dirid 201）整张歌单始终不可删除。
- QQ 歌单增加 `favorite` 元数据，前端不再用标题判断“我喜欢”。喜欢歌单提供批量取消喜欢；普通自建歌单提供批量添加喜欢和批量移出歌单。批量操作逐首执行，成功项取消选择，失败项保留；账号或页面切换后停止后续写入。
- 详情页支持长按约 450ms 后拖动，提前移动取消长按，释放不会误播放。只有默认顺序、无搜索、无批量选择且无写入时允许拖动；筛选状态的全选和批量提交只处理可见歌曲。
- 从自建歌单移出歌曲新增 `POST /user/removePlaylistTrack` 和 Java `DELETE /account/{provider}/playlists/{id}/tracks/{trackId}`。QQ API 服务端重新确认当前账号归属，从完整歌单取原始 `songId/songType`，调用 `DelSonglist`，随后回读确认已移出。系统目录、他人歌单或未知歌曲类型失败关闭。
- QQ 官方客户端协议模块确认排序接口为 `music.musicasset.PlaylistDetailWrite/SeqSonglist`，参数为 `dirId`、`tid`、完整 `v_songPair`。新增 `POST /user/reorderPlaylistTracks` 和 Java `POST /account/{provider}/playlists/{id}/order`。前端同时提交完整新顺序与打开页面时的旧顺序；后端写前回读避免覆盖其他设备变化，写后再次读取并完整比对，确认一致才返回成功，绝不以删除再添加模拟排序。
- 频率保护：账号内排序串行，完成后至少间隔 3 秒；上游 HTTP 403/429 保持原状态返回且不自动重试，进入至少 60 秒冷却。前端保存中及冷却中禁止再次拖动，并显示真实结果。
- 真实验证使用临时 QQ 歌单 9789937198：添加两首已有喜欢歌曲，`SeqSonglist` 交换顺序后回读完全一致；移出其中一首后回读只剩另一首；最后 `DelPlaylist` 成功清理。未改动已有歌单或喜欢状态。QQ API 已重启在 3300，新 Java 路由 OPTIONS 返回 POST；音乐库实时返回“我喜欢” `favorite=true/deletable=false`。
- 验证：QQ API 630 项中 628 通过，仅 2 项 Windows 符号链接 EPERM；lint、core/MCP 构建、文档构建通过。Java 全量 231 项通过（0 失败、0 错误）；此前沙箱内出现的 16 项错误均为 JUnit 无权清理 Windows 临时目录，改在沙箱外复跑后全部通过。前端完整测试和隔离输出构建通过；浏览器模拟验证长按、提前取消、不误播放、全选、部分失败、筛选可见提交和防重复写入均通过。

## 2026-10-07 23:06 测试、歌单与歌词续修（优先于下文）

- 用户要求不改变现有功能行为修复此前 21 项测试失败；现已完成，仅调整这些接口的测试：`api.test.ts` 每项重置模拟队列，消除 14 项连锁失败；其余 7 项对齐当前逐字歌词优先请求顺序、歌单 `disslist` 字段及电台推荐响应。保留正文、重试 songID、分页参数、空列表和错误响应断言。另更新关注 RPC 与 UIN 格式两项过时断言。
- QQ API 全量 609 项中 607 通过，仅 2 项 Windows 创建符号链接 EPERM。core/MCP 构建通过。前端全量测试通过（同时修正设置页原有的两参数旧正则断言，实际歌词匹配已经是三参数）。前端构建输出到本轮 visualizations 下 `electron-validation`，避免覆盖正在运行的 Electron 输出文件。
- 用户明确要求删除同步到 QQ，并特别强调“我喜欢”不可删除。新增后端 `DELETE /account/{provider}/playlists/{id}`，QQ 实现调用 `POST /user/deletePlaylist`；QQ 服务先查当前账号自建歌单，将 tid 解析为 dirid，校验归属后调用 `PlaylistBaseWrite/DelPlaylist`。禁止 dirid 0、1、201、205、206 和未知类型。浏览器传入的可删除标志不能绕过服务端校验。
- `HomepagePlaylist` 新增 `deletable`，旧构造器保持兼容、默认 false。QQ 映射为真实自建普通歌单可删除，系统歌单不可删除。音乐库新增右键菜单，删除前确认同步及不可撤销，成功后才移除卡片。其他源暂不提供删除。
- 封面增加 `diss_cover` 字段识别，过滤无效相对值（如 `?n=1`）；有歌曲且没有有效封面的自建列表，从首曲取得封面。空列表保留占位。用户重启 IDE 后，运行中的 `/account/qq/playlists` 已返回“我喜欢”的首曲封面且 deletable=false。
- 歌词元数据及正文解析器都补充“人声编辑”，并合并前端新识别到的制作信息，避免后端已有 credits 遗漏该项。修复 `.lyric-line-content` 的 overflow-x:hidden 导致 overflow-y:auto，从而在高亮放大时产生行内滚动条的问题。保留整页歌词拖动／滚动。
- 相关 Java 57 项通过（QqMusicProvider 38、AccountController 12、AccountCatalogService 7）；QQ 删除保护 9 项通过，含“我喜欢”、系统目录、非本人歌单和归属读取失败。
- 真实验证仅创建两个临时空歌单：一个验证 QQ 服务，一个验证当前运行后端的 HTTP DELETE，两者均成功删除并回读确认清理。未删除用户既有歌单。临时浏览器组件验证“我喜欢”删除按钮禁用、普通自建歌单触发删除、封面显示；实际 CSS 对照确认旧 overflow-y:auto，修复后 visible。
- 用户已在 IDE 重启后端；QQ API 已重启到 PID 33016（以后操作必须重新查进程身份）。前端热更新即可，未重启 Electron。未提交或推送，保留工作区其他既有改动。

## 2026-10-07 22:21 收藏续修结果（优先于所有下方历史记录）

- 用户确认官方客户端正常，重新登录后项目添加喜欢仍失败；手机中的五首灰色歌曲标为“其他设备导入，不支持播放”。不能将本次问题全部归因于登录态，也不能把之前重复添加已有收藏的成功当作新增收藏验证。
- 已定位普通歌曲新增失败：`PlaylistDetailWrite/AddSonglist` 使用原 `ct=19/cv=0/authst` 公共参数返回 `req_1.code=80105`（即便外层 code 和 data.retCode 均为 0）。独立临时浏览器的 QQ 官网收藏按钮使用 `ct=24/cv=4747474`、规范化 UIN、音乐票据计算的 GTK、Cookie 认证，同一歌曲可添加。真实对照确认不需要引入浏览器或新版加密依赖。
- `userMusicu.ts` 新增仅按调用方启用的 `webClient` 参数；`songFavorite.ts` 的添加／取消喜欢使用官网公共参数，其他用户接口保持原模式。票据续期后重新计算 GTK 和签名，新增回归测试覆盖此行为。
- 灰色导入歌曲没有 MID，只有数字 ID，且类型为 1；原实现错误地将数字 ID 当 MID 查询普通歌曲。取消数字 ID 时改为分页读取账号喜欢列表，保留原始 song type 后删除；支持 filtered_song，列表读取失败或分页状态缺失不伪装成功。完整读取确认已不存在的条目允许幂等取消。
- 真实账号变更：排查时成功取消灰色“无名之辈”（ID 3399339082）；其他四首灰色歌曲仍保留。针对用户当前尝试收藏的“心月辞·长相望”执行添加／取消对照，最终保留已喜欢状态。未添加其他测试歌曲，不能确认原五首导入条目的创建来源。
- 已重启 QQ API 3300，新 PID 16832，Node `--import tsx src/app.ts`，隐藏窗口。IDE 后端 PID 30056（17890）及 Vite PID 652（5173）未重启。以后操作必须重新核验进程身份。
- 从项目正在运行的后端实测 `DELETE /account/qq/favorites/qq:000bjZqH448qnK` 返回 ok:true，回读确认消失；随后 `POST /account/qq/favorites` 返回 ok:true，回读确认出现（共 5 条：当前歌曲及 4 首导入条目）。不是重复收藏已有歌曲。已不存在的数字导入条目取消也返回成功。关注／粉丝列表均成功，分别 1／0。
- QQ 用户服务回归测试最终共 37 项；完整 core/MCP 构建通过。全量测试 600 项中 575 通过、25 失败，仍为此前四个测试文件的契约／符号链接问题。不能宣称全量测试通过。本轮未修改 Java 或前端代码。

## 2026-10-07 21:14 续修结果（优先于下方历史记录）

- 已确认本轮根因是保存的 QQ 音乐票据失效：旧票据调用 `music.UserInfo.userInfoServer/GetLoginUserInfo` 返回 1000；使用同一账号现存 OAuth 凭据调用 `music.login.LoginServer/Login` 续期后，登录校验及关注列表返回 0。无需新增浏览器签名。用户确认手机官方客户端正常。
- 新增 `music-api/qq-music-api/src/services/apis/user/qqSession.ts`，在 `userMusicu.ts` 接入失效码触发的一次续期／重试；更新 Cookie、authst 和签名；并发续期合并，缓存按原凭据隔离，最多 64 个会话。返回账号必须与原账号一致。网络失败不重试写操作，续期失败保留上游错误。
- 缓存仅在 QQ API 进程内，不改写后端持久化凭据。重启后凭原 OAuth 票据按需续期；OAuth 凭据本身过期仍需重新登录。适用于 QQ OAuth，未改变微信登录流程。
- 后端 `ensureMusicuSuccess` 将无法续期的 1000/104400/104401 映射到登录失效异常，并检查嵌套 `data.code`、`data.retCode`，防止上游写入失败被视为成功。这部分 Java 改动需要 IDE 下次重启后端生效；本轮未重启或另启 17890。
- 已重启 QQ API 3300 服务，当前 PID 为 39444，命令为 Node `--import tsx src/app.ts`，窗口隐藏。后端仍为原 IDE 进程 2384；以后操作前必须重新核验 PID。
- 当前运行后端实测：关注列表 HTTP 200、1 位歌手；粉丝列表 HTTP 200、0 人；喜欢列表 HTTP 200、30 首；歌手关注状态 GET/关注 POST/再次 GET 均 HTTP 200；喜欢 POST HTTP 200、`ok:true`，回读仍包含歌曲、数量保持 30。
- 写操作仅重复关注已关注歌手、重复添加已喜欢歌曲，验证了成功业务码和回读；未真实测试新增不同歌曲／歌手及取消操作。
- QQ 用户服务针对性测试 10 文件、30 项通过；Spring `QqMusicProviderTest` 36 项通过；QQ API core/MCP 构建、TypeScript 检查、lint、文档构建通过。
- 按嵌套仓库要求运行全量测试，结果 568 通过、25 失败（593 项）。失败在 `api.test.ts`、`recommend.test.ts`、`readonly-extras.test.ts` 的其他接口／旧契约断言，以及 `package-entry.test.ts` 的 Windows 符号链接 EPERM；未扩大范围修理，不能声称全量测试通过。
- 临时验证脚本已删除，未打印或保存明文凭据，未提交或推送。本次修改保留所有既有未提交工作。

## 新对话从这里开始

工作目录：`G:\倾听音乐`。项目包含 Spring Boot 后端、Electron/Vue 播放器和本地 QQ API 服务。

当前主要任务尚未完成：继续修复 QQ 音乐的添加喜欢、关注歌手、关注状态、关注列表、粉丝列表。此前搜索及部分列表读取已恢复。用户要求仅修改相关功能，节约时间，不做大范围重复测试。

用户最后遇到后端 `17890` 端口被占用。原因是助手此前启动的验证后端未关闭。已停止该 Java 进程，并确认端口释放。随后用户要求生成本文，准备新开对话。

**务必先读实际代码和当前进程状态；不要把本文件中的历史实测当作当前实时状态。也不要把通过模拟测试当作真实 QQ 接口已修复。**

## 用户要求与边界

- 只修有问题的接口，不改动其他已正常工作的功能。
- QQ 音乐已登录，网易云未登录；网易云登录相关接口没有实际验证条件。
- 云盘仅属于网易云，不能给 QQ 混入云盘功能，也不能把 QQ 不支持云盘列为接口故障。
- 不把接口失败伪装为空列表、未关注或收藏成功。
- 用户对长时间排查已不耐烦，明确问过“这么久吗”。及时提供真实进展，避免反复承诺“最后一轮”后继续无限排查。
- 用户历史上提出过更新 GitHub 的要求；此次交接没有执行提交或推送，后续处理发布时结合用户最新要求和工作区归属判断。
- 不输出或写入交接文档任何 Cookie、令牌、密钥。

## 当前运行状态

本文生成时只读检查结果：

| 服务 | 端口 | 状态 |
| --- | --- | --- |
| Spring Boot 后端 | 17890 | 未发现监听进程，留给用户从 IDE 启动 |
| QQ API | 3300 | 正在监听，当时 PID 为 7836 |
| 前端 Vite | 5173 | 正在监听，当时 PID 为 26496 |

此前验证后端 Java PID 为 29692，已经关闭。不能再按旧 PID 操作，必须重新确认进程身份。

不要为了验证启动另一个占用 `17890` 的后台后端。尤其注意沙箱与实际用户的 `user.home` 不同，可能读取不同数据库、账户和凭据目录。此前已经踩过这个问题。

## 接口实测结果

以下是本次会话中后端还运行时的结果，非本次写文档时重新请求的结果。

| 功能 | 实测结果 | 说明 |
| --- | --- | --- |
| QQ 我喜欢歌曲读取 | HTTP 200，返回 30 首 | 已换读取接口；仅证明取得这一批，不证明完整分页 |
| QQ 创建的歌单读取 | HTTP 200，返回 2 个 | 已换读取接口 |
| QQ 收藏歌单读取 | QQ API HTTP 200、业务码 0、空列表 | 空结果不能证明非空账号数据映射全部正确 |
| QQ 账号资料 | HTTP 200 | 昵称、头像能返回；关注/粉丝数量显示 0 未与官方客户端核对 |
| 搜索歌曲 | HTTP 200，5 条，总数 600 | 关键词“鸣潮”，limit=5 |
| 搜索歌单 | HTTP 200，5 条，总数 300 | 读取 playlists 字段，不是 songs |
| 搜索歌手 | HTTP 200，5 条，总数 19 | 读取 artists 字段 |
| 歌手详情、热门歌曲、歌曲分页、专辑 | HTTP 200，有数据 | 此前已验证 |
| 推荐歌曲 | HTTP 200，29 条 | 此前已验证 |
| 精选歌单 | HTTP 200，12 条 | 此前已验证 |
| 私人雷达、漫游、最近播放、听歌排行 | HTTP 200，空结果 | 尚不能仅据此宣称功能完整正常 |
| 添加喜欢 | **仍失败** | 新接口返回外层 code=0、req_1.code=1000，应用层 HTTP 500 |
| 取消喜欢 | **未真实验证** | 已更换调用实现，仅模拟测试通过；未删除用户收藏 |
| 关注列表、粉丝列表、歌手关注状态 | **仍失败** | QQ 返回业务码 1000，应用层 HTTP 500 |
| 关注/取消关注歌手 | **未修复** | 用户报告关注失败；未为测试改变真实关注关系 |
| 收藏/取消收藏歌单等其他写操作 | **未完成真实验证** | 不要宣称所有接口已检查、已恢复 |

此前检查并非“全部接口全量审计”，主要覆盖用户报告的接口及上述相关读取路径。

## 本轮已实施的改动

路径以下均以 `G:\倾听音乐` 为根。

### QQ API 适配层

目录：`music-api/qq-music-api`，它是独立的嵌套 Git 工作区，必须单独检查 diff/status。

1. `src/services/apis/user/getUserPlaylists.ts`
   - 从旧主页接口改为 `/rsc/fcgi-bin/fcg_user_created_diss`。
   - 参数只传 `hostuin`、`sin`、`size`。此前附加旧参数会触发 `hostuin para invalid`。
   - 将 `data.disslist` 归一化为 `response.data.playlists`。
   - 当前代码把业务码 4000 转为空列表；这一语义未单独验证，后续如涉及无数据误报需要核实。
2. `src/services/apis/user/getUserLikedSongs.ts`
   - 改用 `music.srfDissInfo.DissInfo / CgiGetDiss`。
   - 参数：`disstid:0`、`dirid:201`、`tag:true`、`song_begin`、`song_num`、`userinfo:true`、`orderlist:true`、`onlysonglist:false`。
   - 直接取得歌曲列表，避免依赖旧主页里的歌单摘要。
3. `src/services/apis/user/getUserCollections.ts`
   - 用 Cookie 的 p_skey 计算 g_tk，补充 loginUin。
4. `src/services/apis/user/userMusicu.ts`
   - 规范化 UIN。
   - 认证键优先级：`qm_keyst`、`qqmusic_key`、`music_key`。
   - 有 authst 时 ct=19/cv=0；没有时 ct=24/cv=4747474。
   - 补充字符集、notice、needNewCode、g_tk 等字段。
   - `signed:true` 仍使用原来的 zzc 签名，**没有实现 ag-1 浏览器加密**。
   - 此文件为共享调用工具，后续修改应注意影响其他 QQ 用户接口。
5. `src/services/apis/user/getUserSocial.ts`
   - 关注歌手读取改为 `music.concern.RelationList / GetFollowSingerList`，参数 `From`、`Size`、`HostUin:''`。
   - 粉丝读取使用 `music.concern.RelationList / GetFansList`。
   - 关注用户的旧 CGI 路径仍存在。
   - 当前真实请求仍失败，不能标记修复完成。
6. `src/services/apis/user/songFavorite.ts`
   - 移除了旧 splcloud/qzone 收藏写入路径。
   - 先调用 `music.pf_song_detail_svr / get_song_detail_yqq`，解析歌曲数字 ID 和 type。
   - 再调用 `music.musicasset.PlaylistDetailWrite / AddSonglist` 或 `DelSonglist`。
   - 参数：`dirId:201`、`v_songInfo:[{songType,songId}]`，`signed:true`。
   - **这是已迁移但未打通的实现，添加喜欢实际仍失败。**
   - 服务会保留上游嵌套业务错误，由后端 `ensureMusicuSuccess` 检测；不能只看 QQ API 的 HTTP 200。

### Spring Boot

- `backend/src/main/java/com/listenmusic/provider/QqMusicProvider.java`
  - `loadAccountFollowing` 支持当前 RelationList 的 `List`、`MID`、`Name`、`AvatarUrl`、`Desc` 等字段，保留旧映射兼容。
  - `loadAccountFavorites` 优先解析直接返回的歌曲列表，保留旧歌单 ID 回退流程。
  - `tracksFrom` 增加 `response/req_1/data/songlist` 路径。
  - 本文件原先就有搜索等未提交修改，不能把整个 diff 都认作本轮改动。
- `backend/src/test/java/com/listenmusic/provider/QqMusicProviderTest.java`
  - 增加当前喜欢列表和 RelationList 响应映射测试。

## 剩余问题的证据与不确定性

确定的事实：

- 同一账户凭据可读取账号资料、我喜欢歌曲、创建歌单，但相关社交/写接口返回 `1000`。
- Cookie 中存在 p_skey、uin、qm_keyst、qqmusic_key 及 QQ 登录相关键；仅检查了键名，不能由此证明票据有效或适用于每个接口。
- 测试过 qm_keyst/qqmusic_key 优先级互换，收藏写入结果仍是 `1000`。最终恢复 qm_keyst 优先。
- 测试过 musicu 与 zzc 签名 musics，以及不同 comm/HostUin 组合，仍失败。
- 临时用旧独立 CGI 测试关注歌手列表和粉丝列表，应用请求仍失败，已撤回这次临时替换。
- 对收藏写入的真实探测只重复添加一首已在喜欢列表的歌曲；请求失败，没有执行删除收藏。
- 临时 `[DEBUG-qq-*]` 日志已移除。

待验证的假设：

此前查看的 QQ 官网公开脚本包含将请求变为 `musics.fcg`、`encoding=ag-1` 的浏览器加密链路。因此新签名可能是原因之一。但**没有用同一账户的成功官网请求做完整对照，不能断言业务码 1000 必然由新签名造成**。也可能涉及登录态有效性、请求 comm、票据类型或传递方式。

前一轮向用户宣称“确定是浏览器签名”过于肯定。接手时应纠正这个判断，先建立成功/失败对照，避免重复猜参数。

## 验证范围

- QQ API 针对性测试：6 个文件、11 项通过。
- 文件：`getUserPlaylists.test.ts`、`getUserLikedSongs.test.ts`、`getUserCollections.test.ts`、`getUserSocial.test.ts`、`userMusicu.test.ts`、`songFavorite.test.ts`，位于 `tests/unit/services/apis/user/`。
- 撤回社交 CGI 试验后，又跑了 getUserSocial/songFavorite 共 4 项，通过。
- Spring `QqMusicProviderTest`：本轮此前运行 34 项，通过。
- 这些测试使用模拟上游，证明请求/映射契约，不证明真实 QQ 写操作成功。
- 没有对网易云登录接口进行实测，没有跑全量前后端回归。

## 工具与启动注意

PowerShell 环境。通用 pnpm 命令曾被 NVM 以 NVM4306 拒绝，不要为此修改用户全局配置。可以直接使用已安装 Node 运行项目中的工具入口：

```powershell
# 工作目录：G:\倾听音乐\music-api\qq-music-api
& 'C:\Users\WQTY\AppData\Local\Author Software\nvm\.nodejs\node.exe' node_modules/vitest/vitest.mjs run tests/unit/services/apis/user/songFavorite.test.ts
```

QQ API 开发入口为 `node_modules/tsx/dist/cli.mjs src/app.ts`，环境变量 `PORT=3300`。启动前检查监听，避免重复启动。后台启动应隐藏窗口，并记录自己启动的进程，结束后明确移交或关闭。此前只停止 tsx 父进程并没有停止监听子进程，必须核验端口。

Spring 从 `backend` 目录运行；让用户的 IDE 管理现有后端最稳妥。测试命令示例：

```powershell
mvn '-Dtest=QqMusicProviderTest' test
```

## 工作区与旧功能

主仓库当前最新提交：`29cde27 feat: add local online audio sources and refine player experience`。本轮接口修复没有提交或推送。

主仓库和 QQ API 嵌套仓库都有大量既有未提交修改、未跟踪文件。主仓库涉及 App.vue、PlayerBar.vue、Electron 主进程/preload、歌词解析/缓存/匹配、封面取色和测试。QQ API 涉及搜索、歌曲详情、歌词解密、播放、路由和 MCP 等。不要 reset、checkout 覆盖或把所有文件一次性提交。

历史用户需求仍需要保护：

- 本地歌曲默认播放本地文件，音质菜单可匹配 QQ/网易云音源并切回本地。
- 原文和翻译都显示，桌面歌词也显示翻译，角色名下不能重复挂下一句翻译。
- 歌词常规字号/字重与歌曲信息一致，长句不自动缩小、不换行；当前句放大及上下切换应流畅，扩大可用显示范围。
- 优先本地嵌入/旁挂歌词，保留 QQ 逐字高亮；无本地歌词时 QQ 优先、网易云其次。匹配结果持久缓存，清理缓存前不反复请求。
- 演职员信息用冒号分隔，清理无意义的 // 占位。
- 播放栏按钮按封面主色变化，上下首按钮也要遵循主题色。

这些项目中已有历史实现和用户反馈，**本轮接口修复没有重新逐项验证全部需求是否完成**，请勿因为旧截图或旧文档就重写它们。

更早的背景文件：`docs/audio-lyrics-handoff-2026-10-07.md`。该文件混有历史暂停状态、旧 PID 和早期“尚未实现”描述，只作背景，不能直接照旧执行。

## 建议下一步

1. 先确认用户已从 IDE 启动后端，检查当前账户能否在 QQ 官方客户端/网页完成同一操作。
2. 针对一个失败接口建立同一账户的最小请求对照，优先验证真实登录态和凭据传递；避免再次漫无目的切换参数。
3. 若证据确认需要浏览器签名，评估与现有 Electron 登录会话集成的最小方案；不要未经评估向后端引入庞大浏览器运行时。
4. 打通一个代表性接口后再修关注、粉丝、收藏写入等相关路径，检查嵌套业务码与实际结果。
5. 对未覆盖的接口明确标注“未验证”，对空结果核实语义，不宣称全量审计已完成。
6. 仅做必要针对性验证，给用户清晰的可测试功能和剩余阻碍。不要再遗留占用 17890 的验证进程。

可直接在新对话使用：

> 请先阅读 G:\倾听音乐\docs\handoff-2026-10-07-qq-api.md，继续修复尚未打通的 QQ 音乐喜欢、关注和粉丝接口。仅改相关功能，保留现有未提交修改，减少重复测试。QQ 没有云盘；不要重复启动占用 17890 的后端。文档里浏览器签名原因还只是待验证假设，请依据实际请求定位。
