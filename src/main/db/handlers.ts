import { randomUUID } from "crypto";
import fs from "fs";
import type { OpenDialogOptions } from "electron";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { PAGE_SIZE } from "../../shared/constants";
import { roundDecimal } from "../../shared/numbers";
import {
  convertToPrimaryQuantity,
  type ConversionRow,
  type ItemConversionRow,
} from "./unitConversion";
import { closeDb, getDb, getDbPath, getSkipSeedFlagPath } from "./index";
import {
  SEED_CONVERSION_KEYS,
  SEED_UNIT_NAMES,
  SEED_UNIT_TYPE_NAMES,
} from "../../shared/seedConstants";
import { populateSampleData } from "./sampleData";

function getUnitConversionsRows(): ConversionRow[] {
  return getDb()
    .prepare("SELECT from_unit, to_unit, factor FROM unit_conversions")
    .all() as ConversionRow[];
}

function getItemUnitConversions(
  database: ReturnType<typeof getDb>,
  itemId: number
): ItemConversionRow[] {
  return database
    .prepare(
      "SELECT to_unit, factor FROM item_unit_conversions WHERE item_id = ?"
    )
    .all(itemId) as ItemConversionRow[];
}

/**
 * Update daily_sales when invoice totals change.
 * delta: positive to add, negative to subtract.
 * Creates a row for sale_date if none exists.
 */
