import { ArrowLeftRight, List, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UnitsTabId } from "./types";

interface TabItem {
  id: UnitsTabId;
  label: string;
  Icon: LucideIcon;
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "all", label: "All units", Icon: List },
  { id: "types", label: "Unit types", Icon: Tag },
  { id: "conversions", label: "Standard conversions", Icon: ArrowLeftRight },
];

interface UnitsSegmentedTabsProps {
  active: UnitsTabId;
  onChange: (id: UnitsTabId) => void;
}

export function UnitsSegmentedTabs({
  active,
  onChange,
}: Readonly<UnitsSegmentedTabsProps>) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-1"
      role="tablist"
      aria-label="Units sections"
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
            className={`inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:min-w-0 ${
              isActive
                ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-default)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
