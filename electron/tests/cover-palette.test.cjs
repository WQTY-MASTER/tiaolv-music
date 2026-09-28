const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/coverPalette.ts");

async function run() {
  const {
    createSoftCoverPalette,
    ensureReadableAccent,
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

  const mostlyNeutralPastelPixels = new Uint8ClampedArray([
    ...repeatPixel([231, 220, 230, 255], 6),
    ...repeatPixel([221, 168, 217, 255], 4)
  ]);
  const [pastelPrimary] = selectRepresentativeColors(mostlyNeutralPastelPixels);
  assert.equal(pastelPrimary, "#dda8d9", "彩色封面不应把数量略多的近灰背景误判为主色");

  const readablePink = ensureReadableAccent("#e7b7dc");
  const [pinkRed, pinkGreen, pinkBlue] = hexChannels(readablePink);
  assert.ok(pinkRed - pinkGreen >= 30 && pinkBlue - pinkGreen >= 20, "浅粉色加深后应保留粉色倾向而不是变成灰褐色");
  assert.ok(contrastAgainstWhite(readablePink) >= 4.5, "保留色相后的粉色仍应满足白色图标可读性");

  const palette = createSoftCoverPalette(primary, secondary);
  for (const color of Object.values(palette)) {
    assert.match(color, /^#[0-9a-f]{6}$/, "环境色板只能输出可直接用于 CSS 的颜色");
  }
  assert.notEqual(palette.pageStart, palette.playerStart, "页面与播放器应使用不同白色混合强度");

  const lightPalette = createSoftCoverPalette("#ffffff", "#f8f8f8");
  assert.ok(contrastAgainstWhite(lightPalette.accentPrimary) >= 4.5, "过浅主色应自动加深到白色图标清晰可读");
  assert.ok(contrastAgainstWhite(lightPalette.accentSecondary) >= 4.5, "过浅辅助色应自动加深以保持滑块可见");

  console.log("封面环境色逻辑通过");
}

function repeatPixel(pixel, count) {
  return Array.from({ length: count }, () => pixel).flat();
}

function hexChannels(color) {
  return color.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));
}

function contrastAgainstWhite(color) {
  const channels = hexChannels(color).map((channel) => channel / 255);
  const luminance = channels
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return 1.05 / (luminance + 0.05);
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
