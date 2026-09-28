export interface CoverPalette {
  pageStart: string;
  pageEnd: string;
  playerStart: string;
  playerEnd: string;
  accentPrimary: string;
  accentSecondary: string;
}

type Rgb = [number, number, number];

const SAFE_LIGHT_COLOR = "#f4f6f8";
const SAFE_ACCENT_COLOR = "#68369a";

function parseHexColor(color: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([red, green, blue]: Rgb) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorDistance(left: Rgb, right: Rgb) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function rgbToHsl([red, green, blue]: Rgb): [number, number, number] {
  const [r, g, b] = [red, green, blue].map((channel) => channel / 255);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum) return [0, 0, lightness];

  const delta = maximum - minimum;
  const saturation = lightness > 0.5
    ? delta / (2 - maximum - minimum)
    : delta / (maximum + minimum);
  let hue = maximum === r
    ? (g - b) / delta + (g < b ? 6 : 0)
    : maximum === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  hue /= 6;
  return [hue, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  if (saturation === 0) {
    return [lightness * 255, lightness * 255, lightness * 255];
  }

  const upper = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const lower = 2 * lightness - upper;
  const channel = (offset: number) => {
    let value = hue + offset;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return lower + (upper - lower) * 6 * value;
    if (value < 1 / 2) return upper;
    if (value < 2 / 3) return lower + (upper - lower) * (2 / 3 - value) * 6;
    return lower;
  };
  return [channel(1 / 3) * 255, channel(0) * 255, channel(-1 / 3) * 255];
}

function relativeLuminance([red, green, blue]: Rgb) {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linearRed * 0.2126 + linearGreen * 0.7152 + linearBlue * 0.0722;
}

export function ensureReadableAccent(color: string, minimumContrast = 4.5) {
  const parsed = parseHexColor(color) ?? parseHexColor(SAFE_ACCENT_COLOR)!;
  const [hue, saturation, initialLightness] = rgbToHsl(parsed);
  let adjusted = parsed;
  let lightness = initialLightness;

  while (1.05 / (relativeLuminance(adjusted) + 0.05) < minimumContrast) {
    lightness = Math.max(0, lightness - 0.02);
    adjusted = hslToRgb(hue, saturation, lightness);
  }

  return toHex(adjusted);
}

export function mixHexWithWhite(color: string, whiteAmount: number) {
  const rgb = parseHexColor(color);
  if (!rgb) return SAFE_LIGHT_COLOR;
  const amount = Math.min(1, Math.max(0, whiteAmount));
  return toHex(rgb.map((channel) => channel + (255 - channel) * amount) as Rgb);
}

export function selectRepresentativeColors(pixels: Uint8ClampedArray): [string, string] {
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const lightness = (maximum + minimum) / 2;

    if (alpha < 96 || lightness < 24 || lightness > 244) continue;

    const key = `${Math.round(red / 32)}:${Math.round(green / 32)}:${Math.round(blue / 32)}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  const colors = [...buckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      rgb: [bucket.red / bucket.count, bucket.green / bucket.count, bucket.blue / bucket.count] as Rgb
    }))
    .sort((left, right) => right.count - left.count);

  if (!colors.length) return ["#8ea9b5", "#c4979a"];

  const chromaticColors = colors.filter(({ count, rgb }) => (
    Math.max(...rgb) - Math.min(...rgb) >= 24
    && count >= colors[0].count * 0.08
  ));
  const primaryColor = chromaticColors[0] ?? colors[0];
  const primary = primaryColor.rgb;
  const secondary = colors.filter((color) => color !== primaryColor).sort((left, right) => (
    colorDistance(right.rgb, primary) * Math.sqrt(right.count)
    - colorDistance(left.rgb, primary) * Math.sqrt(left.count)
  ))[0]?.rgb ?? [primary[2], primary[0], primary[1]] as Rgb;

  return [toHex(primary), toHex(secondary)];
}

export function createSoftCoverPalette(primary: string, secondary: string): CoverPalette {
  return {
    pageStart: mixHexWithWhite(primary, 0.8),
    pageEnd: mixHexWithWhite(secondary, 0.86),
    playerStart: mixHexWithWhite(primary, 0.9),
    playerEnd: mixHexWithWhite(secondary, 0.82),
    accentPrimary: ensureReadableAccent(primary),
    accentSecondary: ensureReadableAccent(secondary)
  };
}

export async function extractCoverPalette(coverUrl: string): Promise<CoverPalette | null> {
  if (!coverUrl || typeof Image === "undefined" || typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const image = new Image();
    if (!/^(?:data:|blob:|file:)/i.test(coverUrl)) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const [primary, secondary] = selectRepresentativeColors(pixels);
        resolve(createSoftCoverPalette(primary, secondary));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = coverUrl;
  });
}
