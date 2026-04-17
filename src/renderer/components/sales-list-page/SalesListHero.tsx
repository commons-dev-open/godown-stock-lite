import { memo, type ReactNode } from "react";

export interface SalesListHeroMetric {
  label: string;
  displayValue: string;
}

interface SalesListHeroProps {
  title: string;
  metrics: readonly SalesListHeroMetric[];
  actions: ReactNode;
}

function SalesListHeroComponent({
  title,
  metrics,
  actions,
}: Readonly<SalesListHeroProps>) {
  const slots = metrics.slice(0, 3);
  const hasMetrics = slots.length > 0;
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[15rem] shrink-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {title}
            </h1>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            {hasMetrics ? (
              <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
                <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-3 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
                  {slots.map((m) => (
                    <div key={m.label} className="dashboard-metric-card">
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {m.label}
                      </p>
                      <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                        {m.displayValue}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto shrink-0 lg:items-center">
              {actions}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SalesListHero = memo(SalesListHeroComponent);
