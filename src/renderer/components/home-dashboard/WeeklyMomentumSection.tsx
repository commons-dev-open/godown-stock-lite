import { memo, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatDateForView } from "../../lib/date";
import { formatRupee } from "../../../shared/numbers";

interface WeeklyMomentumSectionProps {
  weeklyDate: string;
  content: ReactNode;
  totalWeekSales: number;
  totalWeekExpenditure: number;
  peakWeekSale: number;
  entriesCount: number;
}

function WeeklyMomentumSectionComponent({
  weeklyDate,
  content,
  totalWeekSales,
  totalWeekExpenditure,
  peakWeekSale,
  entriesCount,
}: Readonly<WeeklyMomentumSectionProps>) {
  return (
    <article className="dashboard-panel xl:col-span-2 min-h-[23rem]">
      <div className="dashboard-section-head">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            7-Day Sale Momentum
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Sales and expenditure trend for the selected week ending on{" "}
            {formatDateForView(weeklyDate)}.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
          <ArrowUpRight size={13} />
          Live trend
        </div>
      </div>
      {content}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">Week Sale</p>
          <p className="text-sm font-semibold">{formatRupee(totalWeekSales)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">Week Expenditure</p>
          <p className="text-sm font-semibold">{formatRupee(totalWeekExpenditure)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">Peak Day</p>
          <p className="text-sm font-semibold">{formatRupee(peakWeekSale)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">Entries</p>
          <p className="text-sm font-semibold">{entriesCount}</p>
        </div>
      </div>
    </article>
  );
}

export const WeeklyMomentumSection = memo(WeeklyMomentumSectionComponent);
