const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const onboarding = fs.readFileSync(path.join(root, "src/renderer/src/components/FirstRunOnboarding.vue"), "utf8");
const service = fs.readFileSync(path.join(root, "src/renderer/src/services/audioOutput.ts"), "utf8");

assert.match(service, /navigator\.mediaDevices\.enumerateDevices\(\)/, "音频输出服务应枚举真实系统设备");
assert.match(service, /device\.kind === "audiooutput"/, "设备列表只能包含音频输出设备");
assert.match(service, /normalizeAudioOutputDevices/, "Windows 默认角色别名应与真实输出设备归并");
assert.match(service, /resolveAudioOutputDeviceId/, "系统默认应解析到刷新后的真实物理端点");
assert.match(service, /setSinkId/, "设备选择应调用浏览器真实输出路由接口");
assert.match(service, /createMediaElementSource/, "响度匹配应接入真实播放音频节点");
assert.match(service, /createAnalyser/, "响度匹配应分析当前音频信号");

assert.match(onboarding, /currentPage = ref<1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8>/, "引导应保留第六页并继续到完成页");
assert.match(onboarding, /currentPage\.value === 5[\s\S]*goToPage\(6\)/, "第五页继续后应进入声音输出页");
assert.match(onboarding, /让声音去<span>对的地方<\/span>/, "第六页缺少声音输出标题");
assert.match(onboarding, /v-for="device in audioOutputDevices"/, "第六页应展示真实输出设备列表");
assert.match(onboarding, /兼容模式/, "第六页应说明当前共享输出模式");
assert.match(onboarding, /响度匹配/, "第六页缺少响度匹配开关");
assert.doesNotMatch(onboarding, /HiFi\s*独占|WASAPI|ASIO/, "第六页不应保留当前引擎无法实现的独占输出");

assert.match(app, /v-model:audio-output-preferences="audioOutputPreferences"/, "应用应把第六页接入同一份音频输出偏好");
assert.match(app, /applyAudioOutputDevice/, "应用应把设备偏好应用到真实音频元素");
assert.match(app, /resolveAudioOutputDeviceId\(\s*audioOutputPreferences\.value\.deviceId,\s*audioOutputDevices\.value\s*\)/, "播放时应使用当前系统默认的真实端点");
assert.match(app, /device\.aliases\?\.includes\(audioOutputPreferences\.value\.deviceId\)/, "已保存的设备别名应无提示迁移到归并后的可见设备");
assert.match(app, /setLoudnessMatching/, "应用应把响度匹配应用到真实音频处理器");
assert.match(app, /@play="handleAudioPlay"/, "每次开始播放都应重新应用当前音频输出");
assert.match(app, /function handleAudioPlay\(\)[\s\S]*applyAudioOutputPreferencesToPlayback/, "播放事件应刷新音频输出路由");
assert.match(app, /window\.addEventListener\("focus", handleAudioOutputDeviceChange\)/, "窗口重新获得焦点时应刷新系统默认输出");
assert.match(app, /音频输出设备/, "播放设置应追加输出设备选择");
assert.match(app, /动态调整不同歌曲的播放增益/, "播放设置应追加响度匹配说明");

console.log("音频输出与第六章引导契约通过");
