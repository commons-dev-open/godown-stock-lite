import { memo, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import Button from "../Button";

interface MahajanLedgerHeroProps {
  lenderTitle: string;
  totalCreditDisplay: string;
  totalSettlementDisplay: string;
  balanceDisplay: string;
  balanceSuffix?: string;
  balanceValueClassName: string;
  toolbar: ReactNode;
  onBack: () => void;
  onAddCreditPurchase: () => void;
  onAddSettlement: () => void;
  onAddRefund: () => void;
}

function MahajanLedgerHeroComponent({
  lenderTitle,
  totalCreditDisplay,
  totalSettlementDisplay,
  balanceDisplay,
  balanceSuffix,
  balanceValueClassName,
  toolbar,
  onBack,
  onAddCreditPurchase,
  onAddSettlement,
  onAddRefund,
}: Readonly<MahajanLedgerHeroProps>) {
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-2 lg:max-w-[14rem] shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex w-max items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to lenders
            </button>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {lenderTitle}
            </h1>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 lg:w-max lg:grid-cols-none lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Credit purchase
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-danger)] tabular-nums">
                    {totalCreditDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Settlements
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-success)] tabular-nums">
                    {totalSettlementDisplay}
                  </p>
                </div>
                <div className="dashboard-metric-card sm:col-span-2 sm:max-w-none lg:col-span-1">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Balance
                    {balanceSuffix ? (
                      <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
                        {balanceSuffix}
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={`dashboard-hero-kpi-value tabular-nums ${balanceValueClassName}`}
                  >
                    {balanceDisplay}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 shrink-0 flex-row flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
              {toolbar}
              <Button
                type="button"
                variant="amber"
                onClick={onAddCreditPurchase}
                className="shrink-0 whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
                Add credit purchase
              </Button>
              <Button
                type="button"
                variant="green"
                onClick={onAddSettlement}
                className="shrink-0 whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
                Add settlement
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onAddRefund}
                className="shrink-0 whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
                Add refund
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const MahajanLedgerHero = memo(MahajanLedgerHeroComponent);
