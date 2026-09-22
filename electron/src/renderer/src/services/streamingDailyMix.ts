export type DailySortField = "default" | "title" | "artist" | "album" | "duration";
export type DailySortDirection = "asc" | "desc";

export interface SortableDailyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export function filterAndSortDailyTracks<T extends SortableDailyTrack>(
  tracks: T[],
  keyword: string,
  field: DailySortField,
  direction: DailySortDirection
) {
  const query = keyword.trim().toLocaleLowerCase("zh-CN");
  const filtered = query
    ? tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase("zh-CN").includes(query))
    : [...tracks];

  if (field === "default") {
    return filtered;
  }

  const multiplier = direction === "asc" ? 1 : -1;
  return filtered.sort((left, right) => {
    if (field === "duration") {
      return (left.duration - right.duration) * multiplier;
    }
    return left[field].localeCompare(right[field], "zh-CN", { numeric: true, sensitivity: "base" }) * multiplier;
  });
}

export function summarizeDailyDuration(tracks: SortableDailyTrack[]) {
  const totalMinutes = Math.ceil(tracks.reduce((sum, track) => sum + Math.max(0, Number(track.duration) || 0), 0) / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `约 ${hours} 小时 ${minutes} 分` : `约 ${hours} 小时`;
  }
  return `约 ${totalMinutes} 分钟`;
}
