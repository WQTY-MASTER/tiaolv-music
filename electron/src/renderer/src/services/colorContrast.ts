function luminance(color: string): number {
  const normalized = /^#[a-f0-9]{6}$/i.test(color) ? color : "#2dd4a7";
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(normalized.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableAccentText(background: string): string {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}
