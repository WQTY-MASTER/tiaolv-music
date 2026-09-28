# 调律音乐

调律音乐是一款面向 Windows 桌面的本地与流媒体音乐播放器，使用 Electron、Vue 3 与 Java 21 构建。

## 当前能力

- 本地音乐库扫描、增量更新、文件名元信息补全与重复歌曲标记
- 网易云音乐与 QQ 音乐账号、曲库、搜索、歌单和播放
- 网易云 YRC、QQ 音乐 QRC 逐字歌词及普通 LRC 降级
- 本地歌词文件、联网歌词匹配与歌词缓存
- 播放队列、迷你播放器、桌面歌词、任务栏缩略图按钮与系统托盘控制

## 开发环境

- Node.js 20 或更高版本
- Java 21
- Maven 3.9 或更高版本
- 本地运行的网易云音乐 API，默认端口 `3000`
- 本地运行的 QQ 音乐 API，默认端口 `3300`

安装依赖：

```powershell
pnpm install
```

启动完整开发环境：

```powershell
npm run dev
```

仅启动前端网页预览：

```powershell
npm run web:dev
```

## 验证

```powershell
npm test
npm run build
mvn -f backend/pom.xml test
```

## 项目结构

- `electron/`：Electron 主进程、Vue 渲染层与前端契约测试
- `backend/`：Spring Boot 服务、SQLite 数据层与后端测试
- `music-api/api-enhanced/`：项目当前使用的网易云音乐 API
- `scripts/`：开发环境启动脚本
- `docs/`：设计说明与实现计划

QQ 音乐 API 作为独立上游项目放在 `music-api/qq-music-api/`，该目录不会提交到本仓库。开发者可按所用 API 项目的说明单独克隆、安装和启动。

## 数据兼容

应用数据默认存放在用户目录下的 `.tiaolv-music`。从旧版升级时，程序会自动迁移原 `.listen-music` 数据目录和浏览器本地设置，不会修改音频文件本身。
