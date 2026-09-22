# 流媒体歌手详情页设计

## 目标

让在线搜索的“歌手”卡片可点击，并打开与现有搜索页和主页风格一致的歌手详情页；详情页支持歌手信息、关注状态、播放控制、分类 Tab 和歌曲列表。

## 现有边界

- `electron/src/renderer/src/components/StreamingSearchPage.vue` 负责搜索结果的歌手卡片展示，目前歌手卡片不可交互。
- `electron/src/renderer/src/App.vue` 持有在线搜索状态、当前视图、播放队列和页面横向过渡。
- `electron/src/renderer/src/services/api.ts` 负责 Electron 渲染层到 Spring Boot `/catalog/**` 接口的请求封装。
- 歌曲播放继续复用 `App.vue` 现有 `playTrack` / 在线歌曲转换逻辑，不新建播放器状态。

## 方案

新增独立组件 `StreamingArtistDetailPage.vue`，由 `App.vue` 在流媒体模式下根据 `selectedStreamingArtist` 渲染。搜索页通过 `selectArtist` 事件把搜索结果中的歌手 ID、名称、头像和统计信息交给 `App.vue`，由父组件请求详情数据并控制返回。

详情页首次进入时并行请求：

1. `/catalog/artist/detail?id={id}` 获取头像、名称、简介等资料；接口无数据时回退到搜索卡片资料。
2. `/catalog/artist/top/song?id={id}` 获取默认热门歌曲。
3. `/catalog/artist/sublist` 判断歌手是否已关注；未登录或请求失败时只禁用关注状态同步，不阻断歌曲浏览。
4. 需要切换专辑或创建歌单时，再按 Tab 请求对应接口，避免首次进入重复加载无关数据。

详情页 Tab 采用 `songs`、`albums`、`playlists` 三态。歌曲 Tab 展示序号、封面、歌曲名/歌手、专辑、时长和收藏按钮；点击整行复用既有在线播放逻辑。播放全部和随机播放调用现有队列方法。关注按钮调用 `/catalog/artist/sub?id={id}&t=1|0`，成功后更新本地按钮状态。

## 页面交互

- 返回按钮调用父组件 `back`，恢复之前的搜索结果页和搜索分页状态。
- 详情页进入和离开沿用 App 根部的横向 `Transition`，不改动底部播放栏。
- 页面顶部使用与主页一致的纵向间距；内容区使用宽列表和低对比度背景，避免新增厚重卡片。
- 加载、错误、空数据分别显示稳定的状态区域；单个附加接口失败不影响已加载的歌曲列表。

## 验证

- 新增契约测试，验证歌手卡片发出选择事件、详情页存在三类 Tab、接口封装带有歌手 ID、关注参数和歌曲列表字段。
- 运行新增契约测试、前端已有测试和 `npm run build`。
