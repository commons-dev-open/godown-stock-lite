import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { _electron as electron, type ElectronApplication } from "playwright";

export function resolveElectronExecutable(root: string): string {
  const pathTxt = path.join(root, "node_modules/electron/path.txt");
  const name = fs.readFileSync(pathTxt, "utf-8").trim();
  return path.join(root, "node_modules/electron/dist", name);
}

export function electronTestEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  delete env.ELECTRON_DEV;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/**
 * Isolated Chromium user data directory → fresh SQLite under Electron `userData`.
 */
export function newIsolatedUserDataDir(): string {
  return path.join(os.tmpdir(), "godown-stock-lite-e2e", crypto.randomUUID());
}

export function removeUserDataDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function launchElectronWithUserData(
  cwd: string,
  userDataDir: string
): Promise<ElectronApplication> {
  removeUserDataDir(userDataDir);
  return electron.launch({
    cwd,
    args: [".", `--user-data-dir=${userDataDir}`],
    env: electronTestEnv(),
    executablePath: resolveElectronExecutable(cwd),
  });
}

export async function closeAppAndRemoveUserData(
  app: ElectronApplication,
  userDataDir: string
): Promise<void> {
  try {
    await app.close();
  } finally {
    removeUserDataDir(userDataDir);
  }
}
