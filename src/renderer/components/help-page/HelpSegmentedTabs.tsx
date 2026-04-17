import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Package,
  PieChart,
  Scale,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HelpTabId } from "./types";

interface TabItem {
  id: HelpTabId;
  label: string;
  Icon: LucideIcon;
}

const TAB_ITEMS: readonly TabItem[] = [
  { id: "overview", label: "Overview", Icon: Home },
  { id: "getting-started", label: "Getting started", Icon: Sparkles },
  { id: "units", label: "Units", Icon: Scale },
  { id: "products", label: "Products", Icon: Package },
  { id: "lenders", label: "Lenders", Icon: Users },
  { id: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { id: "daily-sales", label: "Daily sales", Icon: CalendarDays },
  { id: "invoices", label: "Invoices", Icon: FileText },
  { id: "reports", label: "Reports", Icon: PieChart },
  { id: "settings-data", label: "Settings & data", Icon: Settings },
];

interface HelpSegmentedTabsProps {
  active: HelpTabId;
  onChange: (id: HelpTabId) => void;
}

function readScrollEdges(el: HTMLDivElement) {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  const overflow = scrollWidth > clientWidth + 2;
  const canScrollLeft = overflow && scrollLeft > 2;
  const canScrollRight =
    overflow && scrollLeft < scrollWidth - clientWidth - 2;
  return { overflow, canScrollLeft, canScrollRight };
}

export function HelpSegmentedTabs({
  active,
  onChange,
}: Readonly<HelpSegmentedTabsProps>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const refreshScrollEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const next = readScrollEdges(el);
    setOverflow(next.overflow);
    setCanScrollLeft(next.canScrollLeft);
    setCanScrollRight(next.canScrollRight);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    refreshScrollEdges();
    el.addEventListener("scroll", refreshScrollEdges, { passive: true });
    const ro = new ResizeObserver(refreshScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", refreshScrollEdges);
      ro.disconnect();
    };
  }, [refreshScrollEdges]);

  useLayoutEffect(() => {
    refreshScrollEdges();
  }, [active, refreshScrollEdges]);

  function scrollTabs(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const delta = Math.min(280, Math.floor(el.clientWidth * 0.85)) * direction;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  const arrowBtnClass =
    "flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-35 disabled:hover:bg-[var(--color-bg-surface)] disabled:hover:text-[var(--color-text-secondary)]";

  return (
    <div className="flex min-w-0 items-stretch gap-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-1">
      {overflow ? (
        <button
          type="button"
          className={arrowBtnClass}
          aria-label="Scroll topics left"
          title="More topics on the left"
          disabled={!canScrollLeft}
          onClick={() => scrollTabs(-1)}
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}

      <div
        ref={scrollerRef}
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
        role="tablist"
        aria-label="Help topics"
      >
        <div className="flex w-max min-w-full flex-nowrap gap-1">
          {TAB_ITEMS.map(({ id, label, Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                id={`help-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`help-panel-${id}`}
                onClick={() => onChange(id)}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  isActive
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-default)]"
                    : "border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 sm:w-4 sm:h-4"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {overflow ? (
        <button
          type="button"
          className={arrowBtnClass}
          aria-label="Scroll topics right"
          title="More topics on the right"
          disabled={!canScrollRight}
          onClick={() => scrollTabs(1)}
        >
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
