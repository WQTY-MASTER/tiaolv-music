# 调律音乐官网

纯静态介绍与下载页，无需构建或安装依赖。保留现有品牌、备案号和两个下载入口；内容依据播放器 README 与用户指定的 `更新日志.md`，当前版本 0.1.3，仅支持 Windows x64。

## 本地预览

双击 `index.html` 即可查看。也可在本目录运行 `node preview.mjs` 后打开 `http://127.0.0.1:4178`；按 Ctrl+C 停止。

预览服务会将现有安装包相对地址重定向到线上对应地址，不读取或写入本地 `updates`。直接以文件方式打开首页时，安装包相对地址无法下载，请使用 GitHub 备用入口或线上官网。

## 上传宝塔

首次上线 0.1.3 请使用播放器目录中的 `electron/release/server-distribution/网站及更新上传包-0.1.3.zip`，内含网页、安装包、blockmap 和清单。不要只上传新网页而遗漏对应安装包。先上传 `updates/windows/` 中的 EXE 和 blockmap，核对后再更新首页和 `latest.yml`。

版本文件已经上线后，单独更新网页可以将 `网站上传包.zip` 上传到 `wqty.online` 对应的网站根目录并解压，合并覆盖以下网页文件：

- `index.html`
- `styles.css`
- `script.js`
- `assets/logo.png`
- `assets/screenshots/local-home.png`
- `assets/screenshots/lyrics.png`
- `assets/screenshots/online-music.png`
- `assets/screenshots/mini-player.png`

不要删除网站根目录，不要清空已有的 `updates/`，保留旧版本文件。这里的 `网站上传包.zip` 只包含上述网页文件，没有安装包、更新清单、blockmap、服务器配置或播放器后端。合并上传，无需修改宝塔、Nginx、SSL 或默认首页配置。

`README.md`、`preview.mjs`、`验证结果.json`、预览截图和 `.backups/` 仅在本地使用，无需上传。上传后在浏览器刷新并检查首页、截图、备案信息和现有下载入口即可。

## 截图与下载入口

2026-10-12 重新启动当前项目的 Electron 构建（版本 0.1.2），等实际歌曲封面与歌词加载完成后拍摄。截图按原文件复制，没有生成、改画或裁切软件界面：

- `local-home.png` ← `.test-tmp/site-refresh/local-home.png`（1600 × 900，本地主页，已加载真实专辑封面）
- `online-music.png` ← `.test-tmp/site-refresh/online-music.png`（1600 × 900，QQ 音乐实际搜索结果，不含账号资料）
- `lyrics.png` ← `.test-tmp/site-refresh/lyrics.png`（1600 × 900，愿戴荣光坠入天渊的真实专辑封面与双语歌词）
- `mini-player.png` ← `.test-tmp/site-refresh/mini-player.png`（720 × 320，同一首歌的迷你播放器，保留透明圆角）

源文件均位于 `G:/倾听音乐/` 下。此次运行使用隔离的 Electron 配置，通过现有本机服务读取实际音乐库和平台数据；拦截非只读的后端请求，没有新增或删除收藏、歌单、音乐库，也没有上报听歌记录。截图来自当前项目构建，不是重新安装安装包后的截图。

原截图中的默认“律”封面、演示歌词和空闲播放器来自旧测试画面，不是网页图片路径损坏；现已替换。图片链接加入 `v=20261012-real` 缓存标记。旧网页、素材和上传包备份于 `.backups/20261012-real-screenshots/`。兼容保留的旧 `netease.png` 不再被网页引用，也不包含在新上传包中。

按用户确认的 0.1.3 整体发布方案更新入口：

- 官网安装包：`./updates/windows/Tiaolv-Setup-0.1.3.exe`
- GitHub：`https://github.com/WQTY-MASTER/tiaolv-music/releases/tag/v0.1.3`

官网安装包地址上线后解析为 `https://wqty.online/updates/windows/Tiaolv-Setup-0.1.3.exe`，复制按钮提供此地址。没有自动改为 `releases/latest`。旧的 0.1.2 安装包下载链接不修改。

备案号保留为 **琼ICP备2026005196号-1**，链接到工信部备案查询。网页未接入在线播放、调律账号注册或云端数据同步。
