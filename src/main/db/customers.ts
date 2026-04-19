import type Database from "better-sqlite3";

/**
 * Upsert customer by phone. If customer with phone exists, update name/address.
 * Otherwise, insert new customer. Returns customer id.
 */
export function upsertCustomer(
  database: Database.Database,
  phone: string,
  name: string | null,
  address: string | null,
  gstin: string | null = null
): number {
  const trimmedPhone = phone.trim();
  const existing = database
    .prepare("SELECT id FROM customers WHERE phone = ?")
    .get(trimmedPhone) as { id: number } | undefined;
  if (existing) {
    database
      .prepare(
        "UPDATE customers SET name = ?, address = ?, gstin = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(name, address, gstin, existing.id);
    return existing.id;
  }
  const r = database
    .prepare(
      "INSERT INTO customers (phone, name, address, gstin) VALUES (?, ?, ?, ?)"
    )
    .run(trimmedPhone, name, address, gstin);
  return r.lastInsertRowid as number;
}
