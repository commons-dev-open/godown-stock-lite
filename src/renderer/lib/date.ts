/** Format YYYY-MM-DD for display in views: "Today", "Yesterday", or "Jan 1, 2026" */
export function formatDateForView(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format YYYY-MM-DD to dd/mm/yyyy for form display */
export function formatDateForForm(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return [d, m, y].join("/");
}

/**
 * Parse dd/mm/yyyy or d/m/yyyy to YYYY-MM-DD.
 * Returns empty string if invalid.
 */
export function parseFormDate(input: string): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  const parts = trimmed.split(/[/-]/).map((p) => p.trim());
  if (parts.length !== 3) return "";
  const [d, m, y] = parts.map((p) => Number.parseInt(p, 10));
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return "";
  if (y < 100) return ""; // expect 4-digit year
  const month = m < 10 ? `0${m}` : `${m}`;
  const day = d < 10 ? `0${d}` : `${d}`;
  const year = `${y}`;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso + "T12:00:00");
  if (Number.isNaN(date.getTime())) return "";
  if (date.getUTCDate() !== d || date.getUTCMonth() + 1 !== m) return "";
  return iso;
}

/** Format YYYY-MM-DD to dd/mm/yyyy (alias for form display, kept for compatibility) */
export function formatDate(iso: string): string {
  return formatDateForForm(iso);
}

/** Get today in YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
