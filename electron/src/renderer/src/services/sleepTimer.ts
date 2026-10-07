export const SLEEP_TIMER_PRESETS = [0, 15, 30, 45, 60] as const;
export type SleepTimerMinutes = typeof SLEEP_TIMER_PRESETS[number];

export function normalizeSleepTimerMinutes(value: unknown): SleepTimerMinutes {
  const numeric = Number(value);
  return SLEEP_TIMER_PRESETS.includes(numeric as SleepTimerMinutes)
    ? numeric as SleepTimerMinutes
    : 0;
}

export function sleepTimerRemainingSeconds(endsAt: number | null, now = Date.now()) {
  if (!endsAt || !Number.isFinite(endsAt)) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
