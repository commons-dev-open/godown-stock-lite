import { memo } from "react";
import { Plus } from "lucide-react";
import Button from "../Button";
import {
  formatAbbreviatedInteger,
  type NumberAbbreviationStyle,
} from "../../../shared/numbers";
interface UnitsHeroProps {
  abbreviationStyle: NumberAbbreviationStyle;
  unitsCount: number;
  typesCount: number;
  conversionsCount: number;
  primaryLabel: string;
  onPrimary: () => void;
}

function UnitsHeroComponent({
  abbreviationStyle,
  unitsCount,
  typesCount,
  conversionsCount,
  primaryLabel,
  onPrimary,
}: Readonly<UnitsHeroProps>) {
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[14rem] shrink-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              Units & conversions
            </h1>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-3 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Units
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(unitsCount, abbreviationStyle)}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Types
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(typesCount, abbreviationStyle)}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Conversions
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(conversionsCount, abbreviationStyle)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex w-full justify-end lg:w-auto shrink-0 lg:items-center">
              <Button
                type="button"
                onClick={onPrimary}
                className="w-full sm:w-auto"
              >
                <Plus
                  size={18}
                  className="mr-1.5 shrink-0"
                  aria-hidden="true"
                />
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const UnitsHero = memo(UnitsHeroComponent);
