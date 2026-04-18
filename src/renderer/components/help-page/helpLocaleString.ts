import type { i18n as I18n } from "i18next";

/** Typed `help` namespace struggles with dynamic keys; keep runtime strings correct. */
export function helpLocaleString(i18n: I18n, key: string): string {
  return String(i18n.getFixedT(i18n.language, "help")(key as never));
}
