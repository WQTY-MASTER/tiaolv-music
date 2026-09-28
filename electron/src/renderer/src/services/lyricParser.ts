export interface LyricCharacter {
  text: string;
  start: number;
  duration: number;
}

export interface LyricLine {
  time: number;
  duration?: number;
  text: string;
  translation?: string;
  characters?: LyricCharacter[];
  characterTimes?: number[];
}

export interface KaraokeToken {
  text: string;
  start: number;
  duration: number;
}

type GraphemeSegmenter = new (
  locales?: string | string[],
  options?: { granularity: "grapheme" }
) => {
  segment(input: string): Iterable<{ segment: string }>;
};

const timestampPattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/gu;
const inlineTimestampPattern = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/gu;
const yrcHeaderPattern = /^\[(\d+),(\d+)\](.*)$/u;
const clockHeaderPattern = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?(?:,(\d+))?\](.*)$/u;
const yrcTimingPattern = /\((\d+),(\d+)(?:,\d+)?\)/gu;
const qrcTokenPattern = /([^()]*)\((\d+),(\d+)(?:,\d+)?\)/gu;
const inlineTranslationPattern = /^(.+?)\s+([\u4e00-\u9fff].*)$/u;
const metadataCreditPattern = /^(.+?)\s*[:：]\s*(.*)$/u;
const metadataHints = [
  "作词", "作曲", "编曲", "制作人", "监制", "混音", "母带", "企划", "录音",
  "和声", "吉他", "贝斯", "鼓手", "弦乐", "合唱", "演唱", "乐器独奏",
  "录音监督", "出品", "助理", "谱务", "承办人", "录音棚", "录音师",
  "lyricist", "composer", "arranger", "producer", "vocal", "mixing",
  "mastering", "instrument", "guitar", "bass", "drum", "studio",
  "recording", "contractor", "supervisor", "assistant", "scoring", "produced"
];

export function splitLyricCharacters(text: string): string[] {
  const segmenter = (Intl as typeof Intl & { Segmenter?: GraphemeSegmenter }).Segmenter;
  if (segmenter) {
    return Array.from(new segmenter(undefined, { granularity: "grapheme" }).segment(text), (item) => item.segment);
  }
  return Array.from(text);
}

export function parseYrcTokens(body: string): KaraokeToken[] {
  const yrcTimings = Array.from(body.matchAll(yrcTimingPattern));
  return yrcTimings.map((match, index) => {
    const textStart = (match.index ?? 0) + match[0].length;
    const textEnd = yrcTimings[index + 1]?.index ?? body.length;
    return {
      text: body.slice(textStart, textEnd),
      start: Number(match[1]) / 1000,
      duration: Number(match[2]) / 1000
    };
  }).filter((token) => token.text.length > 0);
}

export function parseQrcTokens(body: string): KaraokeToken[] {
  return Array.from(body.matchAll(qrcTokenPattern), (match) => ({
    text: match[1],
    start: Number(match[2]) / 1000,
    duration: Number(match[3]) / 1000
  })).filter((token) => token.text.length > 0);
}

export function parseKaraokeTokens(body: string): KaraokeToken[] {
  return body.trimStart().startsWith("(")
    ? parseYrcTokens(body)
    : parseQrcTokens(body);
}

export function parseLyricContent(
  raw: string | undefined,
  translationRaw?: string,
  format?: string
): LyricLine[] {
  if (!raw?.trim()) {
    return [];
  }

  const normalizedFormat = format?.trim().toUpperCase();
  const wordTimedLines = normalizedFormat === "QRC"
    ? parseQrcContent(raw)
    : normalizedFormat === "YRC"
      ? parseYrcContent(raw)
      : normalizedFormat === "LRC"
        ? []
        : detectWordTimedFormat(raw) === "YRC"
          ? parseYrcContent(raw)
          : parseQrcContent(raw);
  if (wordTimedLines.length > 0) {
    return attachTranslations(wordTimedLines, translationRaw);
  }

  return attachTranslations(parseLrcContent(raw), translationRaw);
}

