export type HelpTabId =
  | "overview"
  | "getting-started"
  | "units"
  | "products"
  | "lenders"
  | "transactions"
  | "daily-sales"
  | "invoices"
  | "team"
  | "reports"
  | "settings-data";

export const HELP_TAB_ORDER: HelpTabId[] = [
  "overview",
  "getting-started",
  "units",
  "products",
  "lenders",
  "transactions",
  "daily-sales",
  "invoices",
  "team",
  "reports",
  "settings-data",
];

/** Maps tab id to `help.json` keys under `tabLabels` / `panelMeta`. */
export function helpPanelMetaKey(id: HelpTabId): string {
  switch (id) {
    case "getting-started":
      return "gettingStarted";
    case "daily-sales":
      return "dailySales";
    case "settings-data":
      return "settingsData";
    default:
      return id;
  }
}
