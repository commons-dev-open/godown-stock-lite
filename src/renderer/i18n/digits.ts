/**
 * Numeral system helpers for i18n.
 * Devanagari digits are used when Hindi locale is active.
 */

export type NumeralSystem = "latn" | "deva";

const DEVA_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;

/** Convert ASCII digits in a string to Devanagari digits (०१२…). */
export function toDevanagariDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => DEVA_DIGITS[Number(d)]);
}

/** Convert Devanagari digits back to ASCII digits. Useful before parsing user input. */
export function toLatinDigits(input: string): string {
  return input.replace(/[\u0966-\u096F]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x0966),
  );
}

/** Apply numeral system to an already-formatted string. */
export function applyNumerals(s: string, system: NumeralSystem): string {
  return system === "deva" ? toDevanagariDigits(s) : s;
}
