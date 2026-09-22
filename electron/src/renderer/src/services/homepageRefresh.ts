export function keepHomepageRefreshVisible<T extends { id: string }>(
  previous: readonly T[],
  refreshed: readonly T[]
): T[] {
  const next = [...refreshed];
  if (next.length <= 1) {
    return next;
  }

  const unchanged = previous.length === next.length
    && previous.every((item, index) => item.id === next[index]?.id);
  return unchanged ? [...next.slice(1), next[0]] : next;
}
