const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");

assert.match(app, /searchState/, "在线搜索应有独立的加载和错误状态");
assert.match(app, /searchRequestId/, "连续搜索时应忽略过期请求结果");
assert.match(app, /playbackQueue/, "播放在线歌曲后应保留当前播放队列");
assert.match(app, /getPlaybackQueue/, "上一首和下一首应从当前播放队列取歌");
assert.match(app, /没有可播放地址/, "在线歌曲没有播放地址时应提示用户");
assert.match(app, /audio\.pause\(\)/, "切换歌曲前应暂停上一首音频");
assert.match(app, /audio\.load\(\)/, "切换音频源后应重新加载媒体资源");
assert.match(app, /在线搜索/, "搜索结果页应明确标识在线搜索");
assert.match(app, /searchError/, "在线搜索失败应显示可理解的错误提示");
assert.match(api, /\/catalog\/tracks\/\$\{encodeURIComponent\(id\)\}\/audio/, "前端应通过 Java 获取统一播放地址");
assert.match(app, /\/catalog\/tracks\/\$\{encodeURIComponent\(track\.id\)\}\/cover/, "在线歌曲封面应通过 Java 代理接口加载");
assert.match(api, /export function reportListeningScrobble[\s\S]*\/account\/\$\{encodeURIComponent\(provider\)\}\/listening-scrobbles[\s\S]*method:\s*"POST"/, "前端应通过 Java 账号接口上报听歌打卡");
assert.match(app, /createScrobbleSession[\s\S]*sampleScrobblePlayback[\s\S]*beginScrobbleReport/, "播放器应使用独立状态机累计有效播放时长");
assert.match(app, /track\.source === "netease"[\s\S]{0,180}accounts\.value\.some/, "仅已登录网易云账号的网易云歌曲可以创建打卡会话");
assert.match(app, /sampleScrobblePlayback\(listeningScrobbleSession, mediaTime\)[\s\S]{0,240}beginScrobbleReport/, "播放采样达到门槛后应锁定并触发一次打卡");
assert.match(app, /reportListeningScrobble\("netease"/, "听歌打卡应发送到网易云账号接口");
assert.match(app, /playMode\.value === "single"[\s\S]{0,260}startListeningScrobbleSession/, "单曲循环重新开始时应创建新的打卡会话");

console.log("在线音乐播放闭环契约通过");
