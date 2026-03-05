export type GlobalConversionRow = {
  from_unit: string;
  to_unit: string;
  factor: number;
};
export type ItemConversionRow = { to_unit: string; factor: number };
export type ItemOtherUnitRow = { unit: string };

export interface ComputeProductUnitsOptions {
  primaryUnit: string | null | undefined;
  retailPrimaryUnit: string | null | undefined;
  otherUnits: ItemOtherUnitRow[] | undefined;
  itemConversions: ItemConversionRow[];
  globalConversions: GlobalConversionRow[];
  /**
   * 'desc' = big-to-small (Items page stock units).
   * 'asc'  = small-to-big (Invoice dropdown).
   * Default: 'desc'.
   */
  sortDirection?: "asc" | "desc";
  /** Unit to pin at position 0. Defaults to primaryUnit. */
  pinUnit?: string | null;
}

/**
 * Compute the set of units associated with a product, sorted by physical size.
 *
 * Starting from the product's base units (primary, retail primary, other units),
 * traverses the global and item-level conversion graph to discover all reachable
 * units, then sorts them by relative physical size computed from conversion factors.
 */
export function computeProductUnits(
  opts: ComputeProductUnitsOptions
): string[] {
  const {
    primaryUnit,
    retailPrimaryUnit,
    otherUnits,
    itemConversions,
    globalConversions,
    sortDirection = "desc",
    pinUnit,
  } = opts;

  // 1. Collect base units
  const base = new Set<string>();
  if (primaryUnit && primaryUnit.trim()) base.add(primaryUnit.trim());
  if (retailPrimaryUnit && retailPrimaryUnit.trim())
    base.add(retailPrimaryUnit.trim());
  (otherUnits ?? []).forEach((ou) => {
    if (ou.unit && ou.unit.trim()) base.add(ou.unit.trim());
  });

  if (base.size === 0) return [];

  // 2. Build conversion graph
  const graph = new Map<string, Set<string>>();
  const weightedGraph = new Map<string, { to: string; ratio: number }[]>();

  const ensureNode = (name: string) => {
    if (!graph.has(name)) graph.set(name, new Set());
    if (!weightedGraph.has(name)) weightedGraph.set(name, []);
  };

  const addEdge = (from: string, to: string, factor: number) => {
    const a = from.trim();
    const b = to.trim();
    if (!a || !b) return;
    ensureNode(a);
    ensureNode(b);
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
    if (Number.isFinite(factor) && factor > 0) {
      // 1 from = factor to  => size(from) = factor * size(to)
      weightedGraph.get(a)!.push({ to: b, ratio: 1 / factor });
      weightedGraph.get(b)!.push({ to: a, ratio: factor });
    }
  };

  for (const row of globalConversions) {
    addEdge(row.from_unit, row.to_unit, row.factor);
  }

  const primary = primaryUnit?.trim();
  if (primary) {
    for (const row of itemConversions) {
      if (row.to_unit && row.to_unit.trim()) {
        addEdge(primary, row.to_unit, row.factor);
      }
    }
  }

  // 3. BFS to find all reachable units from base set
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const u of base) {
    visited.add(u);
    queue.push(u);
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = graph.get(u);
    if (!neighbors) continue;
    for (const v of neighbors) {
      if (!visited.has(v)) {
        visited.add(v);
        queue.push(v);
      }
    }
  }

  if (visited.size === 0) return [];

  // 4. Compute relative sizes via BFS from primary (or each disconnected seed)
  const sizes = new Map<string, number>();

  const fillSizesFrom = (seed: string) => {
    sizes.set(seed, 1);
    const q: string[] = [seed];
    while (q.length > 0) {
      const u = q.shift()!;
      const currentSize = sizes.get(u)!;
      const neighbors = weightedGraph.get(u) ?? [];
      for (const { to, ratio } of neighbors) {
        if (!sizes.has(to) && Number.isFinite(ratio) && ratio > 0) {
          sizes.set(to, currentSize * ratio);
          q.push(to);
        }
      }
    }
  };

  if (primary) fillSizesFrom(primary);
  for (const u of visited) {
    if (!sizes.has(u)) fillSizesFrom(u);
  }

  // 5. Sort by size
  const sorted = Array.from(visited).sort((a, b) => {
    const sa = sizes.get(a);
    const sb = sizes.get(b);
    if (sa != null && sb != null) {
      // Larger size value = bigger physical unit.
      // desc: big first (sb - sa), asc: small first (sa - sb).
      return sortDirection === "asc" ? sa - sb : sb - sa;
    }
    if (sa != null) return -1;
    if (sb != null) return 1;
    return a.localeCompare(b);
  });

  // 6. Pin the requested unit at position 0
  const pin = (pinUnit ?? primary)?.trim();
  if (pin && sorted.includes(pin)) {
    return [pin, ...sorted.filter((u) => u !== pin)];
  }

  return sorted;
}
