const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

assert.match(app, /interface LocalFolder\s*\{[\s\S]*path:\s*string;[\s\S]*tracks:\s*Track\[\];[\s\S]*coverUrl\?:\s*string;/, "文件夹页面需要明确的本地文件夹视图模型");
assert.match(app, /const localFolderSearchKeyword = ref\(""\)/, "文件夹页面需要独立搜索状态");
assert.match(app, /const selectedLocalFolderPath = ref<string \| null>\(null\)/, "文件夹详情需要维护当前文件夹路径");
assert.match(app, /const localFolders = computed<LocalFolder\[\]>\([\s\S]*getTrackFolderPath[\s\S]*coverTrack/, "文件夹卡片应按父目录聚合歌曲并优先选取带封面的歌曲");
assert.match(app, /const filteredLocalFolders = computed\([\s\S]*localFolderSearchKeyword[\s\S]*folder\.name[\s\S]*folder\.path[\s\S]*track\.title[\s\S]*track\.artist[\s\S]*track\.album/, "搜索应同时匹配文件夹名称、路径和文件夹内歌曲信息");

assert.match(app, /activeView === 'folders'[\s\S]*class="local-folders-page"/, "文件夹应使用独立页面而非通用推荐模板");
assert.match(app, /<h1>文件夹<\/h1>[\s\S]*共 \{\{ filteredLocalFolders\.length \}\} 个文件夹/, "文件夹页标题旁应显示筛选后的文件夹数量");
assert.match(app, /v-model="localFolderSearchKeyword"[\s\S]*placeholder="搜索歌曲、歌手、专辑或文件夹"/, "文件夹页右上角应提供指定搜索框");
assert.match(app, /v-for="folder in filteredLocalFolders"[\s\S]*class="local-folder-card"[\s\S]*@click="openLocalFolder\(folder\)"/, "文件夹应以可点击卡片网格展示");
assert.match(app, /folder\.coverUrl[\s\S]*resolveBackendUrl\(folder\.coverUrl\)[\s\S]*folder\.tracks\.length \}\} 首/, "文件夹卡片应展示歌曲封面和歌曲总数");
assert.match(app, /class="local-folder-back"[\s\S]*closeLocalFolderDetail[\s\S]*class="local-folder-track-list"/, "文件夹详情应支持返回并显示歌曲列表");
assert.match(app, /function playLocalFolderTrack\(track: Track\)[\s\S]*selectedLocalFolder\.value\?\.tracks[\s\S]*playbackQueue\.value[\s\S]*playTrack\(track\)/, "点击详情歌曲时应以当前文件夹歌曲建立播放队列");

assert.match(app, /\.local-folder-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,minmax\(180px,220px\)\)/, "文件夹卡片应使用稳定尺寸的响应式网格");
assert.match(app, /\.local-folder-card:hover\s*\{[^}]*transform:\s*translateY\(-4px\)[^}]*box-shadow:/, "文件夹卡片悬浮时应轻微上浮并加深阴影");
assert.match(app, /activeView !== 'folders'/, "通用内容模板应排除文件夹页面");

console.log("本地文件夹页面契约通过");
