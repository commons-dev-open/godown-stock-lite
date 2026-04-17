import Button from "../Button";
import type { MahajanSummaryTotals } from "./types";
import { mahajanNetBalanceTextClass } from "./mahajanBalanceTextClass";
import { formatDecimal } from "../../../shared/numbers";

interface MahajansSummarySectionProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  summary: MahajanSummaryTotals | null;
  showUpdatesIndicator: boolean;
  onFetchLatest: () => void;
  onRetry: () => void;
  onGetTotals: () => void;
}

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading totals">
      <div className="h-8 w-36 rounded-md bg-[var(--color-bg-surface-raised)]" />
      <div className="flex flex-wrap gap-3">
        <div className="h-4 w-40 rounded bg-[var(--color-bg-surface-raised)]" />
        <div className="h-4 w-36 rounded bg-[var(--color-bg-surface-raised)]" />
        <div className="h-4 w-32 rounded bg-[var(--color-bg-surface-raised)]" />
      </div>
    </div>
  );
}

export function MahajansSummarySection({
  isLoading,
  isError,
  error,
  summary,
  showUpdatesIndicator,
  onFetchLatest,
  onRetry,
  onGetTotals,
}: Readonly<MahajansSummarySectionProps>) {
  return (
    <article className="dashboard-panel">
      <div className="dashboard-section-head">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Totals across lenders
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)] max-w-3xl">
            Credit purchases and settlements roll up here. Use the{" "}
            <span className="text-[var(--color-text-secondary)]">
              Fetch latest
            </span>
            {` control after ledger changes so the figures stay current.`}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-4">
        {isLoading && <SummarySkeleton />}
        {!isLoading && isError && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-[var(--color-danger)]">
              Failed to load totals
              {error instanceof Error ? `: ${error.message}` : ""}
            </p>
            <Button
              variant="secondary"
              type="button"
              onClick={onRetry}
              className="!py-1.5 !text-xs shrink-0 self-start sm:self-auto"
            >
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && summary && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Button
              variant={showUpdatesIndicator ? "amber" : "secondary"}
              type="button"
              onClick={onFetchLatest}
              className="!py-1 !text-xs shrink-0"
              title={
                showUpdatesIndicator
                  ? "Totals may have changed — click to refresh"
                  : "Refresh totals"
              }
            >
              {showUpdatesIndicator ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-bg-surface)] shrink-0"
                    aria-hidden
                  />
                  <span>Fetch latest</span>
                </span>
              ) : (
                "Fetch latest"
              )}
            </Button>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--color-text-secondary)]">
                Total credit purchase
              </span>
              <span className="font-medium text-[var(--color-danger)]">
                ₹{formatDecimal(summary.totalLend)}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--color-text-secondary)]">
                Total settlements
              </span>
              <span className="font-medium text-[var(--color-success)]">
                ₹{formatDecimal(summary.totalDeposit)}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--color-text-secondary)]">Balance</span>
              <span className={mahajanNetBalanceTextClass(summary.balance)}>
                ₹{formatDecimal(Math.abs(summary.balance))}
                {summary.balance > 0 && " (payable)"}
                {summary.balance < 0 && " (receivable)"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--color-text-secondary)]">
                Receivable
              </span>
              <span className="font-medium text-[var(--color-success)]">
                {summary.countOweMe}{" "}
                {summary.countOweMe === 1 ? "lender" : "lenders"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[var(--color-text-secondary)]">Payable</span>
              <span className="font-medium text-[var(--color-danger)]">
                {summary.countIOwe}{" "}
                {summary.countIOwe === 1 ? "lender" : "lenders"}
              </span>
            </div>
          </div>
        )}
        {!isLoading && !isError && !summary && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Totals are not loaded yet.
            </p>
            <Button
              variant="secondary"
              type="button"
              onClick={onGetTotals}
              className="!py-1.5 !text-sm shrink-0 self-start sm:self-auto"
            >
              Load totals
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
