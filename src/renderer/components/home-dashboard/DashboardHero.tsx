import { memo } from "react";

interface DashboardHeroProps {
  todaySaleLabel: string;
  weekSaleLabel: string;
  monthSaleLabel: string;
  lenderNetLabel: string;
  lenderNetClassName: string;
}

function DashboardHeroComponent({
  todaySaleLabel,
  weekSaleLabel,
  monthSaleLabel,
  lenderNetLabel,
  lenderNetClassName,
}: Readonly<DashboardHeroProps>) {
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1.5 shrink-0 xl:max-w-[15rem]">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              Home Dashboard
            </h1>
          </div>
          <div className="dashboard-hero-metrics min-w-0 w-full max-w-full xl:w-auto xl:shrink-0">
            <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Today
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {todaySaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  This Week
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {weekSaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  This Month
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {monthSaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Lender Net
                </p>
                <p className={`dashboard-hero-kpi-value ${lenderNetClassName}`}>
                  {lenderNetLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
