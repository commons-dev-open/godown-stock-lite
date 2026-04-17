import { memo, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../Button";

interface MahajansHeroProps {
  totalLendersDisplay: string;
  totalLendDisplay: string;
  totalDepositDisplay: string;
  balanceDisplay: string;
  balanceSuffix?: string;
  balanceValueClassName: string;
  showUpdatesIndicator: boolean;
  canFetchLatest: boolean;
  onFetchLatest: () => void;
  toolbar: ReactNode;
  onAdd: () => void;
}

function MahajansHeroComponent({
  totalLendersDisplay,
  totalLendDisplay,
  totalDepositDisplay,
  balanceDisplay,
  balanceSuffix,
  balanceValueClassName,
  showUpdatesIndicator,
  canFetchLatest,
  onFetchLatest,
  toolbar,
  onAdd,
}: Readonly<MahajansHeroProps>) {
  const { t } = useTranslation("mahajans");
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[12rem] shrink-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {t("hero.title")}
            </h1>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.title")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {totalLendersDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.creditPurchase")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-danger)] tabular-nums">
                    {totalLendDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.settlements")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-success)] tabular-nums">
                    {totalDepositDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.balance")}
                    {balanceSuffix && (
                      <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
                        {balanceSuffix}
                      </span>
                    )}
                  </p>
                  <p
                    className={`dashboard-hero-kpi-value tabular-nums ${balanceValueClassName}`}
                  >
                    {balanceDisplay}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end shrink-0">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                {canFetchLatest && (
                  <Button
                    variant={showUpdatesIndicator ? "amber" : "secondary"}
                    type="button"
                    onClick={onFetchLatest}
                    className="!py-1.5 !text-xs shrink-0"
                    title={
                      showUpdatesIndicator
                        ? t("hero.fetchLatestHintChanged")
                        : t("hero.fetchLatestHintDefault")
                    }
                  >
                    {showUpdatesIndicator ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-bg-surface)] shrink-0"
                          aria-hidden
                        />
                        <span>{t("hero.fetchLatest")}</span>
                      </span>
                    ) : (
                      t("hero.fetchLatest")
                    )}
                  </Button>
                )}
                {toolbar}
              </div>
              <Button
                type="button"
                onClick={onAdd}
                className="w-full sm:w-auto shrink-0"
              >
                <Plus
                  size={18}
                  className="mr-1.5 shrink-0"
                  aria-hidden="true"
                />
                {t("actions.addMahajan")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const MahajansHero = memo(MahajansHeroComponent);
