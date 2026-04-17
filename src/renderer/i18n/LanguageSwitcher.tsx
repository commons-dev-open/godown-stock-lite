import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useLocale, type Locale } from "./LocaleContext";
import Tooltip from "../components/Tooltip";

type LocaleOption = { value: Locale; label: string; short: string };

const LOCALE_OPTIONS: LocaleOption[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "hi", label: "हिन्दी", short: "हि" },
  { value: "bn", label: "বাংলা", short: "বা" },
];

/**
 * Language switcher.
 *
 * Variants:
 * - "full": segmented button row, used in Settings > Preferences.
 * - "compact": single button that cycles through locales, used in sidebar footer.
 */
export default function LanguageSwitcher({
  variant = "full",
  compactTone = "sidebar",
}: Readonly<{
  variant?: "full" | "compact";
  compactTone?: "sidebar" | "surface";
}>) {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation("navigation");

  if (variant === "compact") {
    // Cycle to next locale on click
    const currentIdx = LOCALE_OPTIONS.findIndex((o) => o.value === locale);
    const nextOption =
      LOCALE_OPTIONS[(currentIdx + 1) % LOCALE_OPTIONS.length];
    const current = LOCALE_OPTIONS[currentIdx] ?? LOCALE_OPTIONS[0];
    const compactClassName =
      compactTone === "surface"
        ? "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]"
        : "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-text-sidebar-active)] transition-colors";
    const tooltipPlacement = compactTone === "surface" ? "left" : "right";
    return (
      <Tooltip content={`${t("sidebar.language")}: ${current.label}`} placement={tooltipPlacement}>
        <button
          type="button"
          onClick={() => setLocale(nextOption.value)}
          aria-label={t("sidebar.language")}
          className={compactClassName}
        >
          <Globe size={16} strokeWidth={1.5} />
          <span>{current.short}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("sidebar.language")}
      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1"
    >
      {LOCALE_OPTIONS.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              active
                ? "bg-[var(--color-accent)] text-[var(--color-accent-text)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
