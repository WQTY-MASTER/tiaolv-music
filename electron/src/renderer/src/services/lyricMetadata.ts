export interface LyricCredit {
  label: string;
  value: string;
  time?: number;
}

const timingPattern = /\[(?:\d+,\d+|\d{1,3}:\d{2}(?:[.:]\d{1,3})?(?:,\d+)?)\]/gu;
const clockTimingPattern = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?(?:,\d+)?\]/u;
const creditPattern = /^(.+?)\s*[:：]\s*(.*)$/u;
const creditHints = [
  "作词", "作曲", "编曲", "制作人", "监制", "混音", "母带", "企划", "录音",
  "和声", "吉他", "贝斯", "鼓手", "弦乐", "合唱", "演唱", "乐器独奏",
  "录音监督", "出品", "助理", "谱务", "承办人", "录音棚", "录音师",
  "lyricist", "composer", "arranger", "producer", "vocal", "mixing",
  "mastering", "instrument", "guitar", "bass", "drum", "studio",
  "recording", "contractor", "supervisor", "assistant", "scoring", "produced"
];

export function parseLyricCredits(raw: string | undefined): LyricCredit[] {
  if (!raw) {
    return [];
  }

  const credits = new Map<string, LyricCredit>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const credit = line.startsWith("{")
      ? parseMetadataJson(line)
      : parseCreditText(line.replace(timingPattern, "").trim(), parseClockTime(line));
    if (!credit) {
      continue;
    }

    const key = `${credit.label}\u0000${credit.value}`;
    if (!credits.has(key)) {
      credits.set(key, credit);
    }
  }

  return [...credits.values()];
}

export function normalizeLyricCredits(raw: unknown): LyricCredit[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Record<string, unknown>;
    const label = String(candidate.label ?? "").trim();
    if (!label) {
      return [];
    }
    const time = normalizeTime(candidate.time);
    return [{
      label,
      value: String(candidate.value ?? "").trim(),
      ...(time === undefined ? {} : { time })
    }];
  });
}

export function isLyricMetadataText(text: string) {
  return parseCreditText(text.trim()) !== null;
}

function parseMetadataJson(line: string): LyricCredit | null {
  try {
    const metadata = JSON.parse(line) as { t?: unknown; c?: Array<{ tx?: unknown }> };
    if (!Array.isArray(metadata.c)) {
      return null;
    }
    const text = metadata.c
      .map((chunk) => typeof chunk?.tx === "string" ? chunk.tx : "")
      .join("")
      .trim();
    return parseCreditText(text, normalizeTime(metadata.t, 1000));
  } catch {
    return null;
  }
}

function parseCreditText(text: string, time?: number): LyricCredit | null {
  const match = text.match(creditPattern);
  if (!match) {
    return null;
  }

  const label = match[1].trim();
  const normalized = label.toLocaleLowerCase();
  if (!creditHints.some((hint) => normalized.includes(hint))) {
    return null;
  }

  return {
    label,
    value: match[2].trim(),
    ...(time === undefined ? {} : { time })
  };
}

function parseClockTime(line: string) {
  const match = line.match(clockTimingPattern);
  if (!match) {
    return undefined;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? Number(match[3]) / (10 ** match[3].length) : 0;
  return normalizeTime(minutes * 60 + seconds + fraction);
}

function normalizeTime(value: unknown, divisor = 1) {
  const time = typeof value === "number" ? value / divisor : Number(value) / divisor;
  return Number.isFinite(time) && time >= 0 ? time : undefined;
}