function upsertDailySalesForInvoice(
  database: ReturnType<typeof getDb>,
  saleDate: string,
  delta: number
): void {
  const row = database
    .prepare(
      "SELECT id, invoice_sales, misc_sales FROM daily_sales WHERE sale_date = ? LIMIT 1"
    )
    .get(saleDate) as
    | { id: number; invoice_sales: number; misc_sales: number }
    | undefined;
  if (row) {
    const newInv = roundDecimal(
      Math.max(0, (row.invoice_sales ?? 0) + delta)
    );
    const misc = row.misc_sales ?? 0;
    const saleAmount = roundDecimal(newInv + misc);
    database
      .prepare(
        "UPDATE daily_sales SET invoice_sales = ?, sale_amount = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(newInv, saleAmount, row.id);
  } else {
    const invoiceSales = Math.max(0, roundDecimal(delta));
    database
      .prepare(
        "INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, invoice_sales, misc_sales) VALUES (?, ?, 0, ?, 0)"
      )
      .run(saleDate, invoiceSales, invoiceSales);
  }
}

export function registerIpcHandlers(): void {
  function db() {
    return getDb();
  }

  // ---- Items ----
  ipcMain.handle("items:getAll", () => {
    return db().prepare("SELECT * FROM items ORDER BY name").all();
  });

  ipcMain.handle("items:getAllWithUnits", () => {
    const rows = db().prepare("SELECT * FROM items ORDER BY name").all() as {
      id: number;
      name: string;
      code: string | null;
      unit: string;
      reference_unit: string | null;
      quantity_per_primary: number | null;
      retail_primary_unit: string | null;
      current_stock: number;
      reorder_level: number | null;
      created_at: string;
      updated_at: string;
    }[];
    const otherUnitsByItem = db()
      .prepare(
        "SELECT item_id, unit, sort_order FROM item_other_units ORDER BY item_id, sort_order, unit"
      )
      .all() as { item_id: number; unit: string; sort_order: number }[];
    const map = new Map<number, { unit: string; sort_order: number }[]>();
    for (const ou of otherUnitsByItem) {
      const arr = map.get(ou.item_id) ?? [];
      arr.push({ unit: ou.unit, sort_order: ou.sort_order });
      map.set(ou.item_id, arr);
    }
    const conversionsByItem = db()
      .prepare(
        "SELECT item_id, to_unit, factor FROM item_unit_conversions ORDER BY item_id"
      )
      .all() as { item_id: number; to_unit: string; factor: number }[];
    const convMap = new Map<
      number,
      { to_unit: string; factor: number }[]
    >();
    for (const c of conversionsByItem) {
      const arr = convMap.get(c.item_id) ?? [];
      arr.push({ to_unit: c.to_unit, factor: c.factor });
      convMap.set(c.item_id, arr);
    }
    return rows.map((row) => ({
      ...row,
      retail_primary_unit: row.retail_primary_unit ?? null,
      other_units: map.get(row.id) ?? [],
      item_unit_conversions: convMap.get(row.id) ?? [],
    }));
  });

  ipcMain.handle("items:getById", (_, id: number) => {
    const row = db().prepare("SELECT * FROM items WHERE id = ?").get(id) as
      | {
          id: number;
          name: string;
          code: string | null;
          unit: string;
          reference_unit: string | null;
          quantity_per_primary: number | null;
          retail_primary_unit: string | null;
          current_stock: number;
          reorder_level: number | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) throw new Error("Item not found");
    const otherUnits = db()
      .prepare(
        "SELECT id, unit, sort_order FROM item_other_units WHERE item_id = ? ORDER BY sort_order, unit"
      )
      .all(id) as { id: number; unit: string; sort_order: number }[];
    const item_unit_conversions = getItemUnitConversions(db(), id);
    return {
      ...row,
      retail_primary_unit: row.retail_primary_unit ?? null,
      other_units: otherUnits,
      item_unit_conversions,
    };
  });

  ipcMain.handle(
    "items:getPage",
    (_, opts: { search?: string; page?: number; limit?: number }) => {
      const search = typeof opts?.search === "string" ? opts.search.trim() : "";
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
      const offset = (page - 1) * limit;
      const likeArg = search ? `%${search}%` : null;
      if (likeArg) {
        const countRow = db()
          .prepare(
            "SELECT COUNT(*) AS total FROM items WHERE name LIKE ? OR COALESCE(code, '') LIKE ?"
          )
          .get(likeArg, likeArg) as { total: number };
        const rows = db()
          .prepare(
            "SELECT * FROM items WHERE name LIKE ? OR COALESCE(code, '') LIKE ? ORDER BY name LIMIT ? OFFSET ?"
          )
          .all(likeArg, likeArg, limit, offset);
        return { data: rows, total: countRow.total };
      }
      const countRow = db()
        .prepare("SELECT COUNT(*) AS total FROM items")
        .get() as { total: number };
      const rows = db()
        .prepare("SELECT * FROM items ORDER BY name LIMIT ? OFFSET ?")
        .all(limit, offset);
      return { data: rows, total: countRow.total };
    }
  );

  ipcMain.handle(
    "items:create",
    (
      _,
      item: {
        name: string;
        code?: string;
        unit: string;
        reference_unit?: string | null;
        quantity_per_primary?: number | null;
        retail_primary_unit?: string | null;
        current_stock?: number;
        current_stock_value?: number;
        current_stock_unit?: string;
        reorder_level?: number;
        other_units?: { unit: string; sort_order?: number }[];
        conversions?: { to_unit: string; factor: number }[];
      }
    ) => {
      const primaryUnit = item.unit || "pcs";
      let stockPrimary: number;
      if (
        item.current_stock_unit != null &&
        item.current_stock_unit !== "" &&
        (item.current_stock_value != null || item.current_stock != null)
      ) {
        const val = item.current_stock_value ?? item.current_stock ?? 0;
        const conversions = getUnitConversionsRows();
        const result = convertToPrimaryQuantity(
          conversions,
          {
            unit: primaryUnit,
            reference_unit: item.reference_unit ?? null,
            quantity_per_primary: item.quantity_per_primary ?? null,
            item_conversions: item.conversions ?? undefined,
          },
          val,
          item.current_stock_unit
        );
        if ("error" in result) throw new Error(result.error);
        stockPrimary = result.primaryQuantity;
      } else {
        // Store stock with higher precision than DECIMAL_PLACES so that
        // unit conversions (e.g. bags ↔ kg ↔ gram) stay accurate.
        stockPrimary = roundDecimal(item.current_stock ?? 0, 6);
      }
      const convList = item.conversions ?? [];
      const firstRef = convList[0];
      const refUnit =
        firstRef != null ? firstRef.to_unit : (item.reference_unit ?? null);
      const qtyPerPrimary =
        firstRef != null
          ? roundDecimal(firstRef.factor, 6)
          : item.quantity_per_primary != null
            ? roundDecimal(item.quantity_per_primary, 6)
            : null;
      const unitIdRow = db()
        .prepare("SELECT id FROM units WHERE name = ?")
        .get(primaryUnit) as { id: number } | undefined;
      const unitId = unitIdRow?.id ?? null;
      const result = db()
        .prepare(
          "INSERT INTO items (name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit, current_stock, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          item.name,
          item.code ?? null,
          primaryUnit,
          unitId,
          refUnit,
          qtyPerPrimary,
          item.retail_primary_unit ?? null,
          stockPrimary,
          item.reorder_level != null ? roundDecimal(item.reorder_level) : null
        );
      const itemId = result.lastInsertRowid as number;
      const otherUnits = item.other_units ?? [];
      if (otherUnits.length > 0) {
        const insertOther = db().prepare(
          "INSERT INTO item_other_units (item_id, unit, unit_id, sort_order) VALUES (?, ?, ?, ?)"
        );
        const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
        for (const ou of otherUnits) {
          const ouId =
            (getUnitId.get(ou.unit) as { id: number } | undefined)?.id ?? null;
          insertOther.run(
            itemId,
            ou.unit,
            ouId,
            typeof ou.sort_order === "number" ? ou.sort_order : 0
          );
        }
      }
      if (convList.length > 0) {
        const insertConv = db().prepare(
          "INSERT INTO item_unit_conversions (item_id, to_unit, to_unit_id, factor) VALUES (?, ?, ?, ?)"
        );
        const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
        for (const c of convList) {
          if (c.to_unit && c.factor > 0) {
            const toId =
              (getUnitId.get(c.to_unit) as { id: number } | undefined)?.id ??
              null;
            insertConv.run(itemId, c.to_unit, toId, roundDecimal(c.factor, 6));
          }
        }
      }
      return itemId;
    }
  );

  ipcMain.handle(
    "items:update",
    (
      _,
      id: number,
      item: {
        name?: string;
        code?: string;
        unit?: string;
        reference_unit?: string | null;
        quantity_per_primary?: number | null;
        retail_primary_unit?: string | null;
        current_stock?: number;
        current_stock_value?: number;
        current_stock_unit?: string;
        reorder_level?: number;
        other_units?: { unit: string; sort_order?: number }[];
        conversions?: { to_unit: string; factor: number }[];
      }
    ) => {
      const row = db().prepare("SELECT * FROM items WHERE id = ?").get(id) as
        | {
            name: string;
            code: string | null;
            unit: string;
            reference_unit: string | null;
            quantity_per_primary: number | null;
            retail_primary_unit: string | null;
            current_stock: number;
            reorder_level: number | null;
          }
        | undefined;
      if (!row) throw new Error("Item not found");
      const primaryUnit = item.unit ?? row.unit;
      const convList = item.conversions;
      const firstConv = convList?.[0];
      const refUnit =
        firstConv != null
          ? firstConv.to_unit
          : item.reference_unit !== undefined
            ? item.reference_unit
            : row.reference_unit;
      const qtyPerPrimary =
        firstConv != null
          ? roundDecimal(firstConv.factor, 6)
          : item.quantity_per_primary !== undefined
            ? item.quantity_per_primary
            : row.quantity_per_primary;
      const itemConvsForConvert = convList ?? getItemUnitConversions(db(), id);
      let stockPrimary: number;
      if (
        item.current_stock_unit != null &&
        item.current_stock_unit !== "" &&
        (item.current_stock_value != null || item.current_stock != null)
      ) {
        const val = item.current_stock_value ?? item.current_stock ?? 0;
        const conversions = getUnitConversionsRows();
        const result = convertToPrimaryQuantity(
          conversions,
          {
            unit: primaryUnit,
            reference_unit: refUnit,
            quantity_per_primary: qtyPerPrimary != null ? qtyPerPrimary : null,
            item_conversions:
              itemConvsForConvert.length > 0 ? itemConvsForConvert : undefined,
          },
          val,
          item.current_stock_unit
        );
        if ("error" in result) throw new Error(result.error);
        stockPrimary = result.primaryQuantity;
      } else {
        stockPrimary = roundDecimal(item.current_stock ?? row.current_stock, 6);
      }
      const unitIdRow = db()
        .prepare("SELECT id FROM units WHERE name = ?")
        .get(primaryUnit) as { id: number } | undefined;
      const unitId = unitIdRow?.id ?? null;
      db()
        .prepare(
          "UPDATE items SET name = ?, code = ?, unit = ?, unit_id = ?, reference_unit = ?, quantity_per_primary = ?, retail_primary_unit = ?, current_stock = ?, reorder_level = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          item.name ?? row.name,
          item.code !== undefined ? item.code : row.code,
          primaryUnit,
          unitId,
          refUnit,
          qtyPerPrimary != null ? roundDecimal(qtyPerPrimary, 6) : null,
          item.retail_primary_unit !== undefined
            ? item.retail_primary_unit
            : row.retail_primary_unit,
          stockPrimary,
          item.reorder_level !== undefined
            ? item.reorder_level != null
              ? roundDecimal(item.reorder_level)
              : null
            : row.reorder_level,
          id
        );
      db().prepare("DELETE FROM item_other_units WHERE item_id = ?").run(id);
      const otherUnits = item.other_units ?? [];
      if (otherUnits.length > 0) {
        const insertOther = db().prepare(
          "INSERT INTO item_other_units (item_id, unit, unit_id, sort_order) VALUES (?, ?, ?, ?)"
        );
        const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
        for (const ou of otherUnits) {
          const ouId =
            (getUnitId.get(ou.unit) as { id: number } | undefined)?.id ?? null;
          insertOther.run(
            id,
            ou.unit,
            ouId,
            typeof ou.sort_order === "number" ? ou.sort_order : 0
          );
        }
      }
      if (convList !== undefined) {
        db()
          .prepare("DELETE FROM item_unit_conversions WHERE item_id = ?")
          .run(id);
        if (convList.length > 0) {
          const insertConv = db().prepare(
            "INSERT INTO item_unit_conversions (item_id, to_unit, to_unit_id, factor) VALUES (?, ?, ?, ?)"
          );
          const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
          for (const c of convList) {
            if (c.to_unit && c.factor > 0) {
              const toId =
                (getUnitId.get(c.to_unit) as { id: number } | undefined)?.id ??
                null;
              insertConv.run(id, c.to_unit, toId, roundDecimal(c.factor, 6));
            }
          }
        }
      }
      return id;
    }
  );

  ipcMain.handle("items:delete", (_, id: number) => {
    const row = db()
      .prepare("SELECT current_stock FROM items WHERE id = ?")
      .get(id) as { current_stock: number } | undefined;
    if (!row) throw new Error("Item not found");
    if (row.current_stock !== 0)
      throw new Error("Stock must be 0 to delete this product.");
    db().prepare("DELETE FROM items WHERE id = ?").run(id);
    return id;
  });

  ipcMain.handle(
    "items:addStock",
    (
      _,
      id: number,
      quantityOrPayload: number | { quantity: number; unit: string }
    ) => {
      const quantity =
        typeof quantityOrPayload === "number"
          ? quantityOrPayload
          : quantityOrPayload.quantity;
      const fromUnit =
        typeof quantityOrPayload === "number"
          ? undefined
          : quantityOrPayload.unit;
      if (quantity <= 0) throw new Error("Quantity must be positive.");
      const row = db()
        .prepare(
          "SELECT unit, reference_unit, quantity_per_primary FROM items WHERE id = ?"
        )
        .get(id) as
        | {
            unit: string;
            reference_unit: string | null;
            quantity_per_primary: number | null;
          }
        | undefined;
      if (!row) throw new Error("Item not found");
      const itemConvs = getItemUnitConversions(db(), id);
      let primaryQty: number;
      if (fromUnit != null && fromUnit !== "" && fromUnit !== row.unit) {
        const conversions = getUnitConversionsRows();
        const result = convertToPrimaryQuantity(
          conversions,
          {
            ...row,
            item_conversions: itemConvs.length > 0 ? itemConvs : undefined,
          },
          quantity,
          fromUnit
        );
        if ("error" in result) throw new Error(result.error);
        primaryQty = result.primaryQuantity;
      } else {
        primaryQty = roundDecimal(quantity, 6);
      }
      db()
        .prepare(
          "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(primaryQty, id);
      return id;
    }
  );

  ipcMain.handle(
    "items:reduceStock",
    (
      _,
      id: number,
      quantityOrPayload: number | { quantity: number; unit: string }
    ) => {
      const quantity =
        typeof quantityOrPayload === "number"
          ? quantityOrPayload
          : quantityOrPayload.quantity;
      const fromUnit =
        typeof quantityOrPayload === "number"
          ? undefined
          : quantityOrPayload.unit;
      if (quantity <= 0) throw new Error("Quantity must be positive.");
      const row = db()
        .prepare(
          "SELECT unit, reference_unit, quantity_per_primary, current_stock FROM items WHERE id = ?"
        )
        .get(id) as
        | {
            unit: string;
            reference_unit: string | null;
            quantity_per_primary: number | null;
            current_stock: number;
          }
        | undefined;
      if (!row) throw new Error("Item not found");
      const itemConvs = getItemUnitConversions(db(), id);
      let primaryQty: number;
      if (fromUnit != null && fromUnit !== "" && fromUnit !== row.unit) {
        const conversions = getUnitConversionsRows();
        const result = convertToPrimaryQuantity(
          conversions,
          {
            ...row,
            item_conversions: itemConvs.length > 0 ? itemConvs : undefined,
          },
          quantity,
          fromUnit
        );
        if ("error" in result) throw new Error(result.error);
        primaryQty = result.primaryQuantity;
      } else {
        primaryQty = roundDecimal(quantity, 6);
      }
      if (row.current_stock < primaryQty)
        throw new Error("Insufficient stock.");
      db()
        .prepare(
          "UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(primaryQty, id);
      return id;
    }
  );

  // ---- Unit types (master data) ----
  ipcMain.handle("unitTypes:getAll", () => {
    return db()
      .prepare("SELECT id, name, created_at FROM unit_types ORDER BY name")
      .all();
  });

  ipcMain.handle("unitTypes:create", (_, name: string) => {
    const n = typeof name === "string" ? name.trim() : "";
    if (!n) throw new Error("Unit type name is required.");
    const run = db().prepare("INSERT INTO unit_types (name) VALUES (?)").run(n);
    return (run as { lastInsertRowid: number }).lastInsertRowid;
  });

  ipcMain.handle(
    "unitTypes:update",
    (_, id: number, payload: { name?: string }) => {
      const row = db()
        .prepare("SELECT id FROM unit_types WHERE id = ?")
        .get(id);
      if (!row) throw new Error("Unit type not found.");
      const n =
        typeof payload?.name === "string" ? payload.name.trim() : undefined;
      if (n !== undefined) {
        if (!n) throw new Error("Unit type name is required.");
        db().prepare("UPDATE unit_types SET name = ? WHERE id = ?").run(n, id);
      }
      return id;
    }
  );

  ipcMain.handle("unitTypes:delete", (_, id: number) => {
    const row = db()
      .prepare("SELECT id, name FROM unit_types WHERE id = ?")
      .get(id) as { id: number; name: string } | undefined;
    if (!row) throw new Error("Unit type not found.");
    if (SEED_UNIT_TYPE_NAMES.has(row.name))
      throw new Error("Cannot delete: this is a system unit type.");
    const used = db()
      .prepare("SELECT 1 FROM units WHERE unit_type_id = ? LIMIT 1")
      .get(id);
    if (used)
      throw new Error("Cannot delete: one or more units use this type.");
    db().prepare("DELETE FROM unit_types WHERE id = ?").run(id);
    return id;
  });

  // ---- Units ----
  ipcMain.handle("units:getAll", () => {
    return db()
      .prepare(
        `SELECT u.id, u.name, u.symbol, u.unit_type_id, t.name AS unit_type_name, u.created_at
         FROM units u
         LEFT JOIN unit_types t ON t.id = u.unit_type_id
         ORDER BY u.name ASC`
      )
      .all();
  });

  ipcMain.handle(
    "units:create",
    (
      _,
      nameOrPayload:
        | string
        | { name: string; symbol?: string | null; unit_type_id?: number | null }
    ) => {
      let name: string;
      let symbol: string | null = null;
      let unitTypeId: number | null = null;
      if (typeof nameOrPayload === "string") {
        name = nameOrPayload.trim();
      } else {
        name =
          typeof nameOrPayload?.name === "string"
            ? nameOrPayload.name.trim()
            : "";
        symbol =
          typeof nameOrPayload?.symbol === "string"
            ? nameOrPayload.symbol.trim() || null
            : null;
        if (
          typeof nameOrPayload?.unit_type_id === "number" &&
          Number.isFinite(nameOrPayload.unit_type_id)
        ) {
          unitTypeId = nameOrPayload.unit_type_id;
        }
      }
      if (!name) throw new Error("Unit name is required.");
      const run = db()
        .prepare(
          "INSERT OR IGNORE INTO units (name, symbol, unit_type_id) VALUES (?, ?, ?)"
        )
        .run(name, symbol, unitTypeId);
      const id =
        run.changes > 0
          ? (run as { lastInsertRowid: number }).lastInsertRowid
          : (
              db().prepare("SELECT id FROM units WHERE name = ?").get(name) as {
                id: number;
              }
            ).id;
      return name;
    }
  );

  ipcMain.handle(
    "units:update",
    (
      _,
      id: number,
      payload: {
        name?: string;
        symbol?: string | null;
        unit_type_id?: number | null;
      }
    ) => {
      const row = db().prepare("SELECT * FROM units WHERE id = ?").get(id) as
        | { name: string; symbol: string | null }
        | undefined;
      if (!row) throw new Error("Unit not found");
      const name =
        typeof payload?.name === "string" ? payload.name.trim() : row.name;
      if (!name) throw new Error("Unit name is required.");
      const symbol =
        payload?.symbol !== undefined
          ? (typeof payload.symbol === "string"
              ? payload.symbol.trim()
              : null) || null
          : row.symbol;
      const unitTypeId =
        payload?.unit_type_id !== undefined
          ? typeof payload.unit_type_id === "number" &&
            Number.isFinite(payload.unit_type_id)
            ? payload.unit_type_id
            : null
          : undefined;
      if (unitTypeId !== undefined) {
        db()
          .prepare(
            "UPDATE units SET name = ?, symbol = ?, unit_type_id = ? WHERE id = ?"
          )
          .run(name, symbol, unitTypeId, id);
      } else {
        db()
          .prepare("UPDATE units SET name = ?, symbol = ? WHERE id = ?")
          .run(name, symbol, id);
      }
      return id;
    }
  );

  ipcMain.handle("units:delete", (_, id: number) => {
    const row = db()
      .prepare("SELECT id, name FROM units WHERE id = ?")
      .get(id) as { id: number; name: string } | undefined;
    if (!row) throw new Error("Unit not found");
    if (SEED_UNIT_NAMES.has(row.name))
      throw new Error("Cannot delete: this is a system unit.");
    const usedByUnitId = db()
      .prepare("SELECT 1 FROM items WHERE unit_id = ? LIMIT 1")
      .get(id) as { "1": number } | undefined;
    const used =
      usedByUnitId ??
      (db()
        .prepare("SELECT 1 FROM items WHERE unit = ? LIMIT 1")
        .get(row.name) as { "1": number } | undefined);
    if (used)
      throw new Error("Cannot delete unit: one or more products use it.");
    db().prepare("DELETE FROM units WHERE id = ?").run(id);
    return id;
  });

  // ---- Invoice units (same units table) ----
  ipcMain.handle("invoiceUnits:getAll", () => {
    return db()
      .prepare(
        `SELECT u.id, u.name, u.symbol, u.unit_type_id, t.name AS unit_type_name, u.created_at
         FROM units u
         LEFT JOIN unit_types t ON t.id = u.unit_type_id
         ORDER BY u.name ASC`
      )
      .all();
  });

  ipcMain.handle(
    "invoiceUnits:create",
    (
      _,
      payload: {
        name: string;
        symbol?: string | null;
        unit_type_id?: number | null;
      }
    ) => {
      const name = typeof payload?.name === "string" ? payload.name.trim() : "";
      if (!name) throw new Error("Invoice unit name is required.");
      const symbol =
        typeof payload?.symbol === "string"
          ? payload.symbol.trim() || null
          : null;
      const unitTypeId =
        payload?.unit_type_id !== undefined &&
        typeof payload.unit_type_id === "number" &&
        Number.isFinite(payload.unit_type_id)
          ? payload.unit_type_id
          : null;
      db()
        .prepare(
          "INSERT OR IGNORE INTO units (name, symbol, unit_type_id) VALUES (?, ?, ?)"
        )
        .run(name, symbol, unitTypeId);
      const row = db()
        .prepare("SELECT id FROM units WHERE name = ?")
        .get(name) as { id: number } | undefined;
      if (!row) throw new Error("Unit not found after insert");
      return row.id;
    }
  );

  ipcMain.handle(
    "invoiceUnits:update",
    (
      _,
      id: number,
      payload: { name?: string; symbol?: string | null }
    ) => {
      const row = db().prepare("SELECT * FROM units WHERE id = ?").get(id) as
        | { name: string; symbol: string | null }
        | undefined;
      if (!row) throw new Error("Invoice unit not found");
      const name =
        typeof payload?.name === "string" ? payload.name.trim() : row.name;
      if (!name) throw new Error("Invoice unit name is required.");
      const symbol =
        payload?.symbol !== undefined
          ? (typeof payload.symbol === "string"
              ? payload.symbol.trim()
              : null) || null
          : row.symbol;
      db()
        .prepare("UPDATE units SET name = ?, symbol = ? WHERE id = ?")
        .run(name, symbol, id);
      return id;
    }
  );

  ipcMain.handle("invoiceUnits:delete", (_, id: number) => {
    const row = db().prepare("SELECT id FROM units WHERE id = ?").get(id);
    if (!row) throw new Error("Invoice unit not found");
    return id;
  });

  // ---- Unit conversions ----
  ipcMain.handle("unitConversions:getAll", () => {
    return db()
      .prepare(
        "SELECT id, from_unit, to_unit, factor, created_at FROM unit_conversions ORDER BY from_unit, to_unit"
      )
      .all();
  });

  ipcMain.handle(
    "unitConversions:create",
    (_, payload: { from_unit: string; to_unit: string; factor: number }) => {
      const from = payload.from_unit?.trim();
      const to = payload.to_unit?.trim();
      const factor = Number(payload.factor);
      if (!from || !to) throw new Error("From unit and to unit are required.");
      if (!Number.isFinite(factor) || factor <= 0)
        throw new Error("Factor must be a positive number.");
      const fromId =
        (
          db().prepare("SELECT id FROM units WHERE name = ?").get(from) as
            | { id: number }
            | undefined
        )?.id ?? null;
      const toId =
        (
          db().prepare("SELECT id FROM units WHERE name = ?").get(to) as
            | { id: number }
            | undefined
        )?.id ?? null;
      const result = db()
        .prepare(
          "INSERT INTO unit_conversions (from_unit, to_unit, from_unit_id, to_unit_id, factor) VALUES (?, ?, ?, ?, ?)"
        )
        .run(from, to, fromId, toId, roundDecimal(factor, 10));
      return result.lastInsertRowid as number;
    }
  );

  ipcMain.handle(
    "unitConversions:update",
    (
      _,
      id: number,
      payload: {
        from_unit?: string;
        to_unit?: string;
        factor?: number;
      }
    ) => {
      const row = db()
        .prepare(
          "SELECT id, from_unit, to_unit, factor FROM unit_conversions WHERE id = ?"
        )
        .get(id) as
        | { id: number; from_unit: string; to_unit: string; factor: number }
        | undefined;
      if (!row) throw new Error("Unit conversion not found.");
      const from =
        payload.from_unit !== undefined
          ? payload.from_unit.trim()
          : row.from_unit;
      const to =
        payload.to_unit !== undefined ? payload.to_unit.trim() : row.to_unit;
      const factor =
        payload.factor !== undefined && Number.isFinite(payload.factor)
          ? payload.factor
          : row.factor;
      if (!from || !to) throw new Error("From unit and to unit are required.");
      if (factor <= 0) throw new Error("Factor must be a positive number.");
      const fromId =
        (
          db().prepare("SELECT id FROM units WHERE name = ?").get(from) as
            | { id: number }
            | undefined
        )?.id ?? null;
      const toId =
        (
          db().prepare("SELECT id FROM units WHERE name = ?").get(to) as
            | { id: number }
            | undefined
        )?.id ?? null;
      db()
        .prepare(
          "UPDATE unit_conversions SET from_unit = ?, to_unit = ?, from_unit_id = ?, to_unit_id = ?, factor = ? WHERE id = ?"
        )
        .run(from, to, fromId, toId, roundDecimal(factor, 10), id);
      return id;
    }
  );

  ipcMain.handle("unitConversions:delete", (_, id: number) => {
    const row = db()
      .prepare(
        "SELECT id, from_unit, to_unit FROM unit_conversions WHERE id = ?"
      )
      .get(id) as
      | { id: number; from_unit: string; to_unit: string }
      | undefined;
    if (!row) throw new Error("Unit conversion not found.");
    const key = `${row.from_unit}|${row.to_unit}`;
    if (SEED_CONVERSION_KEYS.has(key))
      throw new Error("Cannot delete: this is a system conversion.");
    db().prepare("DELETE FROM unit_conversions WHERE id = ?").run(id);
    return id;
  });

  // ---- Settings ----
  ipcMain.handle("settings:getAll", () => {
    const rows = db().prepare("SELECT key, value FROM settings").all() as {
      key: string;
      value: string | null;
    }[];
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value ?? "";
    }
    return out;
  });

  ipcMain.handle("settings:get", (_, key: string) => {
    const row = db()
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string | null } | undefined;
    return row?.value ?? "";
  });

  ipcMain.handle("settings:set", (_, key: string, value: string) => {
    const k = typeof key === "string" ? key.trim() : "";
    if (!k) throw new Error("Settings key is required.");
    db()
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(k, value == null ? "" : String(value));
    return;
  });

  ipcMain.handle("settings:setBulk", (_, obj: Record<string, string>) => {
    if (obj == null || typeof obj !== "object") return;
    const stmt = db().prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    for (const [key, value] of Object.entries(obj)) {
      const k = typeof key === "string" ? key.trim() : "";
      if (k) stmt.run(k, value == null ? "" : String(value));
    }
  });

  // ---- Invoices ----
  ipcMain.handle("invoices:getAll", () => {
    return db()
      .prepare("SELECT * FROM invoices ORDER BY invoice_date DESC, id DESC")
      .all();
  });

  ipcMain.handle(
    "invoices:getPage",
    (
      _,
      opts: {
        search?: string;
        page?: number;
        limit?: number;
        dateFrom?: string;
        dateTo?: string;
      }
    ) => {
      const search = typeof opts?.search === "string" ? opts.search.trim() : "";
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
      const offset = (page - 1) * limit;
      const dateFrom = opts?.dateFrom ?? null;
      const dateTo = opts?.dateTo ?? null;
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      if (search) {
        conditions.push(
          "(invoice_number LIKE ? OR customer_name LIKE ? OR customer_address LIKE ?)"
        );
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      if (dateFrom) {
        conditions.push("invoice_date >= ?");
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push("invoice_date <= ?");
        params.push(dateTo);
      }
      const where =
        conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
      const countRow = db()
        .prepare(`SELECT COUNT(*) AS total FROM invoices${where}`)
        .get(...params) as { total: number };
      const rows = db()
        .prepare(
          `SELECT *, (SELECT COALESCE(SUM(amount), 0) FROM invoice_lines WHERE invoice_id = invoices.id) AS total FROM invoices${where} ORDER BY invoice_date DESC, id DESC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset);
      return { data: rows, total: countRow.total };
    }
  );

  ipcMain.handle("invoices:getTotalForDate", (_, saleDate: string) => {
    const row = db()
      .prepare(
        `SELECT COALESCE(SUM(l.amount), 0) AS total FROM invoice_lines l
         JOIN invoices i ON i.id = l.invoice_id WHERE i.invoice_date = ?`
      )
      .get(saleDate) as { total: number } | undefined;
    return { total: roundDecimal(row?.total ?? 0) };
  });

  ipcMain.handle("invoices:getById", (_, id: number) => {
    const invoice = db()
      .prepare("SELECT * FROM invoices WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!invoice) throw new Error("Invoice not found");
    const lines = db()
      .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id")
      .all(id);
    return { ...invoice, lines };
  });

  ipcMain.handle(
    "invoices:create",
    (
      _,
      payload: {
        invoice_number?: string | null;
        customer_name?: string | null;
        customer_address?: string | null;
        invoice_date: string;
        notes?: string | null;
        lines: {
          product_id: number;
          product_name: string;
          quantity: number;
          unit: string;
          price: number;
          amount: number;
          price_entered_as: "per_unit" | "total";
        }[];
      }
    ) => {
      if (!payload.lines?.length)
        throw new Error("At least one line is required.");
      const year = payload.invoice_date.slice(0, 4);
      const prefix = `INV-${year}-`;
      const prefixLen = prefix.length;
      const maxSeq = db()
        .prepare(
          "SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number, ?) AS INTEGER)), 0) AS n FROM invoices WHERE invoice_number LIKE ?"
        )
        .get(prefixLen + 1, prefix + "%") as { n: number } | undefined;
      const nextSeq = (maxSeq?.n ?? 0) + 1;
      const invoiceNumber = `${prefix}${String(nextSeq).padStart(4, "0")}`;
      const run = db().transaction(() => {
        const conversions = getUnitConversionsRows();
        const itemInfoStmt = db().prepare(
          "SELECT id, name, unit, reference_unit, quantity_per_primary, current_stock FROM items WHERE id = ?"
        );
        const stockDeltaByItem = new Map<
          number,
          { name: string; delta: number }
        >();

        const r = db()
          .prepare(
            "INSERT INTO invoices (invoice_number, customer_name, customer_address, invoice_date, notes) VALUES (?, ?, ?, ?, ?)"
          )
          .run(
            invoiceNumber,
            payload.customer_name ?? null,
            payload.customer_address ?? null,
            payload.invoice_date,
            payload.notes ?? null
          );
        const invoiceId = r.lastInsertRowid as number;
        const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
        const stmt = db().prepare(
          "INSERT INTO invoice_lines (invoice_id, product_id, product_name, quantity, unit, unit_id, price, amount, price_entered_as) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const line of payload.lines) {
          const unitId =
            (getUnitId.get(line.unit ?? "") as { id: number } | undefined)
              ?.id ?? null;
          stmt.run(
            invoiceId,
            line.product_id,
            line.product_name ?? null,
            roundDecimal(line.quantity, 6),
            line.unit ?? "",
            unitId,
            roundDecimal(line.price),
            roundDecimal(line.amount),
            line.price_entered_as ?? "per_unit"
          );

          if (line.product_id > 0) {
            const itemRow = itemInfoStmt.get(line.product_id) as
              | {
                  id: number;
                  name: string;
                  unit: string;
                  reference_unit: string | null;
                  quantity_per_primary: number | null;
                  current_stock: number;
                }
              | undefined;
            if (!itemRow) {
              throw new Error("Product not found for invoice line.");
            }
            const itemConvs = getItemUnitConversions(db(), itemRow.id);
            const conv = convertToPrimaryQuantity(
              conversions,
              {
                unit: itemRow.unit,
                reference_unit: itemRow.reference_unit,
                quantity_per_primary: itemRow.quantity_per_primary,
                item_conversions: itemConvs.length > 0 ? itemConvs : undefined,
              },
              line.quantity,
              line.unit
            );
            if ("error" in conv) {
              throw new Error(
                `Cannot deduct stock for ${itemRow.name}: ${conv.error}`
              );
            }
            const prev = stockDeltaByItem.get(itemRow.id)?.delta ?? 0;
            stockDeltaByItem.set(itemRow.id, {
              name: itemRow.name,
              delta: prev - conv.primaryQuantity,
            });
          }
        }

        if (stockDeltaByItem.size > 0) {
          const stockStmt = db().prepare(
            "SELECT current_stock FROM items WHERE id = ?"
          );
          const updateStmt = db().prepare(
            "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
          );
          for (const [itemId, info] of stockDeltaByItem) {
            const row = stockStmt.get(itemId) as
              | { current_stock: number }
              | undefined;
            if (!row) continue;
            const newStock = row.current_stock + info.delta;
            if (newStock < -1e-6) {
              throw new Error(
                `Insufficient stock for ${info.name}. Current: ${row.current_stock}, required: ${-info.delta}.`
              );
            }
            if (info.delta !== 0) {
              updateStmt.run(info.delta, itemId);
            }
          }
        }

        const invoiceTotal = payload.lines.reduce((s, l) => s + roundDecimal(l.amount), 0);
        upsertDailySalesForInvoice(db(), payload.invoice_date, invoiceTotal);

        return invoiceId;
      });
      return run();
    }
  );

  ipcMain.handle(
    "invoices:update",
    (
      _,
      id: number,
      payload: {
        invoice_number?: string | null;
        customer_name?: string | null;
        customer_address?: string | null;
        invoice_date?: string;
        notes?: string | null;
        lines: {
          product_id: number;
          product_name: string;
          quantity: number;
          unit: string;
          price: number;
          amount: number;
          price_entered_as: "per_unit" | "total";
        }[];
      }
    ) => {
      const existing = db()
        .prepare("SELECT * FROM invoices WHERE id = ?")
        .get(id) as { invoice_date: string } | undefined;
      if (!existing) throw new Error("Invoice not found");
      if (!payload.lines?.length)
        throw new Error("At least one line is required.");

      const oldTotalRow = db()
        .prepare(
          "SELECT COALESCE(SUM(amount), 0) AS total FROM invoice_lines WHERE invoice_id = ?"
        )
        .get(id) as { total: number };
      const oldTotal = roundDecimal(oldTotalRow?.total ?? 0);

      const existingLines = db()
        .prepare(
          "SELECT product_id, product_name, quantity, unit FROM invoice_lines WHERE invoice_id = ?"
        )
        .all(id) as {
        product_id: number | null;
        product_name: string | null;
        quantity: number;
        unit: string;
      }[];

      db().transaction(() => {
        const conversions = getUnitConversionsRows();
        const itemInfoStmt = db().prepare(
          "SELECT id, name, unit, reference_unit, quantity_per_primary, current_stock FROM items WHERE id = ?"
        );
        const stockDeltaByItem = new Map<
          number,
          { name: string; delta: number }
        >();

        // Old lines: add back their quantities.
        for (const line of existingLines) {
          if (!line.product_id || line.product_id <= 0) continue;
          const itemRow = itemInfoStmt.get(line.product_id) as
            | {
                id: number;
                name: string;
                unit: string;
                reference_unit: string | null;
                quantity_per_primary: number | null;
                current_stock: number;
              }
            | undefined;
          if (!itemRow) continue;
          const itemConvs = getItemUnitConversions(db(), itemRow.id);
          const conv = convertToPrimaryQuantity(
            conversions,
            {
              unit: itemRow.unit,
              reference_unit: itemRow.reference_unit,
              quantity_per_primary: itemRow.quantity_per_primary,
              item_conversions: itemConvs.length > 0 ? itemConvs : undefined,
            },
            line.quantity,
            line.unit
          );
          if ("error" in conv) {
            throw new Error(
              `Cannot restore stock for ${itemRow.name}: ${conv.error}`
            );
          }
          const prev = stockDeltaByItem.get(itemRow.id)?.delta ?? 0;
          stockDeltaByItem.set(itemRow.id, {
            name: itemRow.name,
            delta: prev + conv.primaryQuantity,
          });
        }

        // New lines: deduct their quantities.
        for (const line of payload.lines) {
          if (line.product_id <= 0) continue;
          const itemRow = itemInfoStmt.get(line.product_id) as
            | {
                id: number;
                name: string;
                unit: string;
                reference_unit: string | null;
                quantity_per_primary: number | null;
                current_stock: number;
              }
            | undefined;
          if (!itemRow) {
            throw new Error("Product not found for invoice line.");
          }
          const itemConvsNew = getItemUnitConversions(db(), line.product_id);
          const conv = convertToPrimaryQuantity(
            conversions,
            {
              unit: itemRow.unit,
              reference_unit: itemRow.reference_unit,
              quantity_per_primary: itemRow.quantity_per_primary,
              item_conversions:
                itemConvsNew.length > 0 ? itemConvsNew : undefined,
            },
            line.quantity,
            line.unit
          );
          if ("error" in conv) {
            throw new Error(
              `Cannot deduct stock for ${itemRow.name}: ${conv.error}`
            );
          }
          const prev = stockDeltaByItem.get(itemRow.id)?.delta ?? 0;
          stockDeltaByItem.set(itemRow.id, {
            name: itemRow.name,
            delta: prev - conv.primaryQuantity,
          });
        }

        db()
          .prepare(
            "UPDATE invoices SET invoice_number = ?, customer_name = ?, customer_address = ?, invoice_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(
            payload.invoice_number ?? null,
            payload.customer_name ?? null,
            payload.customer_address ?? null,
            payload.invoice_date ?? existing.invoice_date,
            payload.notes ?? null,
            id
          );
        db().prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(id);
        const getUnitId = db().prepare("SELECT id FROM units WHERE name = ?");
        const stmt = db().prepare(
          "INSERT INTO invoice_lines (invoice_id, product_id, product_name, quantity, unit, unit_id, price, amount, price_entered_as) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const line of payload.lines) {
          const unitId =
            (getUnitId.get(line.unit ?? "") as { id: number } | undefined)
              ?.id ?? null;
          stmt.run(
            id,
            line.product_id,
            line.product_name ?? null,
            roundDecimal(line.quantity, 6),
            line.unit ?? "",
            unitId,
            roundDecimal(line.price),
            roundDecimal(line.amount),
            line.price_entered_as ?? "per_unit"
          );
        }

        if (stockDeltaByItem.size > 0) {
          const stockStmt = db().prepare(
            "SELECT current_stock FROM items WHERE id = ?"
          );
          const updateStmt = db().prepare(
            "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
          );
          for (const [itemId, info] of stockDeltaByItem) {
            const row = stockStmt.get(itemId) as
              | { current_stock: number }
              | undefined;
            if (!row) continue;
            const newStock = row.current_stock + info.delta;
            if (newStock < -1e-6) {
              throw new Error(
                `Insufficient stock for ${info.name}. Current: ${row.current_stock}, required: ${-info.delta}.`
              );
            }
            if (info.delta !== 0) {
              updateStmt.run(info.delta, itemId);
            }
          }
        }

        const newTotal = payload.lines.reduce(
          (s, l) => s + roundDecimal(l.amount),
          0
        );
        const newDate = payload.invoice_date ?? existing.invoice_date;
        upsertDailySalesForInvoice(db(), existing.invoice_date, -oldTotal);
        upsertDailySalesForInvoice(db(), newDate, newTotal);
      })();
      return id;
    }
  );

  ipcMain.handle("invoices:delete", (_, id: number) => {
    const existing = db()
      .prepare("SELECT id, invoice_date FROM invoices WHERE id = ?")
      .get(id) as { id: number; invoice_date: string } | undefined;
    if (!existing) throw new Error("Invoice not found");

    const totalRow = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM invoice_lines WHERE invoice_id = ?"
      )
      .get(id) as { total: number };
    const invTotal = roundDecimal(totalRow?.total ?? 0);

    const lines = db()
      .prepare(
        "SELECT product_id, product_name, quantity, unit FROM invoice_lines WHERE invoice_id = ?"
      )
      .all(id) as {
      product_id: number | null;
      product_name: string | null;
      quantity: number;
      unit: string;
    }[];

    db().transaction(() => {
      const conversions = getUnitConversionsRows();
      const itemInfoStmt = db().prepare(
        "SELECT id, name, unit, reference_unit, quantity_per_primary, current_stock FROM items WHERE id = ?"
      );
      const stockDeltaByItem = new Map<
        number,
        { name: string; delta: number }
      >();

      for (const line of lines) {
        if (!line.product_id || line.product_id <= 0) continue;
        const itemRow = itemInfoStmt.get(line.product_id) as
          | {
              id: number;
              name: string;
              unit: string;
              reference_unit: string | null;
              quantity_per_primary: number | null;
              current_stock: number;
            }
          | undefined;
        if (!itemRow) continue;
        const itemConvsDel = getItemUnitConversions(db(), itemRow.id);
        const conv = convertToPrimaryQuantity(
          conversions,
          {
            unit: itemRow.unit,
            reference_unit: itemRow.reference_unit,
            quantity_per_primary: itemRow.quantity_per_primary,
            item_conversions:
              itemConvsDel.length > 0 ? itemConvsDel : undefined,
          },
          line.quantity,
          line.unit
        );
        if ("error" in conv) {
          throw new Error(
            `Cannot restore stock for ${itemRow.name}: ${conv.error}`
          );
        }
        const prev = stockDeltaByItem.get(itemRow.id)?.delta ?? 0;
        stockDeltaByItem.set(itemRow.id, {
          name: itemRow.name,
          delta: prev + conv.primaryQuantity,
        });
      }

      if (stockDeltaByItem.size > 0) {
        const updateStmt = db().prepare(
          "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
        );
        for (const [itemId, info] of stockDeltaByItem) {
          if (info.delta !== 0) {
            updateStmt.run(info.delta, itemId);
          }
        }
      }

      upsertDailySalesForInvoice(db(), existing.invoice_date, -invTotal);

      db().prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(id);
      db().prepare("DELETE FROM invoices WHERE id = ?").run(id);
    })();
    return id;
  });

  // ---- Mahajans ----
  ipcMain.handle("mahajans:getAll", () => {
    return db().prepare("SELECT * FROM mahajans ORDER BY name").all();
  });

  ipcMain.handle(
    "mahajans:getPage",
    (_, opts: { search?: string; page?: number; limit?: number }) => {
      const search = typeof opts?.search === "string" ? opts.search.trim() : "";
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
      const offset = (page - 1) * limit;
      const likeArg = search ? `%${search}%` : null;
      if (likeArg) {
        const countRow = db()
          .prepare(
            "SELECT COUNT(*) AS total FROM mahajans WHERE name LIKE ? OR COALESCE(address, '') LIKE ? OR COALESCE(phone, '') LIKE ?"
          )
          .get(likeArg, likeArg, likeArg) as { total: number };
        const rows = db()
          .prepare(
            "SELECT * FROM mahajans WHERE name LIKE ? OR COALESCE(address, '') LIKE ? OR COALESCE(phone, '') LIKE ? ORDER BY name LIMIT ? OFFSET ?"
          )
          .all(likeArg, likeArg, likeArg, limit, offset);
        return { data: rows, total: countRow.total };
      }
      const countRow = db()
        .prepare("SELECT COUNT(*) AS total FROM mahajans")
        .get() as { total: number };
      const rows = db()
        .prepare("SELECT * FROM mahajans ORDER BY name LIMIT ? OFFSET ?")
        .all(limit, offset);
      return { data: rows, total: countRow.total };
    }
  );

  ipcMain.handle(
    "mahajans:create",
    (
      _,
      m: { name: string; address?: string; phone?: string; gstin?: string }
    ) => {
      const result = db()
        .prepare(
          "INSERT INTO mahajans (name, address, phone, gstin) VALUES (?, ?, ?, ?)"
        )
        .run(m.name, m.address ?? null, m.phone ?? null, m.gstin ?? null);
      return result.lastInsertRowid;
    }
  );

  ipcMain.handle(
    "mahajans:update",
    (
      _,
      id: number,
      m: { name?: string; address?: string; phone?: string; gstin?: string }
    ) => {
      const row = db()
        .prepare("SELECT * FROM mahajans WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Mahajan not found");
      db()
        .prepare(
          "UPDATE mahajans SET name = ?, address = ?, phone = ?, gstin = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          m.name ?? row.name,
          m.address !== undefined ? m.address : row.address,
          m.phone !== undefined ? m.phone : row.phone,
          m.gstin !== undefined ? m.gstin : row.gstin,
          id
        );
      return id;
    }
  );

  ipcMain.handle("mahajans:delete", (_, id: number) => {
    const lends = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'lend' AND mahajan_id = ?"
      )
      .get(id) as { total: number };
    const deposits = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'deposit' AND mahajan_id = ?"
      )
      .get(id) as { total: number };
    const balance = (lends?.total ?? 0) - (deposits?.total ?? 0);
    if (balance !== 0)
      throw new Error(
        "Mahajan balance must be 0 to delete. Clear lends and deposits first."
      );
    db().prepare("DELETE FROM transactions WHERE mahajan_id = ?").run(id);
    db().prepare("DELETE FROM mahajans WHERE id = ?").run(id);
    return id;
  });

  // ---- Mahajan Lends (transactions type='lend') ----
  ipcMain.handle("mahajanLends:getAll", (_, mahajanId?: number) => {
    const base =
      "SELECT u.id, u.mahajan_id, u.product_id, COALESCE(i.name, u.product_name) AS product_name, u.quantity, u.amount, u.transaction_date, u.notes, u.created_at, u.updated_at FROM transactions u LEFT JOIN items i ON u.product_id = i.id WHERE u.type = 'lend'";
    if (mahajanId != null) {
      return db()
        .prepare(
          base +
            " AND u.mahajan_id = ? ORDER BY u.transaction_date DESC, u.id DESC"
        )
        .all(mahajanId);
    }
    return db()
      .prepare(base + " ORDER BY u.transaction_date DESC, u.id DESC")
      .all();
  });

  ipcMain.handle(
    "mahajanLends:create",
    (
      _,
      l: {
        mahajan_id: number;
        product_id?: number | null;
        product_name?: string;
        quantity?: number;
        transaction_date: string;
        amount: number;
        notes?: string;
      }
    ) => {
      const quantity = roundDecimal(l.quantity ?? 0);
      const amount = roundDecimal(l.amount);
      const result = db()
        .prepare(
          "INSERT INTO transactions (type, mahajan_id, product_id, quantity, amount, transaction_date, notes) VALUES ('lend', ?, ?, ?, ?, ?, ?)"
        )
        .run(
          l.mahajan_id,
          l.product_id ?? null,
          quantity,
          amount,
          l.transaction_date,
          l.notes ?? null
        );
      if (l.product_id != null && quantity > 0) {
        const row = db()
          .prepare("SELECT current_stock FROM items WHERE id = ?")
          .get(l.product_id) as { current_stock: number } | undefined;
        if (!row) throw new Error("Item not found");
        db()
          .prepare(
            "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(quantity, l.product_id);
      }
      return result.lastInsertRowid;
    }
  );

  type LendLine = {
    product_id: number;
    product_name?: string;
    quantity: number;
    amount: number;
  };
  // Lend = mahajan lends TO us → we receive stock → ADD to current_stock (no insufficient-stock check).
  ipcMain.handle(
    "mahajanLends:createBatch",
    (
      _,
      payload: {
        mahajan_id: number;
        transaction_date: string;
        notes?: string;
        lines: LendLine[];
      }
    ) => {
      if (!payload.lines?.length)
        throw new Error("At least one product line is required.");
      const batchUuid = randomUUID();
      const run = db().transaction(() => {
        const ids: number[] = [];
        for (const line of payload.lines) {
          const qty = roundDecimal(line.quantity);
          if (qty <= 0) throw new Error("Quantity must be positive.");
          const row = db()
            .prepare("SELECT current_stock FROM items WHERE id = ?")
            .get(line.product_id) as { current_stock: number } | undefined;
          if (!row) throw new Error(`Item not found: ${line.product_id}`);
          const result = db()
            .prepare(
              "INSERT INTO transactions (type, batch_uuid, mahajan_id, product_id, quantity, amount, transaction_date, notes) VALUES ('lend', ?, ?, ?, ?, ?, ?, ?)"
            )
            .run(
              batchUuid,
              payload.mahajan_id,
              line.product_id,
              qty,
              roundDecimal(line.amount),
              payload.transaction_date,
              payload.notes ?? null
            );
          ids.push(Number(result.lastInsertRowid));
          db()
            .prepare(
              "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(qty, line.product_id);
        }
        return ids;
      });
      return run();
    }
  );

  ipcMain.handle(
    "mahajanLends:update",
    (
      _,
      id: number,
      l: {
        mahajan_id?: number;
        product_id?: number | null;
        product_name?: string;
        quantity?: number;
        transaction_date?: string;
        amount?: number;
        notes?: string;
      }
    ) => {
      const row = db()
        .prepare("SELECT * FROM transactions WHERE id = ? AND type = 'lend'")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Lend not found");
      const oldProductId = row.product_id as number | null;
      const oldQuantity = (row.quantity as number) ?? 0;
      const newProductId =
        l.product_id !== undefined ? l.product_id : oldProductId;
      const newQuantity =
        l.quantity !== undefined ? roundDecimal(l.quantity) : oldQuantity;
      const newAmount =
        l.amount !== undefined
          ? roundDecimal(l.amount)
          : (row.amount as number);

      db().transaction(() => {
        db()
          .prepare(
            "UPDATE transactions SET mahajan_id = ?, product_id = ?, quantity = ?, transaction_date = ?, amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(
            l.mahajan_id !== undefined ? l.mahajan_id : row.mahajan_id,
            newProductId,
            newQuantity,
            l.transaction_date ?? row.transaction_date,
            newAmount,
            l.notes !== undefined ? l.notes : row.notes,
            id
          );
        if (oldProductId != null && oldQuantity > 0) {
          const oldStock = db()
            .prepare("SELECT current_stock FROM items WHERE id = ?")
            .get(oldProductId) as { current_stock: number } | undefined;
          if (!oldStock) throw new Error("Item not found");
          if (oldStock.current_stock < oldQuantity) {
            throw new Error(
              `Cannot update: would result in negative stock (current ${oldStock.current_stock}, lend quantity ${oldQuantity}).`
            );
          }
          db()
            .prepare(
              "UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(oldQuantity, oldProductId);
        }
        if (newProductId != null && newQuantity > 0) {
          const item = db()
            .prepare("SELECT current_stock FROM items WHERE id = ?")
            .get(newProductId) as { current_stock: number } | undefined;
          if (!item) throw new Error("Item not found");
          db()
            .prepare(
              "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(newQuantity, newProductId);
        }
      })();
      return id;
    }
  );

  ipcMain.handle("mahajanLends:delete", (_, id: number) => {
    const lend = db()
      .prepare(
        "SELECT product_id, quantity FROM transactions WHERE id = ? AND type = 'lend'"
      )
      .get(id) as { product_id: number | null; quantity: number } | undefined;
    if (lend?.product_id != null && (lend.quantity ?? 0) > 0) {
      const row = db()
        .prepare("SELECT current_stock FROM items WHERE id = ?")
        .get(lend.product_id) as { current_stock: number } | undefined;
      if (row && row.current_stock < lend.quantity) {
        throw new Error(
          `Cannot delete lend: would result in negative stock (current ${row.current_stock}, lend quantity ${lend.quantity}).`
        );
      }
      db()
        .prepare(
          "UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(lend.quantity, lend.product_id);
    }
    db().prepare("DELETE FROM transactions WHERE id = ?").run(id);
    return id;
  });

  // ---- Mahajan Deposits (transactions type='deposit') ----
  ipcMain.handle("mahajanDeposits:getAll", (_, mahajanId?: number) => {
    const sql =
      "SELECT id, mahajan_id, amount, transaction_date, notes, created_at, updated_at FROM transactions WHERE type = 'deposit'";
    if (mahajanId != null) {
      return db()
        .prepare(
          sql + " AND mahajan_id = ? ORDER BY transaction_date DESC, id DESC"
        )
        .all(mahajanId);
    }
    return db()
      .prepare(sql + " ORDER BY transaction_date DESC, id DESC")
      .all();
  });

  ipcMain.handle(
    "mahajanDeposits:create",
    (
      _,
      d: {
        mahajan_id: number;
        transaction_date: string;
        amount: number;
        notes?: string;
      }
    ) => {
      const result = db()
        .prepare(
          "INSERT INTO transactions (type, mahajan_id, amount, transaction_date, notes) VALUES ('deposit', ?, ?, ?, ?)"
        )
        .run(
          d.mahajan_id,
          roundDecimal(d.amount),
          d.transaction_date,
          d.notes ?? null
        );
      return result.lastInsertRowid;
    }
  );

  ipcMain.handle(
    "mahajanDeposits:update",
    (
      _,
      id: number,
      d: { transaction_date?: string; amount?: number; notes?: string }
    ) => {
      const row = db()
        .prepare("SELECT * FROM transactions WHERE id = ? AND type = 'deposit'")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Deposit not found");
      db()
        .prepare(
          "UPDATE transactions SET transaction_date = ?, amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          d.transaction_date ?? row.transaction_date,
          roundDecimal(d.amount ?? (row.amount as number)),
          d.notes !== undefined ? d.notes : row.notes,
          id
        );
      return id;
    }
  );

  ipcMain.handle("mahajanDeposits:delete", (_, id: number) => {
    db().prepare("DELETE FROM transactions WHERE id = ?").run(id);
    return id;
  });

  // ---- Mahajan Ledger (unified lends + deposits + purchases, paginated) ----
  type LedgerFilters = {
    mahajanId?: number | null;
    type?: "all" | "lend" | "deposit" | "cash_purchase";
    transactionType?: "all" | "lend" | "deposit" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  };
  ipcMain.handle("mahajanLedger:getPage", (_, opts: LedgerFilters) => {
    const rawType = opts?.transactionType ?? opts?.type;
    const typeFilter: "all" | "lend" | "deposit" | "cash_purchase" =
      rawType === "cash_purchase"
        ? "cash_purchase"
        : rawType === "lend"
          ? "lend"
          : rawType === "deposit"
            ? "deposit"
            : "all";
    // When showing only cash purchases, ignore mahajan (cash_purchase have no mahajan_id)
    const mahajanId =
      typeFilter === "cash_purchase" ? null : (opts?.mahajanId ?? null);
    const dateFrom =
      typeof opts?.dateFrom === "string" ? opts.dateFrom.trim() : "";
    const dateTo = typeof opts?.dateTo === "string" ? opts.dateTo.trim() : "";
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
    const offset = (page - 1) * limit;

    const whereParts: string[] = [];
    const params: (number | string)[] = [];
    if (mahajanId != null) {
      whereParts.push("u.mahajan_id = ?");
      params.push(mahajanId);
    }
    if (typeFilter === "all") {
      if (mahajanId != null) {
        whereParts.push("u.type IN ('lend','deposit')");
      } else {
        whereParts.push("u.type IN ('lend','deposit','cash_purchase')");
      }
    } else {
      whereParts.push("u.type = ?");
      params.push(typeFilter);
    }
    if (dateFrom) {
      whereParts.push("u.transaction_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      whereParts.push("u.transaction_date <= ?");
      params.push(dateTo);
    }
    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";
    const countSql = `SELECT COUNT(*) AS total FROM transactions u LEFT JOIN mahajans m ON u.mahajan_id = m.id ${whereClause}`;
    const countRow = (
      params.length
        ? db()
            .prepare(countSql)
            .get(...params)
        : db().prepare(countSql).get()
    ) as { total: number };
    const dataSql = `SELECT u.type, u.id, u.mahajan_id, m.name AS mahajan_name, u.product_id, u.transaction_date, COALESCE(i.name, u.product_name) AS product_name, u.quantity, u.amount, u.notes FROM transactions u LEFT JOIN mahajans m ON u.mahajan_id = m.id LEFT JOIN items i ON u.product_id = i.id ${whereClause} ORDER BY u.transaction_date DESC, u.id DESC LIMIT ? OFFSET ?`;
    const dataRows = (
      params.length
        ? db()
            .prepare(dataSql)
            .all(...params, limit, offset)
        : db().prepare(dataSql).all(limit, offset)
    ) as {
      type: string;
      id: number;
      mahajan_id: number | null;
      mahajan_name: string | null;
      product_id: number | null;
      transaction_date: string;
      product_name: string | null;
      quantity: number | null;
      amount: number;
      notes: string | null;
    }[];
    return { data: dataRows, total: countRow.total };
  });

  // ---- Daily Sales ----
  ipcMain.handle(
    "dailySales:getAll",
    (_, fromDate?: string, toDate?: string) => {
      if (fromDate && toDate) {
        return db()
          .prepare(
            "SELECT * FROM daily_sales WHERE sale_date BETWEEN ? AND ? ORDER BY sale_date DESC, id DESC"
          )
          .all(fromDate, toDate);
      }
      return db()
        .prepare("SELECT * FROM daily_sales ORDER BY sale_date DESC, id DESC")
        .all();
    }
  );

  ipcMain.handle(
    "dailySales:getPage",
    (
      _,
      opts: {
        fromDate?: string;
        toDate?: string;
        page?: number;
        limit?: number;
      }
    ) => {
      const fromDate = opts?.fromDate?.trim() ?? "";
      const toDate = opts?.toDate?.trim() ?? "";
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
      const offset = (page - 1) * limit;
      if (fromDate && toDate) {
        const countRow = db()
          .prepare(
            "SELECT COUNT(*) AS total FROM daily_sales WHERE sale_date BETWEEN ? AND ?"
          )
          .get(fromDate, toDate) as { total: number };
        const rows = db()
          .prepare(
            "SELECT * FROM daily_sales WHERE sale_date BETWEEN ? AND ? ORDER BY sale_date DESC, id DESC LIMIT ? OFFSET ?"
          )
          .all(fromDate, toDate, limit, offset);
        return { data: rows, total: countRow.total };
      }
      const countRow = db()
        .prepare("SELECT COUNT(*) AS total FROM daily_sales")
        .get() as { total: number };
      const rows = db()
        .prepare(
          "SELECT * FROM daily_sales ORDER BY sale_date DESC, id DESC LIMIT ? OFFSET ?"
        )
        .all(limit, offset);
      return { data: rows, total: countRow.total };
    }
  );

  ipcMain.handle(
    "dailySales:create",
    (
      _,
      s: {
        sale_date: string;
        sale_amount?: number;
        misc_sales?: number;
        cash_in_hand: number;
        expenditure_amount?: number;
        notes?: string;
      }
    ) => {
      const misc = roundDecimal(
        s.misc_sales ?? s.sale_amount ?? 0
      );
      const invRow = db()
        .prepare(
          `SELECT COALESCE(SUM(l.amount), 0) AS total FROM invoice_lines l
           JOIN invoices i ON i.id = l.invoice_id WHERE i.invoice_date = ?`
        )
        .get(s.sale_date) as { total: number } | undefined;
      const invSales = roundDecimal(invRow?.total ?? 0);
      const saleAmount = roundDecimal(invSales + misc);
      const existing = db()
        .prepare(
          "SELECT id FROM daily_sales WHERE sale_date = ? LIMIT 1"
        )
        .get(s.sale_date) as { id: number } | undefined;
      if (existing) {
        db()
          .prepare(
            "UPDATE daily_sales SET misc_sales = ?, sale_amount = ?, cash_in_hand = ?, expenditure_amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
          )
          .run(
            misc,
            saleAmount,
            roundDecimal(s.cash_in_hand),
            s.expenditure_amount != null
              ? roundDecimal(s.expenditure_amount)
              : null,
            s.notes ?? null,
            existing.id
          );
        return existing.id;
      }
      const result = db()
        .prepare(
          "INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, expenditure_amount, invoice_sales, misc_sales, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          s.sale_date,
          saleAmount,
          roundDecimal(s.cash_in_hand),
          s.expenditure_amount != null
            ? roundDecimal(s.expenditure_amount)
            : null,
          invSales,
          misc,
          s.notes ?? null
        );
      return result.lastInsertRowid as number;
    }
  );

  ipcMain.handle(
    "dailySales:update",
    (
      _,
      id: number,
      s: {
        sale_date?: string;
        sale_amount?: number;
        misc_sales?: number;
        cash_in_hand?: number;
        expenditure_amount?: number;
        notes?: string;
      }
    ) => {
      const row = db()
        .prepare("SELECT * FROM daily_sales WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Sale not found");
      const newDate = s.sale_date ?? (row.sale_date as string);
      if (newDate !== (row.sale_date as string)) {
        const existing = db()
          .prepare(
            "SELECT id FROM daily_sales WHERE sale_date = ? AND id != ? LIMIT 1"
          )
          .get(newDate, id);
        if (existing) {
          throw new Error("A daily sale already exists for this date.");
        }
      }
      const invSales = roundDecimal((row.invoice_sales as number) ?? 0);
      const misc =
        s.misc_sales !== undefined
          ? roundDecimal(s.misc_sales)
          : s.sale_amount !== undefined
            ? roundDecimal(s.sale_amount)
            : roundDecimal((row.misc_sales as number) ?? 0);
      const saleAmount = roundDecimal(invSales + misc);
      db()
        .prepare(
          "UPDATE daily_sales SET sale_date = ?, sale_amount = ?, misc_sales = ?, cash_in_hand = ?, expenditure_amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          s.sale_date ?? row.sale_date,
          saleAmount,
          misc,
          roundDecimal(
            s.cash_in_hand ?? (row.cash_in_hand as number)
          ),
          s.expenditure_amount !== undefined
            ? s.expenditure_amount != null
              ? roundDecimal(s.expenditure_amount)
              : null
            : row.expenditure_amount,
          s.notes !== undefined ? s.notes : row.notes,
          id
        );
      return id;
    }
  );

  ipcMain.handle("dailySales:delete", (_, id: number) => {
    db().prepare("DELETE FROM daily_sales WHERE id = ?").run(id);
    return id;
  });

  // ---- Purchases (transactions type='cash_purchase') ----
  ipcMain.handle(
    "purchases:getAll",
    (_, fromDate?: string, toDate?: string) => {
      const sql =
        "SELECT id, product_id, quantity, amount, transaction_date, notes, created_at, updated_at FROM transactions WHERE type = 'cash_purchase'";
      if (fromDate && toDate) {
        return db()
          .prepare(
            sql +
              " AND transaction_date BETWEEN ? AND ? ORDER BY transaction_date DESC, id DESC"
          )
          .all(fromDate, toDate);
      }
      return db()
        .prepare(sql + " ORDER BY transaction_date DESC, id DESC")
        .all();
    }
  );

  ipcMain.handle(
    "purchases:getPage",
    (
      _,
      opts: {
        fromDate?: string;
        toDate?: string;
        page?: number;
        limit?: number;
      }
    ) => {
      const fromDate = opts?.fromDate?.trim() ?? "";
      const toDate = opts?.toDate?.trim() ?? "";
      const page = Math.max(1, opts?.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts?.limit ?? PAGE_SIZE));
      const offset = (page - 1) * limit;
      const base =
        "SELECT p.id, p.product_id, p.quantity, p.amount, p.transaction_date, p.notes, p.created_at, p.updated_at, i.name AS product_name FROM transactions p LEFT JOIN items i ON p.product_id = i.id WHERE p.type = 'cash_purchase'";
      if (fromDate && toDate) {
        const countRow = db()
          .prepare(
            "SELECT COUNT(*) AS total FROM transactions WHERE type = 'cash_purchase' AND transaction_date BETWEEN ? AND ?"
          )
          .get(fromDate, toDate) as { total: number };
        const rows = db()
          .prepare(
            base +
              " AND p.transaction_date BETWEEN ? AND ? ORDER BY p.transaction_date DESC, p.id DESC LIMIT ? OFFSET ?"
          )
          .all(fromDate, toDate, limit, offset);
        return { data: rows, total: countRow.total };
      }
      const countRow = db()
        .prepare(
          "SELECT COUNT(*) AS total FROM transactions WHERE type = 'cash_purchase'"
        )
        .get() as { total: number };
      const rows = db()
        .prepare(
          base + " ORDER BY p.transaction_date DESC, p.id DESC LIMIT ? OFFSET ?"
        )
        .all(limit, offset);
      return { data: rows, total: countRow.total };
    }
  );

  ipcMain.handle(
    "purchases:create",
    (
      _,
      p: {
        product_id: number;
        transaction_date: string;
        quantity: number;
        amount: number;
        notes?: string;
      }
    ) => {
      const qty = roundDecimal(p.quantity);
      if (qty < 0)
        throw new Error("Quantity is required and must be non-negative.");
      const result = db()
        .prepare(
          "INSERT INTO transactions (type, product_id, quantity, amount, transaction_date, notes) VALUES ('cash_purchase', ?, ?, ?, ?, ?)"
        )
        .run(
          p.product_id,
          qty,
          roundDecimal(p.amount),
          p.transaction_date,
          p.notes ?? null
        );
      return result.lastInsertRowid;
    }
  );

  type PurchaseLine = { product_id: number; quantity: number; amount: number };
  ipcMain.handle(
    "purchases:createBatch",
    (
      _,
      payload: {
        transaction_date: string;
        notes?: string;
        lines: PurchaseLine[];
      }
    ) => {
      if (!payload.lines?.length)
        throw new Error("At least one product line is required.");
      const run = db().transaction(() => {
        const ids: number[] = [];
        for (const line of payload.lines) {
          const qty = roundDecimal(line.quantity);
          if (qty < 0)
            throw new Error("Quantity is required and must be non-negative.");
          if (line.amount < 0) throw new Error("Amount must be non-negative.");
          const result = db()
            .prepare(
              "INSERT INTO transactions (type, product_id, quantity, amount, transaction_date, notes) VALUES ('cash_purchase', ?, ?, ?, ?, ?)"
            )
            .run(
              line.product_id,
              qty,
              roundDecimal(line.amount),
              payload.transaction_date,
              payload.notes ?? null
            );
          ids.push(Number(result.lastInsertRowid));
        }
        return ids;
      });
      return run();
    }
  );

  ipcMain.handle(
    "purchases:update",
    (
      _,
      id: number,
      p: {
        transaction_date?: string;
        quantity?: number;
        amount?: number;
        notes?: string;
      }
    ) => {
      const row = db()
        .prepare(
          "SELECT * FROM transactions WHERE id = ? AND type = 'cash_purchase'"
        )
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Cash purchase not found");
      const quantity =
        p.quantity !== undefined
          ? roundDecimal(p.quantity)
          : (row.quantity as number);
      if (quantity < 0)
        throw new Error("Quantity is required and must be non-negative.");
      db()
        .prepare(
          "UPDATE transactions SET transaction_date = ?, quantity = ?, amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          p.transaction_date ?? row.transaction_date,
          quantity,
          roundDecimal(p.amount ?? (row.amount as number)),
          p.notes !== undefined ? p.notes : row.notes,
          id
        );
      return id;
    }
  );

  ipcMain.handle("purchases:delete", (_, id: number) => {
    db().prepare("DELETE FROM transactions WHERE id = ?").run(id);
    return id;
  });

  // ---- Reports ----
  ipcMain.handle("reports:getTotalLend", () => {
    const row = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'lend'"
      )
      .get() as { total: number };
    return { totalLend: row?.total ?? 0 };
  });

  ipcMain.handle("reports:getMahajanSummary", () => {
    const totalLendRow = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'lend'"
      )
      .get() as { total: number };
    const totalDepositRow = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'deposit'"
      )
      .get() as { total: number };
    const balanceRows = db()
      .prepare(
        `SELECT mahajan_id,
          COALESCE(SUM(CASE WHEN type = 'lend' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS balance
         FROM transactions WHERE type IN ('lend','deposit') GROUP BY mahajan_id`
      )
      .all() as { mahajan_id: number; balance: number }[];
    const totalLend = Number(totalLendRow?.total ?? 0);
    const totalDeposit = Number(totalDepositRow?.total ?? 0);
    const balance = totalLend - totalDeposit;
    let countOweMe = 0;
    let countIOwe = 0;
    for (const r of balanceRows) {
      const b = Number(r.balance);
      if (b < 0) countOweMe += 1;
      else if (b > 0) countIOwe += 1;
    }
    return {
      totalLend,
      totalDeposit,
      balance,
      countOweMe,
      countIOwe,
    };
  });

  ipcMain.handle("reports:getAllMahajanBalances", () => {
    const rows = db()
      .prepare(
        `SELECT mahajan_id,
          COALESCE(SUM(CASE WHEN type = 'lend' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS balance
         FROM transactions WHERE type IN ('lend','deposit') GROUP BY mahajan_id`
      )
      .all() as { mahajan_id: number; balance: number }[];
    const balances: Record<number, number> = {};
    for (const r of rows) balances[r.mahajan_id] = r.balance;
    return { balances };
  });

  ipcMain.handle("reports:getMahajanBalance", (_, mahajanId: number) => {
    const lends = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'lend' AND mahajan_id = ?"
      )
      .get(mahajanId) as { total: number };
    const deposits = db()
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'deposit' AND mahajan_id = ?"
      )
      .get(mahajanId) as { total: number };
    const totalLends = lends?.total ?? 0;
    const totalDeposits = deposits?.total ?? 0;
    return { totalLends, totalDeposits, balance: totalLends - totalDeposits };
  });

  ipcMain.handle("reports:getMahajanLedger", (_, mahajanId: number) => {
    const rows = db()
      .prepare(
        "SELECT id, transaction_date, type, COALESCE(product_name, (SELECT name FROM items WHERE items.id = transactions.product_id)) AS description, amount FROM transactions WHERE type IN ('lend','deposit') AND mahajan_id = ?"
      )
      .all(mahajanId) as {
      id: number;
      transaction_date: string;
      type: string;
      description: string | null;
      amount: number;
    }[];
    const combined: {
      transaction_date: string;
      type: "lend" | "deposit";
      description: string;
      amount: number;
      id: number;
    }[] = rows.map((r) => ({
      ...r,
      type: r.type as "lend" | "deposit",
      description: r.type === "deposit" ? "Deposit" : r.description || "Lend",
    }));
    combined.sort((a, b) =>
      b.transaction_date === a.transaction_date
        ? b.id - a.id
        : b.transaction_date.localeCompare(a.transaction_date)
    );
    return combined;
  });

  ipcMain.handle("reports:getWeeklySale", (_, fromDate: string) => {
    return db()
      .prepare(
        "SELECT * FROM daily_sales WHERE sale_date <= ? ORDER BY sale_date DESC LIMIT 7"
      )
      .all(fromDate);
  });

  ipcMain.handle(
    "reports:getTotalSale",
    (_, fromDate: string, toDate: string) => {
      const rows = db()
        .prepare(
          "SELECT COALESCE(SUM(sale_amount), 0) AS total, COALESCE(SUM(expenditure_amount), 0) AS expenditure FROM daily_sales WHERE sale_date BETWEEN ? AND ?"
        )
        .get(fromDate, toDate) as { total: number; expenditure: number };
      return rows;
    }
  );

  ipcMain.handle("reports:getOpeningBalance", (_, year: number) => {
    const row = db()
      .prepare("SELECT amount FROM opening_balance WHERE year = ?")
      .get(year) as { amount: number } | undefined;
    return row?.amount ?? 0;
  });

  ipcMain.handle(
    "reports:setOpeningBalance",
    (_, year: number, amount: number) => {
      const rounded = roundDecimal(amount);
      db()
        .prepare(
          "INSERT INTO opening_balance (year, amount, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(year) DO UPDATE SET amount = ?, updated_at = datetime('now')"
        )
        .run(year, rounded, rounded);
      return year;
    }
  );

  ipcMain.handle(
    "reports:getProfitLoss",
    (_, year: number, closingBalance: number) => {
      const opening = db()
        .prepare("SELECT amount FROM opening_balance WHERE year = ?")
        .get(year) as { amount: number } | undefined;
      const openingBalance = opening?.amount ?? 0;
      const sales = db()
        .prepare(
          "SELECT COALESCE(SUM(sale_amount), 0) AS total, COALESCE(SUM(expenditure_amount), 0) AS expenditure FROM daily_sales WHERE strftime('%Y', sale_date) = ?"
        )
        .get(String(year)) as { total: number; expenditure: number };
      const totalSale = sales?.total ?? 0;
      const totalExpenditure = sales?.expenditure ?? 0;
      const profitLoss =
        closingBalance - openingBalance - totalSale + totalExpenditure;
      return {
        openingBalance,
        totalSale,
        totalExpenditure,
        closingBalance,
        profitLoss,
      };
    }
  );

  // ---- Database danger zone (Settings) ----
  ipcMain.handle("db:getPath", () => getDbPath());

  ipcMain.handle("db:populateSampleData", () => {
    populateSampleData(db());
  });

  ipcMain.handle("db:clearTables", () => {
    const database = db();
    const tables = [
      "invoice_lines",
      "invoices",
      "transactions",
      "daily_sales",
      "opening_balance",
      "item_other_units",
      "items",
      "mahajans",
      "unit_conversions",
      "units",
      "unit_types",
      "settings",
    ];
    for (const table of tables) {
      database.prepare(`DELETE FROM ${table}`).run();
    }
    database.prepare("VACUUM").run();
    fs.writeFileSync(getSkipSeedFlagPath(), "");
  });

  ipcMain.handle("db:clearEntireDb", () => {
    closeDb();
    const dbFilePath = getDbPath();
    if (fs.existsSync(dbFilePath)) {
      fs.unlinkSync(dbFilePath);
    }
    fs.writeFileSync(getSkipSeedFlagPath(), "");
    getDb(); // recreate without re-seeding
  });

  ipcMain.handle("db:exportDb", async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ??
      BrowserWindow.getFocusedWindow();
    const opts = {
      title: "Export database",
      defaultPath: "godown-export.db",
      filters: [{ name: "SQLite database", extensions: ["db"] }],
    };
    const result = win
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { canceled: true };
    const dest = result.filePath;
    closeDb();
    const src = getDbPath();
    fs.copyFileSync(src, dest);
    getDb();
    return { canceled: false, path: dest };
  });

  ipcMain.handle("db:importDb", async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ??
      BrowserWindow.getFocusedWindow();
    const opts: OpenDialogOptions = {
      title: "Import database",
      filters: [{ name: "SQLite database", extensions: ["db"] }],
      properties: ["openFile"],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || result.filePaths.length === 0)
      return { canceled: true };
    const src = result.filePaths[0];
    closeDb();
    const dest = getDbPath();
    fs.copyFileSync(src, dest);
    getDb();
    return { canceled: false };
  });
}
