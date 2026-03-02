#!/usr/bin/env node
/**
 * Writes src/shared/buildConfig.ts with TRIAL_MODE and TRIAL_END_ISO from env.
 * Trial build: TRIAL_MODE=true npm run build
 * With end date: TRIAL_MODE=true TRIAL_END=2025-04-15T23:59:59 npm run build
 * Default (no TRIAL_END): 3 days from now, end of day (23:59:59).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "..", "src", "shared", "buildConfig.ts");
const trial = process.env.TRIAL_MODE === "true";

let trialEndIso = '""';
if (trial) {
  if (process.env.TRIAL_END) {
    trialEndIso = JSON.stringify(process.env.TRIAL_END);
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 59, 999);
    trialEndIso = JSON.stringify(d.toISOString());
  }
}

const content = `/**
 * Build-time trial config. Overwritten by scripts/write-build-config.mjs.
 * Full: npm run build
 * Trial: TRIAL_MODE=true npm run build
 * Trial with end: TRIAL_MODE=true TRIAL_END=2025-04-15T23:59:59 npm run build
 * Default trial: 3 days from build, end of day.
 */
export const TRIAL_MODE = ${trial};
/** ISO date-time string when trial ends (e.g. "2025-04-15T23:59:59.000Z"). Empty when not trial. */
export const TRIAL_END_ISO = ${trialEndIso};
`;

fs.writeFileSync(outPath, content, "utf8");
console.log(`buildConfig: TRIAL_MODE = ${trial}, TRIAL_END_ISO = ${trialEndIso}`);
console.log(`Wrote ${outPath}`);