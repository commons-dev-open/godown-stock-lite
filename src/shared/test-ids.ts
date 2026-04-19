/**
 * Stable DOM ids for E2E (Playwright) and accessibility tooling.
 * Do not derive from translated copy, document.title, or dynamic display names.
 */

export const GATE = {
  loading: "gate-loading",
  onboarding: "gate-onboarding",
  userSelect: "gate-user-select",
  pinEntry: "gate-pin-entry",
  forcePinChange: "gate-force-pin-change",
  appUnlocked: "gate-app-unlocked",
} as const;

export const LAYOUT = {
  root: "layout-root",
  sidebar: "layout-sidebar",
  main: "layout-main",
  sidebarToggle: "layout-sidebar-toggle",
  lock: "layout-lock",
  /** Sidebar header: business display name (expanded sidebar only). */
  sidebarBusinessTitle: "layout-sidebar-business-title",
  /** Logged-in user display name in the sidebar footer. */
  sidebarUserName: "layout-sidebar-user-name",
  /** Role label under the user name (e.g. Owner). */
  sidebarUserRole: "layout-sidebar-user-role",
} as const;

/** Settings segmented tabs: `settings-tab--${id}` (e.g. `appearance`, `business`). */
export function settingsTab(id: string): string {
  return `settings-tab--${id}`;
}

export const SETTINGS = {
  businessCompanyName: "settings-business-company-name",
  businessOwnerName: "settings-business-owner-name",
  appearanceDisplayName: "settings-appearance-display-name",
} as const;

/** Team / users directory table row prefix (`users-roster-row-<id>`). */
export const USERS_ROSTER = "users-roster" as const;

/** Nav link `data-testid` from React Router `to` (see Layout sidebar). */
export function navLinkTestId(to: string): string {
  const slug =
    to === "/" ? "home" : to.replace(/^\//, "").replace(/\//g, "--");
  return `nav-link--${slug}`;
}

export const PAGE = {
  home: "page-home",
  stock: "page-stock",
  stockHistory: "page-stock-history",
  mahajans: "page-mahajans",
  mahajanLedger: "page-mahajan-ledger",
  transactions: "page-transactions",
  purchases: "page-purchases",
  sales: "page-sales",
  invoices: "page-invoices",
  units: "page-units",
  users: "page-users",
  settings: "page-settings",
  help: "page-help",
  masterKeyRecovery: "page-master-key-recovery",
} as const;

export function dataTableRow(testIdPrefix: string, rowKey: string | number): string {
  return `${testIdPrefix}-row-${rowKey}`;
}

export function dataTableRowEdit(testIdPrefix: string, rowKey: string | number): string {
  return `${testIdPrefix}-row-${rowKey}-edit`;
}

export function dataTableRowDelete(testIdPrefix: string, rowKey: string | number): string {
  return `${testIdPrefix}-row-${rowKey}-delete`;
}

export function pinPadDigit(testIdPrefix: string, digit: string): string {
  return `${testIdPrefix}-digit-${digit}`;
}

export function pinPadBackspace(testIdPrefix: string): string {
  return `${testIdPrefix}-backspace`;
}

/** Cash purchase flow (shared component); use per-page ids from callers. */
export const modalTransactionsCashPurchase = {
  entry: "modal-transactions-cash-purchase-entry",
  confirm: "modal-transactions-cash-purchase-confirm",
} as const;

export const modalPurchasesCashPurchase = {
  entry: "modal-purchases-cash-purchase-entry",
  confirm: "modal-purchases-cash-purchase-confirm",
} as const;

export const pinEntryPadPrefix = "pin-entry-pad" as const;

export const PIN_ENTRY = {
  error: "pin-entry-error",
} as const;

/** Compact `ThemeSwitcher` / `LanguageSwitcher` (auth gates and collapsed sidebar). */
export const COMPACT_SWITCHER = {
  theme: "compact-switcher-theme",
  language: "compact-switcher-language",
} as const;

export const ONBOARDING = {
  companyName: "onboarding-company-name",
  ownerName: "onboarding-owner-name",
  displaySameAsCompany: "onboarding-display-same-as-company",
  displayName: "onboarding-display-name",
  pin: "onboarding-pin",
  confirmPin: "onboarding-confirm-pin",
  recoveryKey: "onboarding-recovery-key",
  confirmRecoveryKey: "onboarding-confirm-recovery-key",
  error: "onboarding-error",
  submit: "onboarding-submit",
} as const;

export function userSelectUserButton(userId: number): string {
  return `user-select-user-${userId}`;
}

export const transactionsAction = {
  addCashPurchase: "transactions-add-cash-purchase",
} as const;
