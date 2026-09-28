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

export function getPreludeEndTime(
  firstLyricTime: number,
  playbackDuration: number,
  hasLyrics: boolean
) {
  if (hasLyrics) {
    return Number.isFinite(firstLyricTime) && firstLyricTime > 2 ? firstLyricTime : 0;
  }
  return Number.isFinite(playbackDuration) && playbackDuration > 0 ? playbackDuration : 0;
}

export function stabilizeLyricCharacterProgress(
  previousProgress: number,
  nextProgress: number,
  allowRewind = false
) {
  const safePrevious = Number.isFinite(previousProgress) ? Math.max(0, previousProgress) : 0;
  const safeNext = Number.isFinite(nextProgress) ? Math.max(0, nextProgress) : safePrevious;
  return allowRewind ? safeNext : Math.max(safePrevious, safeNext);
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

  return 0;
}

export function getLyricCharacterProgress(time: number, lines: LyricLine[]) {
  const activeIndex = findActiveLyricIndex(time, lines);
  if (activeIndex < 0) {
    return 0;
  }

  const line = lines[activeIndex];
  const characterCount = Array.from(line.text).length;
  if (characterCount === 0 || time < line.time) {
    return 0;
  }

  if (line.characters?.length) {
    const startedCount = findCharacterCountAtTime(line.characters, time);
    if (startedCount === 0) {
      return 0;
    }
    const characterIndex = Math.min(startedCount - 1, line.characters.length - 1);
    const character = line.characters[characterIndex];
    const nextStart = line.characters[characterIndex + 1]?.start;
    const duration = Math.max(
      0.001,
      character.duration || (nextStart !== undefined ? nextStart - character.start : 0.35)
    );
    const fill = Math.max(0, Math.min(1, (time - character.start) / duration));
    return Math.min(characterCount, characterIndex + fill);
  }

  if (line.characterTimes?.length) {
    const startedCount = findCharacterCountAtTime(line.characterTimes, time);
    if (startedCount === 0) {
      return 0;
    }
    const characterIndex = Math.min(startedCount - 1, line.characterTimes.length - 1);
    const start = line.characterTimes[characterIndex];
    const nextLine = lines[activeIndex + 1];
    const end = line.characterTimes[characterIndex + 1]
      ?? Math.min(nextLine?.time ?? start + 0.6, start + 0.6);
    const fill = Math.max(0, Math.min(1, (time - start) / Math.max(0.001, end - start)));
    return Math.min(characterCount, characterIndex + fill);
  }

  return 0;
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
