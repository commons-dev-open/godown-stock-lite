import {
  Activity,
  AlertTriangle,
  Building2,
  Download,
  Palette,
  Percent,
  Receipt,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { settingsTab } from "shared/test-ids";
import type { SettingsTabId } from "./types";

type SettingsTabLabelKey =
  | "tabs.business"
  | "tabs.tax"
  | "tabs.discounts"
  | "tabs.appearance"
  | "tabs.security"
  | "tabs.activity"
  | "tabs.appUpdates"
  | "tabs.data";

interface TabItem {
  id: SettingsTabId;
  labelKey: SettingsTabLabelKey;
  Icon: LucideIcon;
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "business", labelKey: "tabs.business", Icon: Building2 },
  { id: "tax", labelKey: "tabs.tax", Icon: Receipt },
  { id: "discounts", labelKey: "tabs.discounts", Icon: Percent },
  { id: "appearance", labelKey: "tabs.appearance", Icon: Palette },
  { id: "security", labelKey: "tabs.security", Icon: Shield },
  { id: "activity", labelKey: "tabs.activity", Icon: Activity },
  { id: "appUpdates", labelKey: "tabs.appUpdates", Icon: Download },
  { id: "data", labelKey: "tabs.data", Icon: AlertTriangle },
];

interface SettingsSegmentedTabsProps {
  active: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
}

export function SettingsSegmentedTabs({
  active,
  onChange,
}: Readonly<SettingsSegmentedTabsProps>) {
  const { t } = useTranslation("settings");
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-1"
      role="tablist"
      aria-label={t("hero.title")}
    >
      {TAB_ITEMS.map(({ id, labelKey, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            data-testid={settingsTab(id)}
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`inline-flex flex-1 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:flex-none sm:min-w-0 sm:gap-2 sm:px-3 sm:text-sm ${
              isActive
                ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-default)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
