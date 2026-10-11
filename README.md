# 调律音乐

调律音乐是一款面向 Windows 桌面的本地与流媒体音乐播放器，使用 Electron、Vue 3 与 Java 21 构建。

打开即可使用，无需注册调律账号、邀请码或激活。首次启动直接进入八页引导，
可以跳过；QQ 音乐和网易云音乐仅在使用对应平台功能时按需登录。
本地音乐、歌单、历史、设置和平台登录凭据由客户端及其本机服务管理，
不上传到共享服务器。当前产品定位见 [本地优先说明](docs/local-first-product-scope.md)。

## 当前能力

- 本地音乐库扫描、增量更新、文件名元信息补全与重复歌曲标记
- 网易云音乐与 QQ 音乐账号、曲库、搜索、歌单和播放
- 网易云 YRC、QQ 音乐 QRC 逐字歌词及普通 LRC 降级
- 本地歌词文件、联网歌词匹配与歌词缓存
- 播放队列、迷你播放器、桌面歌词、任务栏缩略图按钮与系统托盘控制

## 开发环境

- Node.js 24（验收使用版本；启动工具需要原生 TypeScript 支持）
- Java 21
- Maven 3.9 或更高版本
- 网易云音乐 API 与 QQ 音乐 API 源码及锁文件；服务仅绑定本机

安装依赖：

```powershell
pnpm install
```

启动完整开发环境：

```powershell
npm run runtime:stage -- --online
npm run dev
```

暂存工具构建后端、生产 API 依赖和 Java 21 运行时，不复制账号配置。
首次需要联网安装依赖；离线缓存完整时可省略 `--online`。
开发服务与安装包使用相同的受保护启动入口，占用端口不会被强制清理。
仅启动三个服务可运行 `npm run services`；修改后端/API 后需要重新暂存。

仅启动前端网页预览：

```powershell
npm run web:dev
```

## 验证

```powershell
npm test
npm run verify:offline
npm run verify:e2e
npm run build
```

浏览器验收需要先启动网页预览和安装 Playwright；具体环境、覆盖范围与
人工验收项目见 [发布检查与恢复说明](docs/release-checklist.md)。

## Windows 安装包

```powershell
npm run release:win
```

产物位于 `electron/release/`。安装包包含 Java、后端和两个 API 的生产依赖，
用户机器不需要安装 Node、Java 或 Maven。当前只支持 Windows x64。
此命令不代替干净 Windows 安装、真实账号播放、代码签名及许可证审核。

启动时自动管理 `17890`、`3000`、`3300` 三个服务，退出仅清理自身启动的进程。
私有接口需要本地访问令牌，令牌默认位于
`%USERPROFILE%/.tiaolv-music/local-access.token`，不会写入前端代码或 URL。
Electron 主进程和开发网页同源代理注入令牌；不再直接从普通网页调用后端。
不要分享该文件，也不要把 API 服务绑定到局域网地址。

## 项目结构

- `electron/`：Electron 主进程、Vue 渲染层与前端契约测试
- `backend/`：Spring Boot 服务、SQLite 数据层与后端测试
- `music-api/api-enhanced/`：项目当前使用的网易云音乐 API
- `music-api/qq-music-api/`：项目定制的 QQ 音乐 API 源码、测试与依赖锁文件
- `scripts/`：开发环境启动脚本
- `docs/`：设计说明与实现计划

QQ 音乐 API 定制源码随本仓库提交，克隆后无需另行准备上游仓库。上游版本与本地修改范围见 [源码来源说明](music-api/qq-music-api/TIAOLV_UPSTREAM.md)，保留其 [MIT 许可证](music-api/qq-music-api/LICENSE) 和 [第三方声明](music-api/qq-music-api/THIRD_PARTY_NOTICES.md)。依赖与构建产物不提交，由暂存工具构建。直接运行上游 API 不会自动启用本项目的访问保护，不建议用于日常启动。

## 数据兼容

应用数据默认存放在用户目录下的 `.tiaolv-music`。从旧版升级时，程序会自动迁移原 `.listen-music` 数据目录和浏览器本地设置，不会修改音频文件本身。

Electron 设置位于 `%APPDATA%/调律音乐`。备份或恢复前需完全退出应用和
三个服务，使用 `npm run data:backup -- --archive <新目录>` 与
`npm run data:restore -- --archive <备份目录>`。默认不备份凭据，恢复保留
原数据的回滚副本；详细限制与回滚步骤见发布检查说明。
