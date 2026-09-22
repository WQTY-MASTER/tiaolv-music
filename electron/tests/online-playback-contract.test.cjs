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

console.log("在线音乐播放闭环契约通过");
