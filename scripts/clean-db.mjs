#!/usr/bin/env node
/**
 * Deletes the Godown SQLite DB so the app will recreate and seed it on next launch.
 * Uses the same userData path as Electron (package name "godown-stock-lite").
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function getDbPath() {
  const appName = "godown-stock-lite";
  if (process.platform === "darwin") {
    return path.join(process.env.HOME, "Library", "Application Support", appName, "godown.db");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", appName, "godown.db");
  }
  return path.join(process.env.HOME || "", ".config", appName, "godown.db");
}

const dbPath = getDbPath();
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log("Deleted:", dbPath);
} else {
  console.log("No DB found at:", dbPath);
}
