# 调律音乐官网

纯静态介绍与下载页，无需构建或安装依赖。保留现有品牌、备案号和两个下载入口；官网当前版本 0.1.7，仅支持 Windows x64。官网和 GitHub Release 使用相同版本的安装包、blockmap 与更新清单。

## 本地预览

双击 `index.html` 即可查看。也可在本目录运行 `node preview.mjs` 后打开 `http://127.0.0.1:4178`；按 Ctrl+C 停止。

预览服务会将现有安装包相对地址重定向到线上对应地址，不读取或写入本地 `updates`。直接以文件方式打开首页时，安装包相对地址无法下载，请使用 GitHub 备用入口或线上官网。

## 上传宝塔

服务器已有 0.1.7 安装包和更新清单时，只需上传 `electron/release/server-distribution/0.1.7/网站更新包-0.1.7.zip`，覆盖网站根目录的 `index.html`。此包不含安装包或 `updates/`，不会影响已上传的更新文件和封面素材。上传前备份原首页，完成后刷新 `https://wqty.online/` 检查版本、截图、下载入口和备案信息。

本次网页包只更新以下文件：

- `index.html`

不要删除网站根目录，不要清空已有的 `assets/` 或 `updates/`，保留历史安装包。此 ZIP 只包含首页，没有安装包、更新清单、blockmap、服务器配置或播放器后端。合并覆盖即可，无需修改宝塔、Nginx、SSL 或默认首页配置。

`README.md`、`preview.mjs`、`验证结果.json`、预览截图和 `.backups/` 仅在本地使用，无需上传。上传后在浏览器刷新并检查首页、截图、备案信息和现有下载入口即可。

## 截图与下载入口

2026-10-12 重新启动当前项目的 Electron 构建（版本 0.1.2），等实际歌曲封面与歌词加载完成后拍摄。截图按原文件复制，没有生成、改画或裁切软件界面：

- `local-home.png` ← `.test-tmp/site-refresh/local-home.png`（1600 × 900，本地主页，已加载真实专辑封面）
- `online-music.png` ← `.test-tmp/site-refresh/online-music.png`（1600 × 900，QQ 音乐实际搜索结果，不含账号资料）
- `lyrics.png` ← `.test-tmp/site-refresh/lyrics.png`（1600 × 900，愿戴荣光坠入天渊的真实专辑封面与双语歌词）
- `mini-player.png` ← `.test-tmp/site-refresh/mini-player.png`（720 × 320，同一首歌的迷你播放器，保留透明圆角）

源文件均位于 `G:/倾听音乐/` 下。此次运行使用隔离的 Electron 配置，通过现有本机服务读取实际音乐库和平台数据；拦截非只读的后端请求，没有新增或删除收藏、歌单、音乐库，也没有上报听歌记录。截图来自当前项目构建，不是重新安装安装包后的截图。

原截图中的默认“律”封面、演示歌词和空闲播放器来自旧测试画面，不是网页图片路径损坏；现已替换。图片链接加入 `v=20261012-real` 缓存标记。旧网页、素材和上传包备份于 `.backups/20261012-real-screenshots/`。兼容保留的旧 `netease.png` 不再被网页引用，也不包含在新上传包中。

按 0.1.7 服务器上传方案更新入口，既有真实截图和备案信息保留：

- 官网安装包：`./updates/windows/Tiaolv-Setup-0.1.7.exe`
- GitHub Release：`https://github.com/WQTY-MASTER/tiaolv-music/releases/tag/v0.1.7`

官网安装包地址上线后解析为 `https://wqty.online/updates/windows/Tiaolv-Setup-0.1.7.exe`，复制按钮提供此地址。没有自动改为 `releases/latest`。旧版本安装包下载链接不修改。

备案号保留为 **琼ICP备2026005196号-1**，链接到工信部备案查询。网页未接入在线播放、调律账号注册或云端数据同步。
