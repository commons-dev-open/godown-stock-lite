export interface AppliedFilter {
  label: string;
  value: string;
}

/** Builds CSV prefix rows for "Applied filters" section (excludes empty values). */
export function csvPrefixRowsForFilters(filters: AppliedFilter[]): string[][] {
  const nonEmpty = filters.filter((f) => f.value !== "" && f.value != null);
  if (nonEmpty.length === 0) return [];
  const rows: string[][] = [["Applied filters"]];
  nonEmpty.forEach((f) => rows.push([f.label, f.value]));
  rows.push([]);
  return rows;
}

/** Sanitizes a string for use in file names (e.g. mahajan/item names). */
export function sanitizeForFilename(s: string): string {
  return (
    s
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, "")
      .replaceAll(/\s+/g, "-")
      .replaceAll(/-+/g, "-")
      .replaceAll(/(^-+)|(-+$)/g, "")
      .trim() || "export"
  );
}

export function formatDateForFile(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}_${h}-${min}-${s}`;
}

/** Date and time for display on bills (DD-MM-YYYY, 12-hour AM/PM). */
export function formatBillDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const min = String(minutes).padStart(2, "0");
  return `${day}-${m}-${y} ${h12}:${min} ${ampm}`;
}

export function csvEscape(s: string): string {
  const v = String(s);
  if (!/[",\n\r]/.test(v)) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  header: string[],
  rows: string[][],
  filename: string,
  prefixRows?: string[][]
): void {
  const escape = (v: string) => csvEscape(v);
  const lines: string[] = [];
  if (prefixRows?.length) {
    prefixRows.forEach((row) => lines.push(row.map(escape).join(",")));
  }
  const headerRow = header.map(escape).join(",");
  const dataRows = rows.map((row) => row.map(escape).join(","));
  lines.push(headerRow, ...dataRows);
  const csv = lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
