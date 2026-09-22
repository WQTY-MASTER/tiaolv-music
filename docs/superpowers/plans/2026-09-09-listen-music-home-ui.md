# 倾听音乐首页界面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在现有 Vue 3 + Vite 渲染层中实现一个参考 QQ 音乐与 YesPlayMusic 信息层级的“倾听音乐”首页原型。

**架构：** 保留现有 Electron/Vite 入口和 Java 后端接口。首页由 Vue 组件负责布局、交互和演示数据；后端连接状态继续通过现有 `/health` 接口显示。后续再将演示歌曲、歌单和播放动作替换为 Java API。

**技术栈：** Vue 3、TypeScript、Vite、Electron renderer、CSS。

---

### 任务 1：建立首页展示模型和可复用组件

**文件：**
- 创建：`electron/src/renderer/src/components/SidebarNav.vue`
- 创建：`electron/src/renderer/src/components/PlaylistCard.vue`
- 创建：`electron/src/renderer/src/components/PlayerBar.vue`

- [ ] 定义导航项、歌单卡片和歌曲信息所需的最小 props/emits。
- [ ] 使用 CSS 封面样式承载演示图片效果，后续允许替换为真实封面 URL。
- [ ] 为导航、播放暂停、喜欢、音量和歌单卡片点击提供交互事件。

### 任务 2：替换首页外壳

**文件：**
- 修改：`electron/src/renderer/src/App.vue`

- [ ] 使用左侧窄导航、顶部搜索、推荐区、歌单网格和底部播放器组成主布局。
- [ ] 保留 `pingBackend`、`loadLibrary`、`searchCatalog`，后端为空时回退到演示数据。
- [ ] 支持首页、发现、音乐库、喜欢和播放历史的前端视图状态切换。
- [ ] 支持关键词过滤演示歌曲和歌单。
- [ ] 保持桌面端优先，同时在窄屏下压缩导航和网格。

### 任务 3：验证浏览器开发体验

**文件：**
- 不新增文件。

- [ ] 执行 `npm run build`，确认 Electron renderer 可以编译。
- [ ] 执行 `npm run serve`，确认 `http://127.0.0.1:5173/` 返回页面。
- [ ] 使用浏览器检查首页、搜索、播放暂停和底部播放器没有布局溢出。
