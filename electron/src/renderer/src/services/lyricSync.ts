export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
  characters?: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  characterTimes?: number[];
}

export interface LyricHighlightState {
  activeIndex: number;
  characterCount: number;
}

export function findCharacterCountAtTime(
  characterTimes: number[] | LyricLine["characters"],
  time: number
) {
  const firstCharacter = characterTimes?.[0];
  const starts = typeof firstCharacter === "number"
    ? characterTimes as number[]
    : characterTimes?.map((character) => character.start) ?? [];
  let low = 0;
  let high = starts.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

export function findActiveLyricIndex(time: number, lines: LyricLine[]) {
  let low = 0;
  let high = lines.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= time) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
}

export function getPrefaceCharacterCount(time: number, firstLyricTime: number, characterCount: number) {
  if (
    !Number.isFinite(time)
    || !Number.isFinite(firstLyricTime)
    || firstLyricTime <= 0
    || characterCount <= 0
    || time < 0
    || time >= firstLyricTime
  ) {
    return 0;
  }

  return Math.min(characterCount, Math.max(0, Math.floor((time / firstLyricTime) * characterCount)));
}

export function getPrefaceLineStartTime(
  firstLyricTime: number,
  lineCount: number,
  lineIndex: number
) {
  if (
    !Number.isFinite(firstLyricTime)
    || firstLyricTime <= 0
    || !Number.isInteger(lineCount)
    || lineCount <= 0
    || !Number.isInteger(lineIndex)
    || lineIndex < 0
    || lineIndex >= lineCount
  ) {
    return undefined;
  }

  return (firstLyricTime / lineCount) * lineIndex;
}

export function createPrefaceLineTimes(
  firstLyricTime: number,
  creditTimes: Array<number | undefined>
) {
  const lineTimes = [0, ...creditTimes.map((time) => time ?? 0)];
  const zeroCreditIndexes = creditTimes
    .map((time, index) => time === 0 ? index + 1 : -1)
    .filter((index) => index >= 0);

  if (zeroCreditIndexes.length === 0) {
    return lineTimes;
  }

  const firstPositiveTime = lineTimes.find((time) => time > 0);
  const availableOpeningTime = Math.min(
    firstPositiveTime ?? Number.POSITIVE_INFINITY,
    firstLyricTime > 0 ? firstLyricTime : Number.POSITIVE_INFINITY
  );
  const step = Math.min(0.5, availableOpeningTime / (zeroCreditIndexes.length + 1));

  zeroCreditIndexes.forEach((lineIndex, index) => {
    lineTimes[lineIndex] = step * (index + 1);
  });

  return lineTimes;
}

export function getPrefaceHighlightState(
  time: number,
  firstLyricTime: number,
  lineCharacterCounts: number[],
  lineStartTimes?: number[]
) {
  if (
    !Number.isFinite(time)
    || !Number.isFinite(firstLyricTime)
    || firstLyricTime <= 0
    || lineCharacterCounts.length === 0
    || time < 0
    || time >= firstLyricTime
  ) {
    return { activeIndex: -1, characterCount: 0 };
  }

  const fallbackLineDuration = firstLyricTime / lineCharacterCounts.length;
  const starts = lineStartTimes?.length === lineCharacterCounts.length
    ? lineStartTimes
    : lineCharacterCounts.map((_, index) => index * fallbackLineDuration);
  let activeIndex = -1;
  for (let index = 0; index < starts.length; index += 1) {
    if (starts[index] <= time) {
      activeIndex = index;
    } else {
      break;
    }
  }
  if (activeIndex < 0) {
    return { activeIndex: -1, characterCount: 0 };
  }

  const lineStart = starts[activeIndex];
  const lineDuration = Math.max(0.001, (starts[activeIndex + 1] ?? firstLyricTime) - lineStart);
  const lineCharacterCount = Math.max(0, lineCharacterCounts[activeIndex] ?? 0);
  const elapsed = Math.max(0, Math.min(lineDuration, time - lineStart));

  return {
    activeIndex,
    characterCount: Math.min(
      lineCharacterCount,
      Math.max(0, Math.floor((elapsed / lineDuration) * lineCharacterCount))
    )
  };
}

function lyricCharacterProgressAtTime(
  line: LyricLine,
  lineIndex: number,
  time: number,
  activeIndex: number,
  lines: LyricLine[]
) {
  if (lineIndex !== activeIndex || !line.text.length || time < line.time) {
    return 0;
  }

  if (line.characterTimes?.length) {
    return findCharacterCountAtTime(line.characterTimes, time);
  }

  if (line.characters?.length) {
    return findCharacterCountAtTime(line.characters, time);
  }

  // 普通 LRC 只有句首时间，先把句间时间平滑分配给当前句字符。
  const nextLine = lines[lineIndex + 1];
  const characterCount = Array.from(line.text).length;
  const fallbackDuration = Math.max(2, Math.min(8, characterCount * 0.38));
  const lineDuration = Math.max(0.6, (nextLine?.time ?? line.time + fallbackDuration) - line.time);
  const elapsed = Math.max(0, Math.min(lineDuration, time - line.time));
  const progress = Math.floor((elapsed / lineDuration) * characterCount);

  return Math.min(characterCount, Math.max(1, progress));
}

export function getLyricHighlightState(time: number, lines: LyricLine[]): LyricHighlightState {
  const activeIndex = findActiveLyricIndex(time, lines);
  if (activeIndex < 0) {
    return { activeIndex, characterCount: 0 };
  }

  return {
    activeIndex,
    characterCount: lyricCharacterProgressAtTime(
      lines[activeIndex],
      activeIndex,
      time,
      activeIndex,
      lines
    )
  };
}
