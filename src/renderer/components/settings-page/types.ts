export type SettingsTabId =
  | "business"
  | "tax"
  | "discounts"
  | "appearance"
  | "security"
  | "activity"
  | "data";

export const SETTINGS_TAB_ORDER: SettingsTabId[] = [
  "business",
  "tax",
  "discounts",
  "appearance",
  "security",
  "activity",
  "data",
];

import i18n from "../../i18n";

export function settingsTabLabel(id: SettingsTabId): string {
  return i18n.t(`settings:tabs.${id}`);
}
