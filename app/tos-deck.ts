/** Pack whole controls into bounded banks without splitting a label from its field. */
export function consoleControlPages(costs: number[], capacity: number): number[] {
  const limit = Math.max(1, Math.floor(capacity));
  let page = 0, used = 0;
  return costs.map(value => {
    const cost = Math.max(1, Math.min(limit, Math.ceil(value)));
    if (used && used + cost > limit) { page++; used = 0; }
    used += cost;
    return page;
  });
}
