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

export function settingsTabLabel(id: SettingsTabId): string {
  switch (id) {
    case "business":
      return "Business";
    case "tax":
      return "Tax & GST";
    case "discounts":
      return "Discounts";
    case "appearance":
      return "Appearance";
    case "security":
      return "Security";
    case "activity":
      return "Activity log";
    case "data":
      return "Data";
    default:
      return id;
  }
}
