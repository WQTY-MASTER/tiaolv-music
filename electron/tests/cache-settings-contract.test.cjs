const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");

assert.match(app, /type SettingsSection[^;]*"cache"/, "设置分类应包含缓存页面");
assert.match(app, /id:\s*"cache",\s*title:\s*"缓存与数据"/, "设置侧栏应显示缓存与数据入口");
assert.match(app, /activeSettingsSection === 'cache'/, "缓存页面应有独立内容区域");
assert.match(app, /缓存目录[\s\S]*选择文件夹[\s\S]*恢复默认/, "缓存页面应支持自定义目录和恢复默认");
assert.match(app, /封面缓存[\s\S]*歌词缓存[\s\S]*元数据缓存/, "缓存页面应包含三个默认缓存开关");
assert.match(app, /缓存占用[\s\S]*一键清理缓存/, "缓存页面应展示占用并提供清理操作");
assert.match(app, /不会删除本地音乐、歌单数据和离线下载/, "清理确认必须明确保护用户数据");
assert.match(app, /window\.listenMusic\?\.selectDirectory/, "缓存目录选择应使用原生目录选择器");
assert.match(app, /聆听数据[\s\S]*按月删除[\s\S]*按年删除[\s\S]*删除全部/, "缓存与数据页面应提供三种足迹删除范围");
assert.match(app, /loadListeningStatsSummary/, "删除前应加载选定范围的聆听足迹预览");
assert.match(app, /deleteListeningStatsRange[\s\S]*deleteAllListeningStats/, "页面应接入范围删除和全部删除接口");
assert.match(app, /只会删除聆听足迹[\s\S]*不会影响最近播放、歌单、本地音乐、缓存和离线下载/, "删除确认必须明确数据边界");
assert.match(app, /listeningStatsSaveChain/, "删除前应等待正在保存的聆听统计，避免旧快照复活");
assert.match(app, /QQ 本地听歌排行/, "缓存页应提供 QQ 本地听歌排行清理入口");
assert.match(app, /loadQqListeningDataSummaries/, "进入缓存页应读取各 QQ 账号的本地排行汇总");
assert.match(app, /v-model="selectedQqListeningDataAccountId"/, "多个 QQ 账号的数据应分别选择，不能合并展示");
assert.match(app, /qqListeningDataDeleteMode === 'range'[\s\S]*qqListeningDataDeleteMode === 'all'/, "QQ 排行应支持范围删除和账号全部删除");
assert.match(app, /qqListeningDataDeleteFrom[\s\S]*qqListeningDataDeleteTo/, "QQ 排行范围删除应提供开始和结束日期");
assert.match(app, /qqListeningDataRangeValid/, "不完整或倒序日期应禁用删除");
assert.match(app, /deleteQqListeningStats/, "QQ 排行清理应调用独立后端接口");
assert.match(app, /不会影响 QQ 音乐云端最近播放/, "页面和确认文案应明确保护 QQ 云端最近播放");
assert.match(app, /window\.confirm\([\s\S]*QQ 本地听歌排行/, "删除 QQ 排行前必须显式确认");
assert.match(app, /await refreshQqListeningDataSummaries\(true\)[\s\S]*loadListeningRankRange\(true\)/, "删除成功后应刷新汇总和当前 QQ 排行");
assert.match(app, /catch[\s\S]*qqListeningDataError\.value/, "删除失败时应保留现有汇总并显示错误");

assert.match(api, /export interface CacheSettings/, "API 应公开缓存设置类型");
assert.match(api, /export async function loadCacheSnapshot[\s\S]*request<CacheSnapshot>\("\/cache"\)/, "API 应加载缓存快照");
assert.match(api, /export async function updateCacheSettings[\s\S]*\/cache\/settings[\s\S]*method:\s*"PUT"/, "API 应持久化缓存设置");
assert.match(api, /export async function restoreDefaultCacheDirectory[\s\S]*\/cache\/default-directory[\s\S]*method:\s*"POST"/, "API 应恢复默认缓存目录");
assert.match(api, /export async function clearManagedCache[\s\S]*request<CacheSnapshot>\("\/cache",\s*\{\s*method:\s*"DELETE"/, "API 应清理受管缓存");
assert.match(api, /export (?:async )?function loadListeningStatsSummary/, "API 应支持预览聆听足迹范围");
assert.match(api, /export (?:async )?function deleteListeningStatsRange/, "API 应支持按日期范围删除足迹");
assert.match(api, /export (?:async )?function deleteAllListeningStats/, "API 应支持删除全部足迹");
assert.match(api, /export function loadQqListeningDataSummaries/, "API 应支持读取 QQ 排行账号汇总");
assert.match(api, /export function deleteQqListeningStats/, "API 应支持删除指定 QQ 账号的本地排行");

console.log("缓存设置页面契约通过");
