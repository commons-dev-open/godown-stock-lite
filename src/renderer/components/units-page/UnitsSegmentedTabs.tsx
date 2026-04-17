import { useTranslation } from "react-i18next";
import { ArrowLeftRight, List, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UnitsTabId } from "./types";

interface TabItem {
  id: UnitsTabId;
  labelKey: "tabs.all" | "tabs.types" | "tabs.conversions";
  Icon: LucideIcon;
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "all", labelKey: "tabs.all", Icon: List },
  { id: "types", labelKey: "tabs.types", Icon: Tag },
  {
    id: "conversions",
    labelKey: "tabs.conversions",
    Icon: ArrowLeftRight,
  },
];

interface UnitsSegmentedTabsProps {
  active: UnitsTabId;
  onChange: (id: UnitsTabId) => void;
}

export function UnitsSegmentedTabs({
  active,
  onChange,
}: Readonly<UnitsSegmentedTabsProps>) {
  const { t } = useTranslation("units");
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-1"
      role="tablist"
      aria-label={t("tabs.ariaLabel")}
    >
      {TAB_ITEMS.map(({ id, labelKey, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:min-w-0 ${
              isActive
                ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-default)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
