import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Eagerly-imported namespaces (small app, small JSON; no network loader needed)
import enCommon from "./locales/en/common.json";
import enNavigation from "./locales/en/navigation.json";
import enHome from "./locales/en/home.json";
import enItems from "./locales/en/items.json";
import enMahajans from "./locales/en/mahajans.json";
import enTransactions from "./locales/en/transactions.json";
import enSales from "./locales/en/sales.json";
import enInvoices from "./locales/en/invoices.json";
import enSettings from "./locales/en/settings.json";
import enUsers from "./locales/en/users.json";
import enUnits from "./locales/en/units.json";
import enHelp from "./locales/en/help.json";
import enOnboarding from "./locales/en/onboarding.json";
import enTrial from "./locales/en/trial.json";

import hiCommon from "./locales/hi/common.json";
import hiNavigation from "./locales/hi/navigation.json";
import hiHome from "./locales/hi/home.json";
import hiItems from "./locales/hi/items.json";
import hiMahajans from "./locales/hi/mahajans.json";
import hiTransactions from "./locales/hi/transactions.json";
import hiSales from "./locales/hi/sales.json";
import hiInvoices from "./locales/hi/invoices.json";
import hiSettings from "./locales/hi/settings.json";
import hiUsers from "./locales/hi/users.json";
import hiUnits from "./locales/hi/units.json";
import hiHelp from "./locales/hi/help.json";
import hiOnboarding from "./locales/hi/onboarding.json";
import hiTrial from "./locales/hi/trial.json";

import bnCommon from "./locales/bn/common.json";
import bnNavigation from "./locales/bn/navigation.json";
import bnHome from "./locales/bn/home.json";
import bnItems from "./locales/bn/items.json";
import bnMahajans from "./locales/bn/mahajans.json";
import bnTransactions from "./locales/bn/transactions.json";
import bnSales from "./locales/bn/sales.json";
import bnInvoices from "./locales/bn/invoices.json";
import bnSettings from "./locales/bn/settings.json";
import bnUsers from "./locales/bn/users.json";
import bnUnits from "./locales/bn/units.json";
import bnHelp from "./locales/bn/help.json";
import bnOnboarding from "./locales/bn/onboarding.json";
import bnTrial from "./locales/bn/trial.json";

export const LOCALE_STORAGE_KEY = "locale";
/** Persisted choice for invoice browser print / PDF copy (does not change app UI language). */
export const INVOICE_PRINT_LOCALE_STORAGE_KEY = "invoicePrintLocale";
export type SupportedLocale = "en" | "hi" | "bn";
export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "hi", "bn"];
export const DEFAULT_LOCALE: SupportedLocale = "en";

export const NAMESPACES = [
  "common",
  "navigation",
  "home",
  "items",
  "mahajans",
  "transactions",
  "sales",
  "invoices",
  "settings",
  "users",
  "units",
  "help",
  "onboarding",
  "trial",
] as const;

function readStoredLocale(): SupportedLocale {
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "hi" || v === "bn") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

/** Invoice print/PDF language; falls back to app UI locale when unset or invalid. */
export function readStoredInvoicePrintLocale(): SupportedLocale {
  try {
    const v = window.localStorage.getItem(INVOICE_PRINT_LOCALE_STORAGE_KEY);
    if (v === "en" || v === "hi" || v === "bn") return v;
  } catch {
    /* ignore */
  }
  return readStoredLocale();
}

const initialLocale = readStoredLocale();

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: "common",
  ns: NAMESPACES as unknown as string[],
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
  resources: {
    en: {
      common: enCommon,
      navigation: enNavigation,
      home: enHome,
      items: enItems,
      mahajans: enMahajans,
      transactions: enTransactions,
      sales: enSales,
      invoices: enInvoices,
      settings: enSettings,
      users: enUsers,
      units: enUnits,
      help: enHelp,
      onboarding: enOnboarding,
      trial: enTrial,
    },
    hi: {
      common: hiCommon,
      navigation: hiNavigation,
      home: hiHome,
      items: hiItems,
      mahajans: hiMahajans,
      transactions: hiTransactions,
      sales: hiSales,
      invoices: hiInvoices,
      settings: hiSettings,
      users: hiUsers,
      units: hiUnits,
      help: hiHelp,
      onboarding: hiOnboarding,
      trial: hiTrial,
    },
    bn: {
      common: bnCommon,
      navigation: bnNavigation,
      home: bnHome,
      items: bnItems,
      mahajans: bnMahajans,
      transactions: bnTransactions,
      sales: bnSales,
      invoices: bnInvoices,
      settings: bnSettings,
      users: bnUsers,
      units: bnUnits,
      help: bnHelp,
      onboarding: bnOnboarding,
      trial: bnTrial,
    },
  },
});

// Set document <html lang> for accessibility
if (typeof document !== "undefined") {
  document.documentElement.lang = initialLocale;
}

export default i18n;
