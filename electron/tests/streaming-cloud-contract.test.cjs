const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const page = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingCloudPage.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const provider = fs.readFileSync(path.join(root, "../backend/src/main/java/com/listenmusic/provider/NetEaseProvider.java"), "utf8");

assert.match(app, /appMode === 'streaming' && activeView === 'cloud'/, "云盘页面必须只在流媒体模式渲染");
assert.match(app, /<StreamingCloudPage/, "流媒体云盘应使用独立页面组件");
assert.match(app, /if \(view === "cloud" && streamingSource\.value === "qq"\)[\s\S]*switchCloudSourceToNetease\(\)/, "QQ 音源点击云盘时必须先自动切换到网易云");
assert.match(app, /音乐云盘仅网易云支持，已自动切换至网易云/, "自动切换音源后必须给出明确提示");
assert.match(app, /function switchCloudSourceToNetease\(\)[\s\S]*streamingSource\.value = "netease"[\s\S]*STREAMING_SOURCE_STORAGE_KEY/, "云盘专用切换必须同步当前音源与本地持久化状态");
assert.match(app, /function clearStreamingSourceTransientState\(\)[\s\S]*streamingHomeRequestId \+= 1[\s\S]*accountContentRequestId \+= 1[\s\S]*clearSearchResults\(\)/, "自动切换前必须终止旧平台请求并清空临时页面状态");
assert.match(app, /loadCloudTracks\("netease"\)/, "云盘列表必须显式从网易云加载");
assert.doesNotMatch(page, /selectMusicDirectory|scanLibrary/, "云盘页面不得复用本地扫描逻辑");
for (const text of ["我的音乐云盘", "选择音频", "刷新", "播放全部", "上传与下载均由主进程安全处理"]) {
  assert.match(page, new RegExp(text), `云盘页面缺少：${text}`);
}
for (const apiName of ["loadCloudTracks", "uploadCloudAudio", "downloadCloudTrack"]) {
  assert.match(api, new RegExp(`export (?:async )?function ${apiName}\\b`), `缺少云盘 API：${apiName}`);
}
assert.match(main, /ipcMain\.handle\("upload-cloud-audio"/, "上传应由 Electron 主进程处理");
assert.match(main, /ipcMain\.handle\("download-cloud-track"/, "下载应由 Electron 主进程处理");
assert.match(preload, /uploadCloudAudio/, "预加载桥应暴露安全上传方法");
assert.match(preload, /downloadCloudTrack/, "预加载桥应暴露安全下载方法");
assert.match(provider, /path\("\/user\/cloud"\)/, "云盘列表必须来自网易云 /user/cloud");
assert.match(provider, /path\("\/song\/url"\)/, "播放地址必须由网易云 /song/url 补齐");
assert.match(provider, /body\.add\("songFile"/, "上传到网易云时必须使用 songFile 字段");
assert.match(provider, /path\("\/cloud\/lyric\/get"\)/, "云盘歌词必须来自网易云 /cloud/lyric/get");
assert.match(api, /export function loadCloudLyrics\b/, "前端 API 应暴露云盘歌词读取方法");
assert.match(app, /track\.source === "cloud"[\s\S]*loadCloudLyrics\(track\.id\)/, "播放云盘歌曲时应加载文件内置歌词");
assert.match(main, /fetch\(source\)/, "下载应由 Electron 主进程直接保存网易云音频流");
assert.doesNotMatch(main, /cloud\/tracks\/.*\/download/, "下载不得依赖自建云盘文件接口");

console.log("流媒体音乐云盘契约通过");
