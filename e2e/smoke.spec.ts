/**
 * Electron smoke test: loads the built app (not Vite dev server).
 * HashRouter: URLs use `#/` paths after the loaded file URL.
 * Assertions use `data-testid` from `src/shared/test-ids.ts` — not `document.title` or i18n strings.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import { GATE, LAYOUT } from "../src/shared/test-ids";
import { e2eTimeouts } from "./timeouts";

function resolveElectronExecutable(root: string): string {
  const pathTxt = path.join(root, "node_modules/electron/path.txt");
  const name = fs.readFileSync(pathTxt, "utf-8").trim();
  return path.join(root, "node_modules/electron/dist", name);
}

/** Playwright is started with cwd = repo root. */
const REPO_ROOT = process.cwd();

test.beforeAll(() => {
  execSync("npm run build", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
});

test("Electron window shows an auth gate or main layout", async () => {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  delete env.ELECTRON_DEV;
  // Cursor/some shells set ELECTRON_RUN_AS_NODE=1; that breaks the real Electron API in main.
  delete env.ELECTRON_RUN_AS_NODE;

  const electronApp = await electron.launch({
    cwd: REPO_ROOT,
    args: ["."],
    env,
    executablePath: resolveElectronExecutable(REPO_ROOT),
  });

  try {
    const page = await electronApp.firstWindow();
    const selector = [
      GATE.loading,
      GATE.onboarding,
      GATE.userSelect,
      GATE.pinEntry,
      GATE.forcePinChange,
      GATE.appUnlocked,
      LAYOUT.root,
    ]
      .map((id) => `[data-testid="${id}"]`)
      .join(", ");

    // Prefer attached over visible: some full-screen gates can be "hidden" to strict
    // visibility checks while the window is still initializing.
    await expect(page.locator(selector).first()).toBeAttached({
      timeout: e2eTimeouts.gateAttach,
    });
  } finally {
    await electronApp.close();
  }
});
