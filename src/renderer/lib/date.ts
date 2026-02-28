/** Format YYYY-MM-DD to dd/mm/yyyy */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return [d, m, y].join("/");
}

/** Get today in YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
