# 在线歌单操作实现计划

> 使用 executing-plans 在当前会话内执行；用户要求本地验证，不提交 Git。

**Goal:** 修复四项在线歌单行为并交付 0.1.5-beta.1 本地安装包。

**Architecture:** 保留 App 的状态管理，提取歌曲所属平台和目标权限判断，选择器捕获账号与会话代次。批量聚合复用现有音源去重规则；后端分页沿用已有 API。

**Tech Stack:** Vue 3、TypeScript、Electron、Java 21、Spring Boot。

## 1. 目标选择及会话隔离

- [x] 在 `electron/tests/account-playlist-actions.test.cjs` 加入平台路由和目标权限失败测试；在 `page-api-cache.test.cjs` 验证显式刷新绕过旧歌单缓存。
- [x] 新增 `services/accountPlaylistActions.ts`，返回 `"qq" | "netease" | null`，只接受同平台 `createdByAccount && deletable && !favorite` 的目标。
- [x] 修改 `App.vue`：选择器记录 `{ provider, userId, revision }`，独立加载目标列表，错误可重试；在账号身份变化时递增代次，清空账号内容、旧选择器及账号歌单请求。
- [x] 登录时清理对应缓存；退出两种账号都清理当前内容；创建和写入完成后仅在原账号仍有效时回填界面。

## 2. 批量聚合与取消收藏

- [x] 在 `aggregate-playlists.test.cjs` 添加三首音源含一个重复的用例，断言新增两个、跳过一个、原数据不变。
- [x] 新增 `addTracksToAggregatePlaylist(playlist, tracks)`，遍历调用现有单首去重函数，返回 `{ playlist, added, skipped }`。
- [x] 修改 `StreamingDailyMixPage.vue` 与 `streamingTrackManagement.ts`，增加 `add-to-aggregate` 动作；选择目标后一次持久化全部音源，取消不改变批量选择。
- [x] 修改 `StreamingLibraryPage.vue`：收藏歌单触发独立 `unsubscribe-playlist` 事件，使用现有订阅 API；成功才更新订阅覆盖与列表，失败保留列表并显示错误。

## 3. 两个平台列表分页

- [x] 在两个 Provider 测试中加入第二页歌单及重复页用例，先确认旧代码漏掉第二页。
- [x] 修改 `NetEaseProvider.java`：按 `more` 和页长读取后续 offset，按 ID 去重，重复页或过多页报错。
- [x] 修改 `QqMusicProvider.java`：分别读取创建和收藏列表后续 offset/page，以原始页长度判断结束，去重并检测异常循环。
- [x] 运行两个 Provider 测试类及前端相关测试，确认不访问真实平台写接口。

## 4. 本地交付

- [x] 运行类型检查、构建及隔离 UI 验证，覆盖目标列表、批量取消／去重、收藏失败和快速账号切换。
- [x] `electron/package.json` 设为 `0.1.5-beta.1`；官网和已发布版本文档保持 0.1.4。
- [x] 构建后端 JAR 并更新内置运行包，单独输出 `electron/release/0.1.5-beta.1`，electron-builder 使用 `--publish never`。
- [x] 核对安装包版本、内置后端、诊断与更新身份；给出 EXE 和四项人工检查步骤。不执行 Git 提交／推送或服务器打包。

## 验证记录

- 后端相关三个测试类共 111 项通过；前端定向回归 24 项通过。
- `typecheck`、Electron 生产构建、NSIS 本地打包通过。
- `account-playlist-actions.smoke.cjs` 使用隔离 Edge 和模拟 API，覆盖 QQ／网易云的新建目标、写入路由、喜欢及自建列表批量聚合、取消保留选择、重复去重、取消收藏失败／成功、旧账号迟到响应、换账号及退出。
- 1440px 批量界面和 920px 目标选择器截图已检查，按钮和文字未超出选择器。
- 打包 ASAR 通过隔离开发 Electron 宿主启动，诊断及检查更新入口存在；未执行覆盖安装。内置 Java 21、两个 API 依赖和后端 JAR 已验证，JAR 哈希与本次构建一致。
- EXE：`electron/release/0.1.5-beta.1/Tiaolv-Setup-0.1.5-beta.1.exe`，186161354 字节；SHA256：`fe33332895a23d2bd3bf33d2661a4cce47f7ce6dcc460ad6dd4c739c3b7a5335`。
- 未操作真实平台账号收藏，真实账号验收由用户安装后执行；未提交、推送、发布 Release 或生成服务器上传 ZIP。

## 后续诊断导出修复：0.1.5-beta.2

- 用户反馈正式 0.1.4 的诊断按钮报错，安装版主进程日志没有导出事件。
- 用隔离 Electron 和模拟健康接口复现：后端已连接时，真实按钮未打开保存窗口；普通对象可导出，Proxy 参数报 `An object could not be cloned.`。此前断开后端的验证漏掉了 Vue `ref` 深层代理分支。
- `AboutSettings.vue` 在跨 IPC 前构造仅包含健康信息字段的普通数据，异常通过现有脱敏诊断通道记录。
- 新增 `diagnostics-connected.smoke.cjs`；修复前断言失败，修复后按钮实际导出成功，ZIP 可解压，包含后端数据库版本且不含测试令牌。
- 诊断／关于页面 10 项定向测试、类型检查及生产构建通过；实际 beta.2 ASAR 中的导出也通过。
- beta.2 EXE：186163845 字节，SHA256 `7ccbb8bdbc0a133ca49990af24447cb5916ded32df10eebfaf11565257e90e1e`。保留 beta.1 安装包及公开 0.1.4，不提交或发布。
