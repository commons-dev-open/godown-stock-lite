import "i18next";

import common from "./locales/en/common.json";
import navigation from "./locales/en/navigation.json";
import home from "./locales/en/home.json";
import items from "./locales/en/items.json";
import mahajans from "./locales/en/mahajans.json";
import transactions from "./locales/en/transactions.json";
import sales from "./locales/en/sales.json";
import invoices from "./locales/en/invoices.json";
import settings from "./locales/en/settings.json";
import users from "./locales/en/users.json";
import units from "./locales/en/units.json";
import help from "./locales/en/help.json";
import onboarding from "./locales/en/onboarding.json";
import trial from "./locales/en/trial.json";
import purchases from "./locales/en/purchases.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      navigation: typeof navigation;
      home: typeof home;
      items: typeof items;
      mahajans: typeof mahajans;
      transactions: typeof transactions;
      sales: typeof sales;
      invoices: typeof invoices;
      settings: typeof settings;
      users: typeof users;
      units: typeof units;
      help: typeof help;
      onboarding: typeof onboarding;
      trial: typeof trial;
      purchases: typeof purchases;
    };
  }
}
