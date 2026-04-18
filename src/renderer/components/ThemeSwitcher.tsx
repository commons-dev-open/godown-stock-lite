import type { ComponentProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import Tooltip from "./Tooltip";

interface ThemeOption {
  value: ThemeMode;
  labelKey: "light" | "dark" | "system";
  short: "L" | "D" | "S";
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", labelKey: "light", short: "L", icon: Sun },
  { value: "dark", labelKey: "dark", short: "D", icon: Moon },
  { value: "system", labelKey: "system", short: "S", icon: Monitor },
];

type TooltipPlacement = NonNullable<ComponentProps<typeof Tooltip>["placement"]>;

export default function ThemeSwitcher({
  variant = "full",
  tooltipPlacement = "left",
}: Readonly<{
  variant?: "full" | "compact";
  /** Tooltip placement when `variant` is `"compact"`. */
  tooltipPlacement?: TooltipPlacement;
}>) {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation("navigation");

  if (variant === "compact") {
    const currentIdx = THEME_OPTIONS.findIndex((option) => option.value === mode);
    const nextOption = THEME_OPTIONS[(currentIdx + 1) % THEME_OPTIONS.length];
    const current = THEME_OPTIONS[currentIdx] ?? THEME_OPTIONS[0];
    const Icon = current.icon;
    const modeLabel = t(`themes.${current.labelKey}`);

    return (
      <Tooltip
        content={`${t("sidebar.theme")}: ${modeLabel}`}
        placement={tooltipPlacement}
      >
        <button
          type="button"
          onClick={() => setMode(nextOption.value)}
          aria-label={t("sidebar.theme")}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]"
        >
          <Icon size={16} strokeWidth={1.5} />
          <span>{current.short}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1">
      {THEME_OPTIONS.map((option) => {
        const active = option.value === mode;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              active
                ? "bg-[var(--color-accent)] text-[var(--color-accent-text)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon size={14} strokeWidth={1.75} />
              {t(`themes.${option.labelKey}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
