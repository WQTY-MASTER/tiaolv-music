const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(electronRoot, "..");
const devScript = fs.readFileSync(path.join(electronRoot, "scripts/dev.cjs"), "utf8");
const workspaceConfig = fs.readFileSync(path.join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

assert.match(
  workspaceConfig,
  /onlyBuiltDependencies:\s+[\s\S]*- electron\s+[\s\S]*- electron-winstaller\s+[\s\S]*- esbuild/,
  "pnpm 应允许 Electron 和构建工具执行安装脚本"
);
assert.match(devScript, /require\("electron"\)/, "开发启动器应通过 Electron 包解析可执行文件");
assert.match(devScript, /existsSync\(electronPath\)/, "启动前应验证 Electron 可执行文件存在");
assert.match(devScript, /pnpm install/, "Electron 缺失时应提供明确修复命令");
assert.doesNotMatch(devScript, /Start-Process|Wait-Process/, "不应通过 PowerShell 包装 Electron 启动流程");

console.log("Electron 开发启动契约通过");
