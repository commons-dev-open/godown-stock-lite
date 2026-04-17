import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuild } from '@electron/rebuild';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'rebuild' ? 'rebuild' : 'ensure';

function getElectronVersion() {
  const p = join(root, 'node_modules', 'electron', 'package.json');
  if (!existsSync(p)) {
    return null;
  }
  return JSON.parse(readFileSync(p, 'utf8')).version;
}

function getElectronCliPath() {
  return join(dirname(require.resolve('electron/package.json', { paths: [root] })), 'cli.js');
}

function canElectronLoadBetterSqlite3() {
  const electronVersion = getElectronVersion();
  if (!electronVersion) {
    return true;
  }
  const electronCli = getElectronCliPath();
  const r = spawnSync(
    process.execPath,
    [electronCli, '-e', "require('better-sqlite3')"],
    {
      cwd: root,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ATTACH_CONSOLE: '1',
      },
      stdio: 'ignore',
    },
  );
  return r.status === 0;
}

async function runRebuild() {
  const electronVersion = getElectronVersion();
  if (!electronVersion) {
    console.warn('native-better-sqlite3-for-electron: electron is not installed; skipping rebuild.');
    return;
  }
  await rebuild({
    buildPath: root,
    electronVersion,
    force: true,
    onlyModules: ['better-sqlite3'],
  });
}

async function main() {
  if (mode === 'rebuild') {
    await runRebuild();
    return;
  }
  if (!canElectronLoadBetterSqlite3()) {
    const v = getElectronVersion();
    console.log(
      'better-sqlite3 is not built for this Electron runtime; rebuilding for Electron',
      v ?? '(unknown)',
      '…',
    );
    await runRebuild();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
