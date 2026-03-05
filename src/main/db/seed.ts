import type Database from "better-sqlite3";

const UNIT_TYPE_NAMES = ["Mass", "Volume", "Count", "Other"];

// ---- Realistic units: name, symbol, unit_type (matches UNIT_TYPE_NAMES) ----
const UNITS: { name: string; symbol: string | null; unit_type: string }[] = [
  { name: "gram", symbol: "g", unit_type: "Mass" },
  { name: "kilogram", symbol: "kg", unit_type: "Mass" },
  { name: "liter", symbol: "L", unit_type: "Volume" },
  { name: "ml", symbol: "ml", unit_type: "Volume" },
  { name: "gallon", symbol: "gal", unit_type: "Volume" },
  { name: "quart", symbol: "qt", unit_type: "Volume" },
  { name: "pint", symbol: "pt", unit_type: "Volume" },
  { name: "fluid_ounce", symbol: "fl oz", unit_type: "Volume" },
  { name: "pieces", symbol: "pcs", unit_type: "Count" },
  { name: "bags", symbol: null, unit_type: "Count" },
  { name: "boxes", symbol: null, unit_type: "Count" },
  { name: "bottles", symbol: null, unit_type: "Count" },
  { name: "cartons", symbol: null, unit_type: "Count" },
  { name: "tins", symbol: null, unit_type: "Count" },
  { name: "packets", symbol: "pack", unit_type: "Count" },
  { name: "pouches", symbol: null, unit_type: "Count" },
  { name: "strips", symbol: null, unit_type: "Count" },
  { name: "jars", symbol: null, unit_type: "Count" },
  { name: "cups", symbol: null, unit_type: "Count" },
  { name: "dozen", symbol: "dz", unit_type: "Count" },
  { name: "gross", symbol: "gr", unit_type: "Count" },
  { name: "tonne", symbol: "t", unit_type: "Mass" },
  { name: "quintal", symbol: "q", unit_type: "Mass" },
];

// One row per pair; unitConversion.ts derives the reverse (quantity / factor).
// 1 from_unit = factor × to_unit (e.g. 1 kg = 1000 g).
const CONVERSIONS: { from_unit: string; to_unit: string; factor: number }[] = [
  { from_unit: "kilogram", to_unit: "gram", factor: 1000 },
  { from_unit: "liter", to_unit: "ml", factor: 1000 },
  { from_unit: "gallon", to_unit: "liter", factor: 3.785 },
  { from_unit: "quart", to_unit: "liter", factor: 0.946 },
  { from_unit: "pint", to_unit: "ml", factor: 473.176 },
  { from_unit: "fluid_ounce", to_unit: "ml", factor: 29.574 },
  { from_unit: "dozen", to_unit: "pieces", factor: 12 },
  { from_unit: "gross", to_unit: "pieces", factor: 144 },
  { from_unit: "tonne", to_unit: "kilogram", factor: 1000 },
  { from_unit: "quintal", to_unit: "kilogram", factor: 100 },
];

function seedUnitTypes(db: Database.Database): void {
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM unit_types").get() as { c: number }
  ).c;
  if (count > 0) return;
  const insert = db.prepare("INSERT INTO unit_types (name) VALUES (?)");
  for (const name of UNIT_TYPE_NAMES) insert.run(name);
}

function seedUnits(db: Database.Database): void {
  seedUnitTypes(db);
  const getTypeId = db.prepare("SELECT id FROM unit_types WHERE name = ?");
  const insertUnit = db.prepare(
    "INSERT OR IGNORE INTO units (name, symbol, unit_type_id) VALUES (?, ?, ?)"
  );
  for (const u of UNITS) {
    const typeRow = getTypeId.get(u.unit_type) as { id: number } | undefined;
    const typeId = typeRow?.id ?? null;
    insertUnit.run(u.name, u.symbol, typeId);
  }
}

function seedUnitConversions(db: Database.Database): void {
  try {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO unit_conversions (from_unit, to_unit, factor) VALUES (?, ?, ?)"
    );
    for (const c of CONVERSIONS) {
      insert.run(c.from_unit, c.to_unit, c.factor);
    }
  } catch {
    // unit_conversions table may not exist if schema order differs
  }
}

/**
 * On fresh DB setup: insert units and standard conversions.
 */
export function seedIfEmpty(db: Database.Database): void {
  const unitCount = (
    db.prepare("SELECT COUNT(*) AS c FROM units").get() as { c: number }
  ).c;
  if (unitCount === 0) {
    seedUnits(db);
    seedUnitConversions(db);
  }
}
