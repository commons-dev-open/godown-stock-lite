/**
 * Compare dotted numeric release strings (e.g. 0.0.3 vs 0.0.10).
 * Returns negative if a < b, zero if equal, positive if a > b.
 */
export function compareReleaseVersions(a: string, b: string): number {
  const pa = parseDottedVersion(a);
  const pb = parseDottedVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) {
      return -1;
    }
    if (na > nb) {
      return 1;
    }
  }
  return 0;
}

function parseDottedVersion(v: string): number[] {
  const trimmed = v.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed.split(".").map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : NaN;
  });
}

/** True if string is one or more dot-separated non-negative integers (e.g. 1, 0.0.4). */
export function isDottedNumericVersion(v: string): boolean {
  const trimmed = v.trim();
  if (!trimmed) {
    return false;
  }
  return /^\d+(\.\d+)*$/.test(trimmed);
}
