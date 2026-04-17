import { memo } from "react";
import { Settings as SettingsIcon } from "lucide-react";
interface SettingsHeroProps {
  companyName: string;
  gstEnabled: boolean;
}

function SettingsHeroComponent({
  companyName,
  gstEnabled,
}: Readonly<SettingsHeroProps>) {
  const companyDisplay =
    companyName.trim().length > 0 ? companyName.trim() : "—";

  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[16rem] shrink-0">
            <div className="flex items-center gap-2">
              <SettingsIcon
                size={22}
                strokeWidth={1.5}
                className="shrink-0 text-[var(--color-accent)]"
                aria-hidden="true"
              />
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
                Settings
              </h1>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-2.5 lg:w-max lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Company
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] truncate max-w-[10rem] sm:max-w-[14rem]">
                    {companyDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">GST</p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {gstEnabled ? "On" : "Off"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SettingsHero = memo(SettingsHeroComponent);
