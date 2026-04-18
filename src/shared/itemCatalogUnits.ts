import { computeProductUnits } from "./computeProductUnits";
import type { Unit, UnitConversion } from "./types";

export interface ItemForCatalogUnits {
  unit: string;
  retail_primary_unit?: string | null;
  other_units?: { unit: string; sort_order?: number }[] | undefined;
  item_unit_conversions?: { to_unit: string; factor: number }[] | undefined;
}

/**
 * Units reachable from the product's conversion graph (same as invoice line units),
 * sorted small-to-large, with `pinUnit` listed first (use primary for purchases/stock).
 */
export function getItemCatalogUnitsAsc(
  item: ItemForCatalogUnits,
  allUnits: Unit[],
  globalConversions: UnitConversion[],
  pinUnit: string | null | undefined
): Unit[] {
  const unitNames = computeProductUnits({
    primaryUnit: item.unit,
    retailPrimaryUnit: item.retail_primary_unit,
    otherUnits: item.other_units,
    itemConversions: item.item_unit_conversions ?? [],
    globalConversions,
    sortDirection: "asc",
    pinUnit: pinUnit ?? item.unit,
  });
  return unitNames
    .map((name) => allUnits.find((u) => u.name === name))
    .filter((u): u is Unit => u != null);
}
