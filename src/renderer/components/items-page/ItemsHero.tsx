import { memo, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../Button";
import { useFormatters } from "../../i18n/useFormatters";
import type { NumberAbbreviationStyle } from "../../../shared/numbers";

interface ItemsHeroProps {
  abbreviationStyle: NumberAbbreviationStyle;
  catalogCount: number;
  lowStockCount: number;
  unitsCount: number;
  primaryLabel: string;
  onPrimary: () => void;
  toolbar: ReactNode;
}

function ItemsHeroComponent({
  abbreviationStyle,
  catalogCount,
  lowStockCount,
  unitsCount,
  primaryLabel,
  onPrimary,
  toolbar,
}: Readonly<ItemsHeroProps>) {
  const { t } = useTranslation("items");
  const { formatAbbreviatedInteger } = useFormatters();

  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[13rem] shrink-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {t("hero.title")}
            </h1>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-3 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.metrics.inCatalog")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(catalogCount, abbreviationStyle)}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.metrics.lowStock")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(lowStockCount, abbreviationStyle)}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.metrics.units")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(unitsCount, abbreviationStyle)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end shrink-0">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                {toolbar}
              </div>
              <Button
                type="button"
                onClick={onPrimary}
                className="w-full sm:w-auto shrink-0"
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

export const ItemsHero = memo(ItemsHeroComponent);
