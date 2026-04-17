/**
 * Build-time trial config. Overwritten by scripts/write-build-config.mjs.
 * Full: npm run build
 * Trial: TRIAL_MODE=true npm run build
 * Trial with end: TRIAL_MODE=true TRIAL_END=2025-04-15T23:59:59 npm run build
 * Default trial: 3 days from build, end of day.
 */
export const TRIAL_MODE = false;
/** ISO date-time string when trial ends (e.g. "2025-04-15T23:59:59.000Z"). Empty when not trial. */
export const TRIAL_END_ISO = "";
/**
 * PBKDF2 pin hash for optional developer master key recovery.
 * Set at build: MASTER_KEY_DEV_HASH='<salt:hash>' npm run build. DEV_HASH_NOT_SET disables.
 */
export const MASTER_KEY_DEV_HASH = "DEV_HASH_NOT_SET";