export function parseYrcContent(raw: string): LyricLine[] {
  return parseWordTimedContent(raw, parseYrcTokens);
}

export function parseQrcContent(raw: string): LyricLine[] {
  return parseWordTimedContent(raw, parseQrcTokens);
}

function parseWordTimedContent(
  raw: string,
  parseTokens: (body: string) => KaraokeToken[]
): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const yrcMatch = rawLine.match(yrcHeaderPattern);
    const clockMatch = rawLine.match(clockHeaderPattern);
    if (!yrcMatch && !clockMatch) {
      continue;
    }

    const lineTime = yrcMatch
      ? Number(yrcMatch[1]) / 1000
      : parseClockTime(clockMatch?.[1] ?? "0", clockMatch?.[2] ?? "0", clockMatch?.[3]);
    const duration = yrcMatch
      ? Number(yrcMatch[2]) / 1000
      : Number(clockMatch?.[4] ?? 0) / 1000;
    const body = yrcMatch?.[3] ?? clockMatch?.[5] ?? "";
    const tokens = parseTokens(body);
    const characters = expandKaraokeTokens(tokens);
    const trimmedCharacters = trimCharacterData(characters);
    const text = trimmedCharacters.map((character) => character.text).join("");

    if (!text || isLyricMetadataText(text) || (duration > 0 && duration < 0.1)) {
      continue;
    }

    const lyricText = splitInlineTranslation(text);
    const originalCharacters = trimmedCharacters.slice(0, splitLyricCharacters(lyricText.text).length);
    if (originalCharacters.length !== splitLyricCharacters(lyricText.text).length) {
      continue;
    }

    lines.push({
      time: lineTime,
      duration: duration > 0 ? duration : undefined,
      text: lyricText.text,
      translation: lyricText.translation,
      characters: originalCharacters,
      characterTimes: originalCharacters.map((character) => character.start)
    });
  }

  return lines.sort((left, right) => left.time - right.time);
}

function detectWordTimedFormat(raw: string) {
  for (const rawLine of raw.split(/\r?\n/)) {
    const body = rawLine.match(yrcHeaderPattern)?.[3]
      ?? rawLine.match(clockHeaderPattern)?.[5];
    if (!body?.trim()) {
      continue;
    }
    return body.trimStart().startsWith("(") ? "YRC" : "QRC";
  }
  return undefined;
}

export function parseLrcContent(raw: string): LyricLine[] {
  const entries: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const matches = Array.from(rawLine.matchAll(timestampPattern));
    if (matches.length === 0) {
      continue;
    }

    const rawText = rawLine.replace(timestampPattern, "").trim();
    const text = rawText.replace(inlineTimestampPattern, "").trim();
    if (!text || isLyricMetadataText(text)) {
      continue;
    }

    const lyricText = splitInlineTranslation(text);
    for (const match of matches) {
      entries.push({
        time: parseClockTime(match[1], match[2], match[3]),
        text: lyricText.text,
        translation: lyricText.translation
      });
    }
  }

  const lines: LyricLine[] = [];
  for (const entry of entries
    .filter((line) => line.text)
    .sort((left, right) => left.time - right.time)) {
    const previous = lines[lines.length - 1];
    if (previous && previous.time === entry.time && !previous.translation) {
      previous.translation = entry.translation ?? entry.text;
      continue;
    }
    lines.push(entry);
  }

  return lines;
}

function parseClockTime(minutes: string, seconds: string, fraction?: string) {
  const fractionValue = fraction ? Number(`0.${fraction.padEnd(3, "0")}`) : 0;
  return Number(minutes) * 60 + Number(seconds) + fractionValue;
}

