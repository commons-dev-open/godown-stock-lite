import { DECIMAL_PLACES } from "./constants";

/**
 * Format a number to a fixed number of decimal places for display/export.
 * Uses DECIMAL_PLACES from constants (default 2).
 */
export function formatDecimal(value: number, places?: number): string {
  const p = places ?? DECIMAL_PLACES;
  return Number(value).toFixed(p);
}

/**
 * Round a number to a fixed number of decimal places for storage.
 * Uses DECIMAL_PLACES from constants (default 2).
 */
export function roundDecimal(value: number, places?: number): number {
  const p = places ?? DECIMAL_PLACES;
  const factor = 10 ** p;
  return Math.round(Number(value) * factor) / factor;
}
