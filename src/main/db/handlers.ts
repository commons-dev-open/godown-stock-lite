import { randomUUID } from "crypto";
import { ipcMain } from "electron";
import { getDb } from "./index";

export function registerIpcHandlers(): void {
  function db() {
    return getDb();
  }

  const PAGE_SIZE = 30;

  // ---- Items ----
  ipcMain.handle("items:getAll", () => {
    return db().prepare("SELECT * FROM items ORDER BY name").all();
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
        current_stock?: number;
        reorder_level?: number;
      }
    ) => {
      const result = db()
        .prepare(
          "INSERT INTO items (name, code, unit, current_stock, reorder_level) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          item.name,
          item.code ?? null,
          item.unit || "pcs",
          item.current_stock ?? 0,
          item.reorder_level ?? null
        );
      return result.lastInsertRowid;
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
        current_stock?: number;
        reorder_level?: number;
      }
    ) => {
      const row = db().prepare("SELECT * FROM items WHERE id = ?").get(id) as
        | {
            name: string;
            code: string | null;
            unit: string;
            current_stock: number;
            reorder_level: number | null;
          }
        | undefined;
      if (!row) throw new Error("Item not found");
      db()
        .prepare(
          "UPDATE items SET name = ?, code = ?, unit = ?, current_stock = ?, reorder_level = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          item.name ?? row.name,
          item.code !== undefined ? item.code : row.code,
          item.unit ?? row.unit,
          item.current_stock ?? row.current_stock,
          item.reorder_level !== undefined
            ? item.reorder_level
            : row.reorder_level,
          id
        );
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

  ipcMain.handle("items:addStock", (_, id: number, quantity: number) => {
    if (quantity <= 0) throw new Error("Quantity must be positive.");
    db()
      .prepare(
        "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(quantity, id);
    return id;
  });

  ipcMain.handle("items:reduceStock", (_, id: number, quantity: number) => {
    if (quantity <= 0) throw new Error("Quantity must be positive.");
    const row = db()
      .prepare("SELECT current_stock FROM items WHERE id = ?")
      .get(id) as { current_stock: number } | undefined;
    if (!row) throw new Error("Item not found");
    if (row.current_stock < quantity) throw new Error("Insufficient stock.");
    db()
      .prepare(
        "UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(quantity, id);
    return id;
  });

  // ---- Units ----
  ipcMain.handle("units:getAll", () => {
    return db().prepare("SELECT * FROM units ORDER BY name").all();
  });

  ipcMain.handle("units:create", (_, name: string) => {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) throw new Error("Unit name is required.");
    db()
      .prepare("INSERT OR IGNORE INTO units (name) VALUES (?)")
      .run(trimmed);
    return trimmed;
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
      const quantity = l.quantity ?? 0;
      const result = db()
        .prepare(
          "INSERT INTO transactions (type, mahajan_id, product_id, quantity, amount, transaction_date, notes) VALUES ('lend', ?, ?, ?, ?, ?, ?)"
        )
        .run(
          l.mahajan_id,
          l.product_id ?? null,
          quantity,
          l.amount,
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
          if (line.quantity <= 0) throw new Error("Quantity must be positive.");
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
              line.quantity,
              line.amount,
              payload.transaction_date,
              payload.notes ?? null
            );
          ids.push(Number(result.lastInsertRowid));
          db()
            .prepare(
              "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(line.quantity, line.product_id);
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
      const newQuantity = l.quantity !== undefined ? l.quantity : oldQuantity;

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
            l.amount ?? row.amount,
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
        .run(d.mahajan_id, d.amount, d.transaction_date, d.notes ?? null);
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
          d.amount ?? row.amount,
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
        sale_amount: number;
        cash_in_hand: number;
        expenditure_amount?: number;
        notes?: string;
      }
    ) => {
      const result = db()
        .prepare(
          "INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, expenditure_amount, notes) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          s.sale_date,
          s.sale_amount,
          s.cash_in_hand,
          s.expenditure_amount ?? null,
          s.notes ?? null
        );
      return result.lastInsertRowid;
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
        cash_in_hand?: number;
        expenditure_amount?: number;
        notes?: string;
      }
    ) => {
      const row = db()
        .prepare("SELECT * FROM daily_sales WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) throw new Error("Sale not found");
      db()
        .prepare(
          "UPDATE daily_sales SET sale_date = ?, sale_amount = ?, cash_in_hand = ?, expenditure_amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          s.sale_date ?? row.sale_date,
          s.sale_amount ?? row.sale_amount,
          s.cash_in_hand ?? row.cash_in_hand,
          s.expenditure_amount !== undefined
            ? s.expenditure_amount
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
      if (p.quantity == null || p.quantity < 0)
        throw new Error("Quantity is required and must be non-negative.");
      const result = db()
        .prepare(
          "INSERT INTO transactions (type, product_id, quantity, amount, transaction_date, notes) VALUES ('cash_purchase', ?, ?, ?, ?, ?)"
        )
        .run(
          p.product_id,
          p.quantity,
          p.amount,
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
          if (line.quantity == null || line.quantity < 0)
            throw new Error("Quantity is required and must be non-negative.");
          if (line.amount < 0) throw new Error("Amount must be non-negative.");
          const result = db()
            .prepare(
              "INSERT INTO transactions (type, product_id, quantity, amount, transaction_date, notes) VALUES ('cash_purchase', ?, ?, ?, ?, ?)"
            )
            .run(
              line.product_id,
              line.quantity,
              line.amount,
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
        p.quantity !== undefined ? p.quantity : (row.quantity as number);
      if (quantity == null || quantity < 0)
        throw new Error("Quantity is required and must be non-negative.");
      db()
        .prepare(
          "UPDATE transactions SET transaction_date = ?, quantity = ?, amount = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .run(
          p.transaction_date ?? row.transaction_date,
          quantity,
          p.amount ?? row.amount,
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
      db()
        .prepare(
          "INSERT INTO opening_balance (year, amount, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(year) DO UPDATE SET amount = ?, updated_at = datetime('now')"
        )
        .run(year, amount, amount);
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
}
