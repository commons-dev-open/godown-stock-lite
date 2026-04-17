export type HelpTabId =
  | "overview"
  | "getting-started"
  | "units"
  | "products"
  | "lenders"
  | "transactions"
  | "daily-sales"
  | "invoices"
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
    case "reports":
      return "Reports";
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
      "Recommended setup order and how trial mode works if you see a trial badge.",
  },
  units: {
    title: "Units",
    description:
      "Stock units for products and invoice units for billing line items.",
  },
  products: {
    title: "Products & stock",
    description:
      "Add products, adjust stock, search, export, and manage reorder levels.",
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
      "Line items, units, totals, PDFs, and how invoices feed daily sales.",
  },
  reports: {
    title: "Reports",
    description:
      "Executive summary, weekly and range totals, lender summary, low stock, and P&L.",
  },
  "settings-data": {
    title: "Settings & data",
    description:
      "Company details, appearance, danger zone actions, and database location.",
  },
};
