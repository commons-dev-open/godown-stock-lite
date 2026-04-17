/** Default page size for paginated lists. Used by both main (handlers) and renderer. */
export const PAGE_SIZE = 30;

/**
 * Max rows for Daily Sales browser print + PDF (Electron printToPDF). Each row is one day.
 * Above ~1k rows Chromium can spike memory and block the UI; CSV has no such cap.
 */
export const DAILY_SALES_PRINT_MAX_ROWS = 800;

/** Decimal places for all numeric fields (amounts, quantities, stock) across app, db and export. */
export const DECIMAL_PLACES = 2;
