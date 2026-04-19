import type Database from "better-sqlite3";
import type { ConversionRow, ItemConversionRow } from "../../shared/unitConversion";

export function getUnitConversionsRows(
  database: Database.Database
): ConversionRow[] {
  return database
    .prepare("SELECT from_unit, to_unit, factor FROM unit_conversions")
    .all() as ConversionRow[];
}

export function getItemUnitConversions(
  database: Database.Database,
  itemId: number
): ItemConversionRow[] {
  return database
    .prepare(
      "SELECT to_unit, factor FROM item_unit_conversions WHERE item_id = ?"
    )
    .all(itemId) as ItemConversionRow[];
}
