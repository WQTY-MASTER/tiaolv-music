export type ListeningStatsRetentionMode = "month" | "year" | "all";

export interface ListeningStatsRange {
  from: string;
  to: string;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function createListeningStatsRange(
  mode: ListeningStatsRetentionMode,
  year: number,
  month: number
): ListeningStatsRange | null {
  if (mode === "all") return null;
  if (mode === "year") {
    return {
      from: formatDateKey(year, 1, 1),
      to: formatDateKey(year, 12, 31)
    };
  }
  const normalizedMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  const lastDay = new Date(year, normalizedMonth, 0).getDate();
  return {
    from: formatDateKey(year, normalizedMonth, 1),
    to: formatDateKey(year, normalizedMonth, lastDay)
  };
}

export function describeListeningStatsRange(
  mode: ListeningStatsRetentionMode,
  year: number,
  month: number
) {
  if (mode === "all") return "全部";
  if (mode === "year") return `${year} 年`;
  return `${year} 年 ${month} 月`;
}

export function formatListeningDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(Number.isFinite(seconds) ? seconds / 60 : 0));
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}