function expandKaraokeTokens(tokens: KaraokeToken[]): LyricCharacter[] {
  return tokens.flatMap((token) => {
    const characters = splitLyricCharacters(token.text);
    if (characters.length === 0) {
      return [];
    }

    const duration = Math.max(0, token.duration);
    const characterDuration = duration / characters.length;
    return characters.map((text, index) => ({
      text,
      start: token.start + characterDuration * index,
      duration: characterDuration
    }));
  });
}

function parseEnhancedCharacters(rawText: string, originalText: string) {
  const matches = Array.from(rawText.matchAll(inlineTimestampPattern));
  if (matches.length === 0 || !originalText) {
    return undefined;
  }

  const characters: LyricCharacter[] = [];
  for (const [index, match] of matches.entries()) {
    const segmentStart = (match.index ?? 0) + match[0].length;
    const segmentEnd = matches[index + 1]?.index ?? rawText.length;
    const segmentCharacters = splitLyricCharacters(rawText.slice(segmentStart, segmentEnd));
    if (segmentCharacters.length === 0) {
      continue;
    }

    const start = parseClockTime(match[1], match[2], match[3]);
    const nextStart = matches[index + 1]
      ? parseClockTime(matches[index + 1][1], matches[index + 1][2], matches[index + 1][3])
      : start + Math.max(0.6, segmentCharacters.length * 0.38);
    const duration = Math.max(0.05, nextStart - start);
    const characterDuration = duration / segmentCharacters.length;
    characters.push(...segmentCharacters.map((text, characterIndex) => ({
      text,
      start: start + characterDuration * characterIndex,
      duration: characterDuration
    })));
  }

  const trimmedCharacters = trimCharacterData(characters);
  const originalCharacterCount = splitLyricCharacters(originalText).length;
  return trimmedCharacters.slice(0, originalCharacterCount).length === originalCharacterCount
    ? trimmedCharacters.slice(0, originalCharacterCount)
    : undefined;
}

function trimCharacterData(characters: LyricCharacter[]) {
  let start = 0;
  let end = characters.length;
  while (start < end && /^\s$/u.test(characters[start].text)) {
    start += 1;
  }
  while (end > start && /^\s$/u.test(characters[end - 1].text)) {
    end -= 1;
  }
  return characters.slice(start, end);
}

function splitInlineTranslation(text: string) {
  if (isLyricMetadataText(text)) {
    return { text };
  }

  const match = text.match(inlineTranslationPattern);
  if (!match || !/[A-Za-z]/u.test(match[1])) {
    return { text };
  }
  return {
    text: match[1].trim(),
    translation: match[2].trim()
  };
}

function isLyricMetadataText(text: string) {
  const match = text.trim().match(metadataCreditPattern);
  if (!match) {
    return false;
  }
  const label = match[1].trim().toLocaleLowerCase();
  return metadataHints.some((hint) => label.includes(hint.toLocaleLowerCase()));
}

function parseTranslationByTime(raw: string | undefined) {
  const translations = new Map<number, string>();
  if (!raw) {
    return translations;
  }

  for (const line of raw.split(/\r?\n/)) {
    const matches = Array.from(line.matchAll(timestampPattern));
    const text = line.replace(timestampPattern, "").trim();
    if (!text) {
      continue;
    }
    for (const match of matches) {
      translations.set(parseClockTime(match[1], match[2], match[3]), text);
    }
  }
  return translations;
}

function attachTranslations(lines: LyricLine[], translationRaw?: string) {
  const translations = parseTranslationByTime(translationRaw);
  if (translations.size === 0) {
    return lines;
  }

  return lines.map((line) => {
    if (line.translation) {
      return line;
    }
    const translation = [...translations.entries()]
      .sort(([left], [right]) => Math.abs(left - line.time) - Math.abs(right - line.time))
      .find(([time]) => Math.abs(time - line.time) < 0.2)?.[1];
    return translation ? { ...line, translation } : line;
  });
}
