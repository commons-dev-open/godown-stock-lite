import { memo } from "react";
import { useTranslation } from "react-i18next";

interface DashboardHeroProps {
  todaySaleLabel: string;
  weekSaleLabel: string;
  calendarWeekSaleLabel: string;
  monthSaleLabel: string;
  lenderNetLabel: string;
  lenderNetClassName: string;
}

function DashboardHeroComponent({
  todaySaleLabel,
  weekSaleLabel,
  calendarWeekSaleLabel,
  monthSaleLabel,
  lenderNetLabel,
  lenderNetClassName,
}: Readonly<DashboardHeroProps>) {
  const { t } = useTranslation("home");

  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1.5 shrink-0 xl:max-w-[15rem]">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {t("hero.dashboardTitle")}
            </h1>
          </div>
          <div className="dashboard-hero-metrics min-w-0 w-full max-w-full xl:w-auto xl:shrink-0">
            <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t("hero.metrics.today")}
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {todaySaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t("hero.metrics.last7Days")}
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {weekSaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t("hero.metrics.thisCalendarWeek")}
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {calendarWeekSaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t("hero.metrics.thisMonth")}
                </p>
                <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)]">
                  {monthSaleLabel}
                </p>
              </div>
              <div className="dashboard-metric-card">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {t("hero.metrics.lenderNet")}
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
