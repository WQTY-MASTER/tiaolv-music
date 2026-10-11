import type { LyricLine } from "./lyricParser";
import { findActiveLyricIndex, getLyricCharacterProgress } from "./lyricSync";
import { getDesktopLyricCharacterFill, getDesktopLyricHighlightMode } from "../../../shared/desktopLyrics";
import { getDesktopLyricPlaybackProgress, getDesktopLyricScrollProgress } from "./desktopLyricsOverflow";
import { projectDesktopLyricsTime } from "./desktopLyricsClock";

export function projectMiniLyricTime(time: number, anchorTimestamp: number, timestamp: number, isPlaying: boolean, duration: number) {
  const boundedTimestamp = Math.min(timestamp, anchorTimestamp + 150);
  const projected = projectDesktopLyricsTime(time, anchorTimestamp, boundedTimestamp, isPlaying);
  return duration > 0 && Number.isFinite(duration) ? Math.min(duration, projected) : projected;
}

export function getMiniLyricLineCount(height: number, rowHeight = 30, translated = false): 1 | 3 | 5 {
  return !translated && Number.isFinite(height) && height >= rowHeight * 5 ? 5 : Number.isFinite(height) && height >= rowHeight * 3 ? 3 : 1;
}

export function getMiniLyricMetrics(height: number, translated = false) {
  if (height >= 180) return { fontSize: 18, activeFontSize: 22, rowHeight: translated ? 64 : 36, lineHeight: 28, translationSize: 14, translationLineHeight: 16 };
  if (height >= 96) return { fontSize: 15, activeFontSize: 19, rowHeight: translated ? 58 : 32, lineHeight: 26, translationSize: 12, translationLineHeight: 14 };
  return { fontSize: 14, activeFontSize: 17, rowHeight: translated ? 54 : 30, lineHeight: 24, translationSize: 12, translationLineHeight: 14 };
}

export function getMiniPlayerLayout(width: number, contentHeight: number) {
  width = Number.isFinite(width) ? width : 412;
  contentHeight = Number.isFinite(contentHeight) ? contentHeight : 78;
  const coverSize = Math.round(Math.max(72, Math.min(180, 72 + Math.max(0, width - 412) * 0.36, contentHeight - 6)));
  const columnWidth = width >= 560 ? Math.max(coverSize + 12, Math.min(204, Math.round(width * 0.28))) : coverSize + 10;
  return { coverSize, columnWidth, gap: width >= 560 ? 28 : width >= 480 ? 20 : 14, padding: width >= 480 ? 22 : 14 };
}

export function shouldAnimateMiniLyricStep(previousTime: number, nextTime: number, previousIndex: number, nextIndex: number) {
  const elapsed = nextTime - previousTime;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 0.6 && previousIndex >= 0 && nextIndex === previousIndex + 1;
}

export function getMiniLyricSlots(lines: LyricLine[], activeIndex: number, count: 1 | 3 | 5) {
  const center = Math.max(0, activeIndex);
  return Array.from({ length: count }, (_, offset) => {
    const index = center + offset - Math.floor(count / 2);
    return { index, line: lines[index] ?? null, active: index === activeIndex };
  });
}

export function getMiniLyricProgress(lines: LyricLine[], time: number, duration: number, source?: string, lyricsFormat?: string, lyricsSource?: string) {
  const activeIndex = findActiveLyricIndex(time, lines);
  const line = lines[activeIndex];
  if (!line) return { activeIndex, progress: 0, characterProgress: 0, wordTimed: false };
  const normalizedSource = source?.trim().toLowerCase();
  const matchedSource = lyricsSource?.trim().toLowerCase().replace(/^online-/, "");
  const provider = normalizedSource === "cloud" ? "netease"
    : normalizedSource === "local" ? matchedSource ?? normalizedSource : normalizedSource;
  const wordTimed = getDesktopLyricHighlightMode({ source: provider, lyricsFormat }) === "word"
    && Boolean(line.characters?.length || line.characterTimes?.length);
  const characterProgress = wordTimed ? getLyricCharacterProgress(time, lines) : 0;
  const estimatedEnd = line.time + Math.max(4, Math.min(12, Array.from(line.text).length * 0.32));
  const end = line.duration && line.duration > 0 ? line.time + line.duration
    : lines[activeIndex + 1]?.time ?? (duration > line.time ? duration : estimatedEnd);
  const progress = getDesktopLyricPlaybackProgress(time, line.time, end,
    wordTimed ? characterProgress : undefined, wordTimed ? Array.from(line.text).length : undefined);
  return { activeIndex, progress, characterProgress, wordTimed };
}

export const getMiniLyricCharacterFill = getDesktopLyricCharacterFill;

export function getMiniLyricOffset(contentWidth: number, viewportWidth: number, progress: number) {
  if (!Number.isFinite(contentWidth) || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || contentWidth <= viewportWidth + 1) return 0;
  const scroll = getDesktopLyricScrollProgress(progress, true);
  return scroll === 0 ? 0 : -(contentWidth - viewportWidth) * scroll;
}
