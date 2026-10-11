const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const solutionConfig = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"));
assert.equal(solutionConfig.compilerOptions?.target, "ES2022", "渲染端应使用 Electron 支持的 ES2022 类型库");
assert.ok(solutionConfig.compilerOptions?.lib?.includes("ES2022"), "渲染端类型库应识别 Array.prototype.at");
assert.ok(solutionConfig.compilerOptions?.lib?.includes("DOM"), "渲染端应保留浏览器 API 类型");
assert.ok(
  solutionConfig.include?.includes("src/renderer/src/**/*.d.ts"),
  "渲染端配置应包含 env.d.ts 中的 window.listenMusic 声明"
);
assert.ok(
  solutionConfig.include?.includes("src/renderer/src/**/*.vue"),
  "根 tsconfig 应覆盖 Vue 单文件组件，避免 IDE 将 App.vue 放入默认推断项目"
);

console.log("渲染端 TypeScript 配置契约通过");
