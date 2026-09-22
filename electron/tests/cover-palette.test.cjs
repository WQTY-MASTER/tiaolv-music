const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/coverPalette.ts");

async function run() {
  const {
    createSoftCoverPalette,
    mixHexWithWhite,
    selectRepresentativeColors
  } = await import(pathToFileUrl(sourcePath));

  assert.equal(mixHexWithWhite("#803020", 0.8), "#e6d6d2", "封面颜色应与白色混合为浅色");
  assert.equal(mixHexWithWhite("invalid", 0.8), "#f4f6f8", "无效颜色应返回安全浅色");

  const pixels = new Uint8ClampedArray([
    190, 45, 42, 255,
    192, 46, 44, 255,
    188, 42, 40, 255,
    38, 82, 172, 255,
    40, 84, 174, 255,
    255, 255, 255, 255,
    5, 5, 5, 255,
    190, 45, 42, 20
  ]);
  const [primary, secondary] = selectRepresentativeColors(pixels);
  assert.match(primary, /^#[0-9a-f]{6}$/, "主色应输出十六进制颜色");
  assert.match(secondary, /^#[0-9a-f]{6}$/, "辅色应输出十六进制颜色");
  assert.notEqual(primary, secondary, "封面中的明显异色应被保留为两种代表色");

  const palette = createSoftCoverPalette(primary, secondary);
  for (const color of Object.values(palette)) {
    assert.match(color, /^#[0-9a-f]{6}$/, "环境色板只能输出可直接用于 CSS 的颜色");
  }
  assert.notEqual(palette.pageStart, palette.playerStart, "页面与播放器应使用不同白色混合强度");

  console.log("封面环境色逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
