import { roundDecimal } from "../../shared/numbers";

export type ConversionRow = {
  from_unit: string;
  to_unit: string;
  factor: number;
};

export type ItemConversionRow = {
  to_unit: string;
  factor: number;
};

/** Build adjacency map: unit -> [{ neighbor, factor }] for 1 unit = factor × neighbor. */
function buildConversionGraph(
  conversions: ConversionRow[]
): Map<string, { neighbor: string; factor: number }[]> {
  const adj = new Map<string, { neighbor: string; factor: number }[]>();
  for (const r of conversions) {
    if (r.factor <= 0) continue;
    const from = (r.from_unit ?? "").trim();
    const to = (r.to_unit ?? "").trim();
    if (!from || !to) continue;
    const fromEdges = adj.get(from) ?? [];
    fromEdges.push({ neighbor: to, factor: r.factor });
    adj.set(from, fromEdges);
    const toEdges = adj.get(to) ?? [];
    toEdges.push({ neighbor: from, factor: 1 / r.factor });
    adj.set(to, toEdges);
  }
  return adj;
}

/**
 * Convert a quantity from one unit to another using the conversions table.
 * Supports direct, reverse, and multi-hop paths (e.g. gram → kg → tonne).
 * 1 from_unit = factor × to_unit, so quantity_in_to = quantity_in_from * factor
 * when the row is (from_unit, to_unit, factor).
 */
function convertBetweenUnits(
  conversions: ConversionRow[],
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const from = (fromUnit ?? "").trim();
  const to = (toUnit ?? "").trim();
  if (from === to) return quantity;
  const rowSame = conversions.find(
    (r) =>
      (r.from_unit ?? "").trim() === from && (r.to_unit ?? "").trim() === to
  );
  if (rowSame) return roundDecimal(quantity * rowSame.factor, 10);
  const rowReverse = conversions.find(
    (r) =>
      (r.from_unit ?? "").trim() === to && (r.to_unit ?? "").trim() === from
  );
  if (rowReverse) return roundDecimal(quantity / rowReverse.factor, 10);

  const adj = buildConversionGraph(conversions);
  const visited = new Set<string>();
  const queue: { unit: string; factorSoFar: number }[] = [
    { unit: from, factorSoFar: 1 },
  ];
  visited.add(from);
  while (queue.length > 0) {
    const head = queue.shift();
    if (!head) break;
    const { unit, factorSoFar } = head;
    if (unit === to) return roundDecimal(quantity * factorSoFar, 10);
    for (const { neighbor, factor } of adj.get(unit) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ unit: neighbor, factorSoFar: factorSoFar * factor });
    }
  }
  return null;
}

export type ItemForConversion = {
  unit: string;
  reference_unit: string | null;
  quantity_per_primary: number | null;
  /** Multiple conversions per product: 1 [unit] = factor × to_unit. Takes precedence over legacy when non-empty. */
  item_conversions?: ItemConversionRow[];
};

/**
 * Convert quantity (in fromUnit) to the item's primary stock unit.
 * - If fromUnit equals item.unit, returns quantity as-is.
 * - If item has item_conversions (non-empty): resolve fromUnit via direct row or global conversions + item row.
 * - Else fall back to legacy reference_unit/quantity_per_primary.
 */
export function convertToPrimaryQuantity(
  conversions: ConversionRow[],
  item: ItemForConversion,
  quantity: number,
  fromUnit: string
): { primaryQuantity: number } | { error: string } {
  if (quantity <= 0) {
    return { error: "Quantity must be positive." };
  }
  const primary = item.unit;
  if (fromUnit === primary) {
    return { primaryQuantity: roundDecimal(quantity, 10) };
  }

  const itemConvs = item.item_conversions;
  if (itemConvs != null && itemConvs.length > 0) {
    const direct = itemConvs.find((r) => r.to_unit === fromUnit);
    if (direct != null && direct.factor > 0) {
      return {
        primaryQuantity: roundDecimal(quantity / direct.factor, 10),
      };
    }
    for (const row of itemConvs) {
      if (row.factor <= 0) continue;
      const quantityInTo = convertBetweenUnits(
        conversions,
        quantity,
        fromUnit,
        row.to_unit
      );
      if (quantityInTo != null) {
        const primaryQuantity = quantityInTo / row.factor;
        return { primaryQuantity: roundDecimal(primaryQuantity, 10) };
      }
    }
    // Merge item conversions into graph so fromUnit -> primary can be found via
    // multi-hop (e.g. gram -> kilogram via global, kilogram -> tonne via item)
    const mergedConversions: ConversionRow[] = [
      ...conversions,
      ...itemConvs
        .filter((r) => r.to_unit && r.factor > 0)
        .map((r) => ({
          from_unit: primary,
          to_unit: r.to_unit,
          factor: r.factor,
        })),
    ];
    const quantityInPrimary = convertBetweenUnits(
      mergedConversions,
      quantity,
      fromUnit,
      primary
    );
    if (quantityInPrimary != null) {
      return { primaryQuantity: roundDecimal(quantityInPrimary, 10) };
    }
    return {
      error: `Cannot convert from ${fromUnit} to ${primary}. No conversion path for this product.`,
    };
  }

  const refUnit = item.reference_unit;
  const qtyPerPrimary = item.quantity_per_primary;

  // Try global conversions first (e.g. gram → kg → tonne)
  const quantityInPrimary = convertBetweenUnits(
    conversions,
    quantity,
    fromUnit,
    primary
  );
  if (quantityInPrimary != null) {
    return { primaryQuantity: roundDecimal(quantityInPrimary, 10) };
  }

  if (refUnit == null || qtyPerPrimary == null || qtyPerPrimary <= 0) {
    return {
      error: `Cannot convert from ${fromUnit} to ${primary} for this product. Set conversion (e.g. 1 ${primary} = X ${refUnit ?? "?"}) in the product.`,
    };
  }
  const quantityInRef = convertBetweenUnits(
    conversions,
    quantity,
    fromUnit,
    refUnit
  );
  if (quantityInRef == null) {
    return {
      error: `Cannot convert from ${fromUnit} to ${primary}. No conversion defined between ${fromUnit} and ${refUnit}.`,
    };
  }
  const primaryQuantity = quantityInRef / qtyPerPrimary;
  return { primaryQuantity: roundDecimal(primaryQuantity, 10) };
}
