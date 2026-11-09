export interface LayoutItem { id: string; start: number; end: number }
export interface PositionedItem<T extends LayoutItem> { item: T; lane: number; lanes: number }

/**
 * Lay out one day's events so overlapping ones sit side by side instead of hiding each other.
 * Events that merely touch (end === next start) do NOT overlap and keep full width.
 */
export function layoutDay<T extends LayoutItem>(items: readonly T[]): PositionedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: PositionedItem<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let clusterEnd = -Infinity;
  const laneEnds: number[] = [];

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach(c => result.push({ ...c, lanes }));
    cluster = []; laneEnds.length = 0; clusterEnd = -Infinity;
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.end); } else laneEnds[lane] = item.end;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}

/** Visible hour range for a calendar: at least `minStart`–`minEnd`, widened to fit every event. */
export function calendarBounds(
  events: readonly { start: number; end: number }[],
  minStart: number,
  minEnd: number,
): { rangeStart: number; rangeEnd: number } {
  return {
    rangeStart: Math.min(minStart, ...events.map(e => Math.floor(e.start / 60) * 60)),
    rangeEnd: Math.max(minEnd, ...events.map(e => Math.ceil(e.end / 60) * 60)),
  };
}
