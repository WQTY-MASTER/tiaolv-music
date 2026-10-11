# IDEA 检查修复进度

日期：2026-10-09

## 检查基准

初始根目录 `index.html` 是 IDEA 导出的检查报告，大小约 650 MB，报告标记 13,621 项。
它是静态快照，修复源代码不会自动更新报告，需要在 IDEA 中重新运行检查。
报告包含 `.test-tmp` 的构建产物、第三方 API 项目、代码风格建议和可能的误报。
每批以当前源代码和实际验证结果为准，不直接修改生成文件或删除报告条目。

## 第一批：已完成

处理检查类别：Java / 使用 API 标记为删除。

将以下 7 个测试类的 `org.springframework.boot.test.mock.mockito.MockBean`
替换为 `org.springframework.test.context.bean.override.mockito.MockitoBean`：

- `AccountControllerTest`
- `AuthControllerTest`
- `CacheControllerTest`
- `CatalogControllerTest`
- `CloudControllerTest`
- `LibraryControllerTest`
- `PlaybackControllerTest`

共替换 7 处导入和 9 处注解，对应报告中的 16 处弃用错误。
原有测试断言和接口行为保持不变。
依据：[Spring Boot 官方 MockBean 文档](https://docs.spring.io/spring-boot/3.5/api/java/org/springframework/boot/test/mock/mockito/MockBean.html)。

验证：7 个测试类共 70 个用例，失败 0、错误 0、跳过 0；编译未再提示 `MockBean` 待删除。
当前渲染端 `vue-tsc --noEmit -p electron/tsconfig.json` 检查通过。
`git diff --check` 对本批涉及的测试文件检查通过。
沙箱内无法访问 Mockito 的 Java 附加命名管道，接口测试在沙箱外离线运行。
临时验证 POM 和测试输出位于 `.test-tmp`，原项目 POM 未修改。

## 第二批：前端样式

- 三个流媒体组件补充 244 个声明末尾分号；使用 Vue/PostCSS 解析并对比 AST，属性和值未变。
- 歌词设置、歌词窗口、首次引导、迷你播放器和播放栏补充动态 CSS 变量默认值；保留内联设置的覆盖优先级。
- 移除 MiniPlayer 重复的圆角声明；QQ 登录页改用等价的单位置渐变色标。
- 修复 Chromium 确认无效的三个 `font: ... inherit` 简写，拆为字体属性。
- 修复歌词遮罩前缀渐变参数：`-webkit-linear-gradient(top, ...)`；标准渐变保留 `to bottom`。
- AboutSettings 的弃用品牌图标改用现有 Lucide `Code2` 图标。

说明：分号、只读字段、图标等整理已在用户缩小范围前完成；后续不再继续处理纯风格提示。

## 第三批：源码和测试

- 主窗口页面加载 Promise 添加失败日志；缓存路径与快捷键管理字段标记为只读。
- 根目录 `jsconfig.json` 仅为 `scripts/**/*.cjs` 声明 Node 环境，不扩大到生成的报告资源。
- 缓存 API 测试补充 Node 原生 TypeScript 导入解析，与现有快捷键测试保持相同方式。
- 更新旧 CSS/多平台歌单排序契约断言，兼容当前 margin 简写及账号平台，不回退原有布局和业务代码。
- 删除五处无用 Java 导入；改用 Jackson `properties()`；处理 Mockito 泛型可变参数警告。
- 数据库计数查询显式检查非空；三个数据库测试在清理时销毁数据源。
- 简化两处 ResponseEntity 类型实参、空集合判断与空值过滤。

## 第四批：IDE 检查范围

`.idea/倾听音乐.iml` 的内容根目录从 `.idea` 改为项目根目录。
通过结构化 XML 修改，增加 26 个依赖、构建产物和临时目录排除项。
包括 `.test-tmp`、`node_modules`、`electron/out`、`electron/out-verify` 等。
业务源码仍参与检查，没有关闭检查规则。IDE 配置属于本机忽略文件。

## 第五批：API 示例和缓存

- API 请求参数输入、一起听房间输入、听歌打卡输入、歌单导入的静态和动态输入补充关联标签。
- 修复请求调试页两处重复变量名；移除三个被 overflow 简写覆盖的声明。
- 听歌识曲示例补齐 html 起始标签、调整 body 结束位置，并给文件输入补充标签。
- QQ API 的 `tab_width` 改为有效整数 `2`；未改动 QQ API 业务源码。
- 修复 `util/apicache.js` 的循环计数器 `j` 未声明问题，避免覆盖全局变量。
- 新增缓存统计回归测试：修复前确实将全局哨兵值覆盖为 `4`，修复后通过。

## 第六批：窗口安全

主窗口与歌词窗口在加载内容前设置 `setWindowOpenHandler`，拒绝页面自行创建弹窗。
现有外部链接仍经 `shell.openExternal` 打开系统浏览器。
新增回归契约测试，验证两个窗口及安装时机，并加入常规前端测试命令。
此修改属于官方建议的弹窗类漏洞缓解，不代表 Electron 全部漏洞已经修复。
依据：[Electron 官方公告](https://github.com/electron/electron/security/advisories/GHSA-gr2m-v5gq-v685)。

## 最新验证

- 后端全部 255 个测试通过，失败 0、错误 0、跳过 0。
- 前端 80 组测试命令通过，包括原有测试、CSS/类型契约和新增窗口安全测试。
- 渲染端、主进程、preload 与根目录脚本的四项 TypeScript 检查通过。
- Chromium 检查 13,040 个样式声明，没有发现新的无效声明；两个兼容性回退属性单独排除。
- 六组动态 CSS 设置覆盖默认值的浏览器检查通过。
- 八个 API 示例的静态表单标签及八段内联 JavaScript 语法检查通过；没有调用真实音乐服务接口。
- 网易 API 离线单测 4 个通过；本批缓存源码和测试文件的 ESLint 检查通过。

验证脚本和后端临时 POM 位于 `.test-tmp`。未执行需要联网和登录的上游全量集成测试。

## 后续范围与保留项

用户最新要求：非必要的 bug 不再修复。后续只处理明确影响运行、功能或安全的缺陷。

- 保留小数像素、SVG 空元素、拼写语法、可简化断言等非功能性提示。
- 保留 Vue 宏、动态属性绑定、跨组件 CSS 变量继承等已通过编译/浏览器验证的 IDE 误报。
- 保留接口参数对字符串和数字的兼容比较，不能直接改成严格比较而破坏请求兼容性。
- 保留公开接口与框架反射使用的符号；没有依据 IDE 的“未使用”提示删除业务 API。
- 不手动修改生成的 Emscripten `afp.js`、构建产物或检查报告资源。
- 依赖安全问题未全部解决，未升级依赖，也未关闭漏洞检查。

Electron 35.7.5 已结束支持；正式升级需单独验证窗口、协议、preload 和打包兼容性。
依据：[Electron 官方版本页](https://releases.electronjs.org/release/v35.7.5)。

Spring 的两项历史公告已核对：当前源码没有使用 `@EnableMethodSecurity`；
默认 Tomcat 也不符合官方描述的非合规容器条件。这不能证明所有依赖漏洞都无影响。
依据：[注解检测漏洞](https://spring.io/security/cve-2025-41249/)、
[非合规容器路径遍历漏洞](https://spring.io/security/cve-2025-41242/)。

Spring Boot 3.5.16 是 3.5 系列最后一个开源版本；后续支持需迁移到新系列或商业支持。
本轮没有进行跨版本迁移。
依据：[Spring Boot 官方发布公告](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/)。

`pkg` 的 CVE-2024-24828 官方没有补丁版本，需要替换打包方案，不能随意填一个版本号。
依据：[pkg 官方安全公告](https://github.com/vercel/pkg/security/advisories/GHSA-22r3-9w55-cj54)。

## 重新导出后的核对

用户于 2026-10-09 重新导出报告。当前 `index.html` 为 1,216,772 字节，
文件修改时间为 15:54:34，报告显示 144 个警告、3 个弱警告、2 个语法提示，共 149 项。
本次报告条目均位于后端，不能据此断言前端或第三方 API 项目的所有检查已经清零。

按报告的检查类别统计：

| 类别 | 数量 | 本轮处理 |
| --- | ---: | --- |
| 不安全字符串被用作 SQL | 1 | 已核对：拼接部分只有固定问号占位符，ID 通过参数绑定传入；不改业务代码 |
| 空方法 | 2 | 保留：异常处理器用于返回 400，暂停方法有保持恢复状态的设计说明 |
| SequencedCollection 建议 | 44 | 非必要整理，不修改 |
| 常量条件 | 3 | 已核对：重复防护与两次重试控制，不改变现有行为 |
| 形参始终同值 | 7 | 非必要整理，不修改 |
| 未使用的声明 | 47 | 不依据静态提示删除公开接口、数据模型或框架使用符号 |
| 布尔方法总是反向 | 4 | 非必要整理，不修改 |
| 可简化断言 | 19 | 非必要整理，不修改 |
| 字段可作局部变量 | 2 | 非必要整理，不修改 |
| 易受攻击的依赖 | 15 | 尚未升级，待确认安全补丁升级范围 |
| HTTP 链接 | 3 | 已核对：封面处理及既有测试包含预期 HTTP 兼容行为，不盲目替换 |
| 语法 | 2 | 注释中的英文语法提示，不是 Java 编译语法错误 |

本轮重新执行后端全部测试：255 个通过，失败 0、错误 0、跳过 0，Maven BUILD SUCCESS。
未新改动生产源码，未关闭检查规则。

依赖告警不能直接当作当前应用必然可利用的漏洞，也不能全部判定为误报。
例如报告的 CVE-2026-47891 经官方公告核对，涉及使用 Aalto XML 的 WebFlux/Jaxb2Decoder 场景；
本项目当前是 MVC，未发现上述使用方式。6.2 系列对应补丁又属于商业支持，
因此同系列公开补丁升级不保证消除全部安全提示。
依据：[Spring 官方 CVE-2026-47891 公告](https://spring.io/security/cve-2026-47891/)。

Tomcat 相关告警已查询官方安全清单；受影响版本、利用条件和官方风险评级需要逐项核实，
不能仅凭报告中的 `Insufficient Information` 和分值下结论。
依据：[Apache Tomcat 官方安全清单](https://tomcat.apache.org/security-10.html)。

已向用户询问是否继续进行同系列安全补丁升级；本轮没有擅自升级依赖或迁移到 Spring Boot 4。
