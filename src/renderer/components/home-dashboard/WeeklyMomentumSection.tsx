import { memo, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateForView } from "../../lib/date";
import { formatRupee } from "../../../shared/numbers";
import { type SaleMomentumScope } from "./types";

interface WeeklyMomentumSectionProps {
  weeklyDate: string;
  saleMomentumScope: SaleMomentumScope;
  onSaleMomentumScopeChange: (scope: SaleMomentumScope) => void;
  content: ReactNode;
  totalWeekSales: number;
  totalWeekExpenditure: number;
  peakWeekSale: number;
  entriesCount: number;
}

function WeeklyMomentumSectionComponent({
  weeklyDate,
  saleMomentumScope,
  onSaleMomentumScopeChange,
  content,
  totalWeekSales,
  totalWeekExpenditure,
  peakWeekSale,
  entriesCount,
}: Readonly<WeeklyMomentumSectionProps>) {
  const { t } = useTranslation("home");
  const isCalendar = saleMomentumScope === "calendarWeek";

  return (
    <article className="dashboard-panel xl:col-span-2 min-h-[23rem]">
      <div className="dashboard-section-head">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t(
              isCalendar
                ? "weeklyMomentum.titleCalendar"
                : "weeklyMomentum.titleRolling"
            )}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t(
              isCalendar
                ? "weeklyMomentum.subtitleCalendar"
                : "weeklyMomentum.subtitleRolling",
              { date: formatDateForView(weeklyDate) }
            )}
          </p>
          <div
            className="flex flex-wrap gap-1.5 mt-2"
            role="group"
            aria-label={t("weeklyMomentum.scopeGroupAria")}
          >
            <button
              type="button"
              onClick={() => onSaleMomentumScopeChange("rolling7")}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                !isCalendar
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              {t("weeklyMomentum.scopeLast7Days")}
            </button>
            <button
              type="button"
              onClick={() => onSaleMomentumScopeChange("calendarWeek")}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                isCalendar
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              {t("weeklyMomentum.scopeThisWeek")}
            </button>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-[var(--color-accent-subtle)] text-[var(--color-accent)] shrink-0">
          <ArrowUpRight size={13} />
          {t("weeklyMomentum.liveTrend")}
        </div>
      </div>
      {content}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t(
              isCalendar
                ? "weeklyMomentum.periodTotalSaleCalendar"
                : "weeklyMomentum.periodTotalSaleRolling"
            )}
          </p>
          <p className="text-sm font-semibold">{formatRupee(totalWeekSales)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t(
              isCalendar
                ? "weeklyMomentum.periodTotalExpenditureCalendar"
                : "weeklyMomentum.periodTotalExpenditureRolling"
            )}
          </p>
          <p className="text-sm font-semibold">{formatRupee(totalWeekExpenditure)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t("weeklyMomentum.peakDay")}
          </p>
          <p className="text-sm font-semibold">{formatRupee(peakWeekSale)}</p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t("weeklyMomentum.entries")}
          </p>
          <p className="text-sm font-semibold">{entriesCount}</p>
        </div>
      </div>
    </article>
  );
}

export const WeeklyMomentumSection = memo(WeeklyMomentumSectionComponent);
