export interface TrackOrderItem {
  id: string;
  source?: string;
}

export function trackOrderKey(track: TrackOrderItem) {
  return `${track.source || "local"}::${track.id}`;
}

export function applyTrackOrder<T extends TrackOrderItem>(tracks: T[], order: string[]) {
  if (!order.length) {
    return [...tracks];
  }

  const positions = new Map(order.map((key, index) => [key, index]));
  const known: T[] = [];
  const newTracks: T[] = [];
  tracks.forEach((track) => {
    if (positions.has(trackOrderKey(track))) {
      known.push(track);
    } else {
      newTracks.push(track);
    }
  });
  known.sort((left, right) => (
    (positions.get(trackOrderKey(left)) ?? Number.MAX_SAFE_INTEGER)
    - (positions.get(trackOrderKey(right)) ?? Number.MAX_SAFE_INTEGER)
  ));
  return [...newTracks, ...known];
}

export function reorderVisibleKeys(
  allKeys: string[],
  visibleKeys: string[],
  draggedKey: string,
  targetKey: string
) {
  if (draggedKey === targetKey || !visibleKeys.includes(draggedKey) || !visibleKeys.includes(targetKey)) {
    return [...allKeys];
  }

  const reorderedVisible = [...visibleKeys];
  const draggedIndex = reorderedVisible.indexOf(draggedKey);
  const targetIndex = reorderedVisible.indexOf(targetKey);
  const [dragged] = reorderedVisible.splice(draggedIndex, 1);
  reorderedVisible.splice(targetIndex, 0, dragged);

  const visibleSet = new Set(visibleKeys);
  let visibleIndex = 0;
  return allKeys.map((key) => (
    visibleSet.has(key) ? reorderedVisible[visibleIndex++] : key
  ));
}
