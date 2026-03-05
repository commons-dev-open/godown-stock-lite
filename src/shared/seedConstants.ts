/**
 * Initial seed data for unit types, units, and conversions.
 * Used by main process for seeding and delete guards, and by renderer to disable delete for system rows.
 * Keep in sync with usage in src/main/db/seed.ts.
 */

export const SEED_UNIT_TYPE_NAMES_LIST = [
  "Mass",
  "Volume",
  "Count",
  "Other",
] as const;

export const SEED_UNIT_NAMES_LIST = [
  "gram",
  "kilogram",
  "liter",
  "ml",
  "pieces",
  "bags",
  "boxes",
  "bottles",
  "cartons",
  "tins",
  "packets",
  "pouches",
  "strips",
  "jars",
  "cups",
] as const;

export const SEED_CONVERSION_KEYS_LIST = [
  "kilogram|gram",
  "liter|ml",
] as const;

export const SEED_UNIT_TYPE_NAMES = new Set<string>(SEED_UNIT_TYPE_NAMES_LIST);
export const SEED_UNIT_NAMES = new Set<string>(SEED_UNIT_NAMES_LIST);
export const SEED_CONVERSION_KEYS = new Set<string>(SEED_CONVERSION_KEYS_LIST);

export function isSeedUnitType(name: string): boolean {
  return SEED_UNIT_TYPE_NAMES.has(name);
}

export function isSeedUnit(name: string): boolean {
  return SEED_UNIT_NAMES.has(name);
}

export function isSeedConversion(fromUnit: string, toUnit: string): boolean {
  return SEED_CONVERSION_KEYS.has(`${fromUnit}|${toUnit}`);
}
