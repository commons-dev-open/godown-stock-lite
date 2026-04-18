/** Stored in settings under this key (string: indian | us | si). */
export const NUMBER_ABBREVIATION_STYLE_KEY = "number_abbreviation_style";

const LAC = 100_000;
const CRORE = 10_000_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

export type NumberAbbreviationStyle = "indian" | "us" | "si";

/** Suffix labels for Indian-style lac / crore abbreviations (i18n). */
export interface IndianAbbreviationUnitLabels {
  lac: string;
  crore: string;
}

const DEFAULT_INDIAN_ABBREV_UNITS: IndianAbbreviationUnitLabels = {
  lac: "Lac",
  crore: "Cr",
};

export function parseNumberAbbreviationStyle(
  raw: string | undefined | null
): NumberAbbreviationStyle {
  if (raw === "us" || raw === "si") {
    return raw;
  }
  return "indian";
}

function trimDecimalString(value: string): string {
  if (!value.includes(".")) {
    return value;
  }
  let result = value.replace(/(\.\d*?)0+$/, "$1");
  result = result.replace(/\.$/, "");
  return result;
}

function ratioString(absRatio: number, decimals: number): string {
  return trimDecimalString(absRatio.toFixed(decimals));
}

function formatIntegerFull(abs: number, locale: string): string {
  return Math.round(abs).toLocaleString(locale);
}

export function formatAbbreviatedInteger(
  value: number,
  style: NumberAbbreviationStyle,
  indianUnits: IndianAbbreviationUnitLabels = DEFAULT_INDIAN_ABBREV_UNITS
): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) {
    return "—";
  }
  if (style === "indian") {
    const { lac, crore } = indianUnits;
    if (abs < LAC) {
      return sign + formatIntegerFull(abs, "en-IN");
    }
    if (abs < CRORE) {
      return `${sign}${ratioString(abs / LAC, 2)} ${lac}`;
    }
    return `${sign}${ratioString(abs / CRORE, 2)} ${crore}`;
  }
  if (style === "us") {
    if (abs < MILLION) {
      return sign + formatIntegerFull(abs, "en-US");
    }
    if (abs < BILLION) {
      return sign + ratioString(abs / MILLION, 2) + "M";
    }
    return sign + ratioString(abs / BILLION, 2) + "B";
  }
  if (abs < 1000) {
    return sign + formatIntegerFull(abs, "en-US");
  }
  if (abs < MILLION) {
    return sign + ratioString(abs / 1000, 2) + "K";
  }
  if (abs < BILLION) {
    return sign + ratioString(abs / MILLION, 2) + "M";
  }
  return sign + ratioString(abs / BILLION, 2) + "B";
}

function formatMoneyFull(abs: number, locale: string): string {
  return abs.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAbbreviatedRupee(
  value: number,
  style: NumberAbbreviationStyle,
  indianUnits: IndianAbbreviationUnitLabels = DEFAULT_INDIAN_ABBREV_UNITS
): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) {
    return "—";
  }
  const prefix = `${sign}₹`;
  if (style === "indian") {
    const { lac, crore } = indianUnits;
    if (abs < LAC) {
      return prefix + formatMoneyFull(abs, "en-IN");
    }
    if (abs < CRORE) {
      return `${prefix}${ratioString(abs / LAC, 2)} ${lac}`;
    }
    return `${prefix}${ratioString(abs / CRORE, 2)} ${crore}`;
  }
  if (style === "us") {
    if (abs < MILLION) {
      return prefix + formatMoneyFull(abs, "en-US");
    }
    if (abs < BILLION) {
      return prefix + ratioString(abs / MILLION, 2) + "M";
    }
    return prefix + ratioString(abs / BILLION, 2) + "B";
  }
  if (abs < 1000) {
    return prefix + formatMoneyFull(abs, "en-US");
  }
  if (abs < MILLION) {
    return prefix + ratioString(abs / 1000, 2) + "K";
  }
  if (abs < BILLION) {
    return prefix + ratioString(abs / MILLION, 2) + "M";
  }
  return prefix + ratioString(abs / BILLION, 2) + "B";
}
