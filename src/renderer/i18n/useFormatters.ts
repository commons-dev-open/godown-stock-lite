import { useMemo } from "react";
import { useLocale } from "./LocaleContext";
import { applyNumerals } from "./digits";
import { DECIMAL_PLACES } from "shared/constants";
import {
  formatAbbreviatedInteger as sharedFormatAbbreviatedInteger,
  formatAbbreviatedRupee as sharedFormatAbbreviatedRupee,
  type NumberAbbreviationStyle,
} from "shared/numbers";

export type LocaleFormatters = {
  /** Integer with Indian (or locale) grouping. */
  formatInteger: (value: number) => string;
  /** Fixed-decimal number with locale grouping + numerals. */
  formatDecimal: (value: number, places?: number) => string;
  /** ₹ + formatted value. */
  formatRupee: (value: number, places?: number) => string;
  /** Abbreviated rupee (₹12.34 Lac / ₹१२.३४ लाख). */
  formatAbbreviatedRupee: (
    value: number,
    style: NumberAbbreviationStyle,
  ) => string;
  /** Abbreviated integer (no currency). */
  formatAbbreviatedInteger: (
    value: number,
    style: NumberAbbreviationStyle,
  ) => string;
  /** "Today" / "Yesterday" / "Jan 15, 2026" (localized). */
  formatDateForView: (iso: string) => string;
  /** "15/04/2026" stays Latin for editability. */
  formatDateForForm: (iso: string) => string;
};

export function useFormatters(): LocaleFormatters {
  const { intlLocale, numeralSystem, locale } = useLocale();

  return useMemo(() => {
    const numberOpts = { numberingSystem: numeralSystem } as Intl.NumberFormatOptions;

    const intFormatter = new Intl.NumberFormat(intlLocale, {
      maximumFractionDigits: 0,
      ...numberOpts,
    });
    const makeDecimalFormatter = (places: number) =>
      new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: places,
        maximumFractionDigits: places,
        ...numberOpts,
      });

    const todayLabelMap: Record<typeof locale, string> = {
      en: "Today",
      hi: "आज",
      bn: "আজ",
    };
    const yesterdayLabelMap: Record<typeof locale, string> = {
      en: "Yesterday",
      hi: "कल",
      bn: "গতকাল",
    };
    const todayLabel = todayLabelMap[locale];
    const yesterdayLabel = yesterdayLabelMap[locale];

    const viewDateFormatter = new Intl.DateTimeFormat(intlLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      numberingSystem: numeralSystem,
    });

    const formatInteger = (value: number) => intFormatter.format(value);

    const formatDecimal = (value: number, places?: number) => {
      const p = places ?? DECIMAL_PLACES;
      return makeDecimalFormatter(p).format(value);
    };

    const formatRupee = (value: number, places?: number) =>
      `₹${formatDecimal(value, places)}`;

    const formatAbbreviatedRupee = (
      value: number,
      style: NumberAbbreviationStyle,
    ) => applyNumerals(sharedFormatAbbreviatedRupee(value, style), numeralSystem);

    const formatAbbreviatedInteger = (
      value: number,
      style: NumberAbbreviationStyle,
    ) =>
      applyNumerals(sharedFormatAbbreviatedInteger(value, style), numeralSystem);

    const formatDateForView = (iso: string) => {
      if (!iso) return "";
      const date = new Date(iso + "T12:00:00");
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
      if (sameDay(date, today)) return todayLabel;
      if (sameDay(date, yesterday)) return yesterdayLabel;
      return viewDateFormatter.format(date);
    };

    const formatDateForForm = (iso: string) => {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      return [d, m, y].join("/");
    };

    return {
      formatInteger,
      formatDecimal,
      formatRupee,
      formatAbbreviatedRupee,
      formatAbbreviatedInteger,
      formatDateForView,
      formatDateForForm,
    };
  }, [intlLocale, numeralSystem, locale]);
}
