import type Database from "better-sqlite3";
import { seedBulk } from "./seedBulk";

export function seedIfEmpty(db: Database.Database): void {
  const itemCount = (
    db.prepare("SELECT COUNT(*) AS c FROM items").get() as { c: number }
  ).c;
  if (itemCount === 0) {
    seedBulk(db);
  }
}
