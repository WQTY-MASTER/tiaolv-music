# 本地诊断包与选中文字实现计划

> **For agentic workers:** Use superpowers:executing-plans for inline execution. Steps use checkbox syntax.

**Goal:** 实现手动脱敏诊断 ZIP，并修正引导页选中按钮对比度。

**Architecture:** 主进程负责受限日志文件、脱敏、滚动和 ZIP 导出。前端及本地
服务通过固定诊断事件提供错误上下文，导出不扫描用户数据。配色使用独立
对比度函数，并通过组件 CSS 变量统一应用到选中态。

**Tech Stack:** Electron、Vue、TypeScript、Node 测试、fflate ZIP。

## 1. 诊断核心

Files: `electron/src/main/diagnostics.ts`, `electron/src/shared/diagnostics.ts`,
`electron/tests/diagnostics.test.cjs`, `electron/package.json`, `pnpm-lock.yaml`。

- [x] 先编写测试覆盖 Cookie/票据/查询参数/个人路径脱敏、限额和固定 ZIP 内容；
  `node --experimental-transform-types --test electron/tests/diagnostics.test.cjs`
  首次应失败于模块缺失。
- [x] 使用固定六类日志、每类三个 1 MiB 文件、有限队列和单条长度，拒绝链接。
  实现接口 `write(channel, event, detail)`, `flush()`, `exportBundle(file, summary)`。
  ZIP 库只压缩允许列表文件；写入失败不抛到业务调用方，导出失败明确报错。
- [x] 运行同一命令，预期全部通过。

## 2. 接入与导出

Files: `main.ts`, `serviceRuntime.ts`, `appUpdates.ts`, `preload.ts`,
`renderer/src/env.d.ts`, `renderer/src/main.ts`, `renderer/src/services/api.ts`,
`renderer/src/services/diagnostics.ts`, `AboutSettings.vue`。

- [x] 在服务、更新和安全桥接测试中增加失败案例，先运行确认未接入时失败。
- [x] 捕获服务错误行/退出码、主进程崩溃、渲染进程异常及 API 失败上下文；
  不记录完整 URL、请求体、响应体或正常播放内容。输出按行拼接，长行丢弃。
- [x] 对上报 IPC 验证可信窗口主框架、字段与速率；导出仅允许主窗口，保存
  对话框取消不创建文件。概要允许主题色/缩放/尺寸，不包含背景路径。
- [x] “关于”增加导出按钮、处理中/成功/取消/失败状态，保留复制版本信息。
- [x] 运行诊断、服务运行器、更新及关于契约专项测试。

## 3. 选中文字

Files: `renderer/src/services/colorContrast.ts`, `FirstRunOnboarding.vue`,
`electron/tests/color-contrast.test.cjs`。

- [x] 先测试默认绿、预设色、黑/白和无效值；对比度至少 4.5:1。
- [x] 使用 WCAG 相对亮度计算选择黑或白文字，设置 `--onboarding-accent-text`；
  应用于填色选中态与继续按钮，最后覆盖深色普通按钮的灰字样式。
- [x] 运行颜色专项测试，实际页面核对默认绿音质／缓存按钮，以及浅色／深色
  七种主题色的密度和继续按钮；深色关于页另核对实际文字对比度。

## 4. 验证与说明

- [x] 运行类型检查和生产构建，预期通过。
- [x] 隔离测试数据，真实导出并解压检查 ZIP；不读取用户账号或修改收藏。
- [x] Playwright 核对“关于”导出按钮状态以及深色引导页桌面/窄窗口截图。
- [x] 在中文反馈说明中记录“复现 → 导出 ZIP → 附截图和步骤”的流程。
- [x] 汇总已完成验证、残余限制；不替换已发布的 0.1.3，也不自动发布 Release。

## 验证记录

- 诊断与颜色：8 项测试及桥接契约通过。
- 更新与关于：19 项测试及页面契约通过。
- 服务运行器：14 项测试通过；API 页面缓存：11 项测试通过。
- 引导、迷你窗口、弹出窗口安全、品牌／分发命名契约通过。
- 类型检查、生产构建和隔离 Electron 诊断导出验收通过。
- 截图位于本地忽略目录 `electron/.playwright-cli/diagnostics-*.png`。
- 未做真实账号写入，未修改已发布安装包，未发布新 Release。
- 显示器亮度／HDR 不自动采集；第三方未知格式私人信息仍需分享前人工检查。
