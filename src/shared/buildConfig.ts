/**
 * Build-time trial config. Overwritten by scripts/write-build-config.mjs.
 * Full: npm run build
 * Trial: TRIAL_MODE=true npm run build
 * Trial with end: TRIAL_MODE=true TRIAL_END=2025-04-15T23:59:59 npm run build
 * Default trial: 3 days from build, end of day.
 */
export const TRIAL_MODE = true;
/** ISO date-time string when trial ends (e.g. "2025-04-15T23:59:59.000Z"). Empty when not trial. */
export const TRIAL_END_ISO = "2026-03-05T11:59:59";
