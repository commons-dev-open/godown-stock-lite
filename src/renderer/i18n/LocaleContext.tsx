import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./index";
import type { NumeralSystem } from "./digits";

export type Locale = SupportedLocale;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** BCP-47 locale string for Intl APIs (en-IN, hi-IN, bn-IN). */
  intlLocale: string;
  /** "latn" for English/Bengali, "deva" for Hindi. */
  numeralSystem: NumeralSystem;
  supportedLocales: readonly Locale[];
};

const INTL_LOCALE_MAP: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
};

const NUMERAL_SYSTEM_MAP: Record<Locale, NumeralSystem> = {
  en: "latn",
  hi: "deva",
  bn: "latn",
};

function readStored(): Locale {
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "hi" || v === "bn") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  intlLocale: INTL_LOCALE_MAP[DEFAULT_LOCALE],
  numeralSystem: NUMERAL_SYSTEM_MAP[DEFAULT_LOCALE],
  supportedLocales: SUPPORTED_LOCALES,
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored());

  // Keep i18next + <html lang> in sync with state on mount and changes.
  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      intlLocale: INTL_LOCALE_MAP[locale],
      numeralSystem: NUMERAL_SYSTEM_MAP[locale],
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
