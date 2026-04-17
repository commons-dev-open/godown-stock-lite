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

export function helpTabLabel(id: HelpTabId): string {
  switch (id) {
    case "overview":
      return "Overview";
    case "getting-started":
      return "Getting started";
    case "units":
      return "Units";
    case "products":
      return "Products & stock";
    case "lenders":
      return "Lenders";
    case "transactions":
      return "Transactions";
    case "daily-sales":
      return "Daily sales";
    case "invoices":
      return "Invoices";
    case "team":
      return "Team";
    case "reports":
      return "Home & insights";
    case "settings-data":
      return "Settings & data";
    default:
      return id;
  }
}

export const HELP_SECTION_META: Record<
  HelpTabId,
  { title: string; description: string }
> = {
  overview: {
    title: "Overview",
    description:
      "What this app does, where data lives, and how the main areas fit together.",
  },
  "getting-started": {
    title: "Getting started",
    description:
      "Sign-in, setup order (including tax and discounts), and trial behaviour.",
  },
  units: {
    title: "Units",
    description:
      "Stock units, unit types, standard conversions, and how invoices pick units.",
  },
  products: {
    title: "Products & stock",
    description:
      "Catalogue, stock moves, selling defaults, GST/HSN, conversions, export, print.",
  },
  lenders: {
    title: "Lenders",
    description:
      "Credit from lenders, settlements, balances, ledgers, and exports.",
  },
  transactions: {
    title: "Transactions",
    description:
      "Credit purchase, settlement, cash purchase, filters, and printing.",
  },
  "daily-sales": {
    title: "Daily sales",
    description:
      "Invoice sales, misc sales, cash in hand, expenditure, and one row per date.",
  },
  invoices: {
    title: "Invoices",
    description:
      "Line items, settings-driven GST and discounts, PDFs, and how totals feed daily sales.",
  },
  team: {
    title: "Team",
    description:
      "Team members, roles (Owner, Admin, User), PINs, activation, and how this differs from Settings.",
  },
  reports: {
    title: "Home & insights",
    description:
      "What appears on the Home dashboard: KPIs, charts, quick actions, weekly detail, lenders, and low stock.",
  },
  "settings-data": {
    title: "Settings & data",
    description:
      "Business, tax, discounts, appearance, security, activity log, backups, and database path.",
  },
};
