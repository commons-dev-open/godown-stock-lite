/** Stored in settings (string: sunday | monday). */
export const WEEK_STARTS_ON_KEY = "week_starts_on";

export type WeekStartsOn = "sunday" | "monday";

export function parseWeekStartsOn(
  raw: string | undefined | null
): WeekStartsOn {
  if (raw === "sunday") {
    return "sunday";
  }
  return "monday";
}

/** Lexicographic min for YYYY-MM-DD. */
export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Calendar week containing `anchorIso` (local date), [weekStartIso, weekEndIso] inclusive (7 days).
 */
export function getCalendarWeekRange(
  anchorIso: string,
  weekStartsOn: WeekStartsOn
): { weekStartIso: string; weekEndIso: string } {
  const parts = anchorIso.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  let daysSinceWeekStart: number;
  if (weekStartsOn === "sunday") {
    daysSinceWeekStart = dow;
  } else {
    daysSinceWeekStart = dow === 0 ? 6 : dow - 1;
  }
  date.setDate(date.getDate() - daysSinceWeekStart);
  const weekStartIso = formatDateToIsoLocal(date);
  date.setDate(date.getDate() + 6);
  const weekEndIso = formatDateToIsoLocal(date);
  return { weekStartIso, weekEndIso };
}

function formatDateToIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
