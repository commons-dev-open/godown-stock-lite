export const DEFAULT_APP_NAME = "Godown Stock Lite";
export const MAX_DISPLAY_NAME_LEN = 25;

/**
 * Resolve app display name from settings. Uses displayName if set (trimmed, max 25 chars), else default.
 */
export function getAppDisplayName(
  settings: Record<string, string> | undefined
): string {
  const raw = settings?.displayName?.trim();
  if (!raw) return DEFAULT_APP_NAME;
  const name = raw.slice(0, MAX_DISPLAY_NAME_LEN);
  return name || DEFAULT_APP_NAME;
}
