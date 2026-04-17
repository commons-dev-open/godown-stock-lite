import {
  Activity,
  AlertTriangle,
  Building2,
  Palette,
  Percent,
  Receipt,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SettingsTabId } from "./types";

interface TabItem {
  id: SettingsTabId;
  label: string;
  Icon: LucideIcon;
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "business", label: "Business", Icon: Building2 },
  { id: "tax", label: "Tax & GST", Icon: Receipt },
  { id: "discounts", label: "Discounts", Icon: Percent },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "security", label: "Security", Icon: Shield },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "data", label: "Data", Icon: AlertTriangle },
];

interface SettingsSegmentedTabsProps {
  active: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
}

export function SettingsSegmentedTabs({
  active,
  onChange,
}: Readonly<SettingsSegmentedTabsProps>) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-1"
      role="tablist"
      aria-label="Settings sections"
    >
      {TAB_ITEMS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`inline-flex flex-1 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:flex-none sm:min-w-0 sm:gap-2 sm:px-3 sm:text-sm ${
              isActive
                ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-default)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
