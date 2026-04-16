import { formatDecimal } from "../../shared/numbers";

export interface MahajanBalanceData {
  totalLends: number;
  totalDeposits: number;
  balance: number;
}

interface MahajanBalanceCardProps {
  balance: MahajanBalanceData | null | undefined;
  loading?: boolean;
  /** Optional balance after an action (e.g. after this lend/deposit) for confirm modals */
  balanceAfter?: number;
  /** Label for balanceAfter, e.g. "After this credit purchase:" */
  balanceAfterLabel?: string;
  /** Layout: "row" for ledger header, "compact" for modals (smaller, bordered box) */
  variant?: "row" | "compact";
}

function BalanceLine({
  balance,
  balanceAfter,
  balanceAfterLabel,
}: {
  balance: number;
  balanceAfter?: number;
  balanceAfterLabel?: string;
}) {
  const balanceClass = balance >= 0 ? "text-[var(--color-amount-payable)]" : "text-[var(--color-amount-receivable)]";
  const hint = balance > 0 ? " (payable)" : balance < 0 ? " (receivable)" : "";
  const arrow = balance > 0 ? "\u2191" : balance < 0 ? "\u2193" : "";

  return (
    <>
      <span className={balanceClass}>
        {arrow && <span className="mr-0.5" aria-hidden="true">{arrow}</span>}
        ₹{formatDecimal(Math.abs(balance))}
        {hint && <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">{hint}</span>}
      </span>
      {balanceAfter !== undefined &&
        balanceAfterLabel !== undefined &&
        (() => {
          const afterClass =
            balanceAfter >= 0 ? "text-[var(--color-amount-payable)]" : "text-[var(--color-amount-receivable)]";
          const afterHint =
            balanceAfter > 0
              ? " (payable)"
              : balanceAfter < 0
                ? " (receivable)"
                : "";
          const afterArrow = balanceAfter > 0 ? "\u2191" : balanceAfter < 0 ? "\u2193" : "";
          return (
            <>
              {" — "}
              <span className="font-medium">
                {balanceAfterLabel}{" "}
                <span className={afterClass}>
                  {afterArrow && <span className="mr-0.5" aria-hidden="true">{afterArrow}</span>}
                  ₹{formatDecimal(Math.abs(balanceAfter))}
                  {afterHint && (
                    <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                      {afterHint}
                    </span>
                  )}
                </span>
              </span>
            </>
          );
        })()}
    </>
  );
}

export default function MahajanBalanceCard({
  balance,
  loading = false,
  balanceAfter,
  balanceAfterLabel,
  variant = "row",
}: MahajanBalanceCardProps) {
  if (loading) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading balance...</p>;
  }
  if (balance == null) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div className="text-sm rounded-lg border border-[var(--color-border-default)] p-3 bg-[var(--color-bg-surface-raised)] space-y-1">
        <p>Total Credit Purchase: ₹{formatDecimal(balance.totalLends)}</p>
        <p>Total Settlements: ₹{formatDecimal(balance.totalDeposits)}</p>
        <p className="font-medium">
          Balance (Credit Purchase − Settlement): <BalanceLine balance={balance.balance} />
        </p>
        {balanceAfter !== undefined && balanceAfterLabel && (
          <p className="font-medium">
            {balanceAfterLabel} <BalanceLine balance={balanceAfter} />
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-4 py-3">
      <div>
        <span className="text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
          Total Credit Purchase
        </span>
        <p className="text-lg font-semibold text-[var(--color-warning-text)]">
          ₹{formatDecimal(balance.totalLends)}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
          Total Settlements
        </span>
        <p className="text-lg font-semibold text-[var(--color-success-text)]">
          ₹{formatDecimal(balance.totalDeposits)}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
          Balance (Credit Purchase − Settlement)
        </span>
        <p
          className={
            balance.balance >= 0
              ? "text-lg font-semibold text-[var(--color-amount-payable)]"
              : "text-lg font-semibold text-[var(--color-amount-receivable)]"
          }
        >
          {balance.balance > 0 && <span className="mr-1" aria-hidden="true">&#8593;</span>}
          {balance.balance < 0 && <span className="mr-1" aria-hidden="true">&#8595;</span>}
          ₹{formatDecimal(Math.abs(balance.balance))}
          {balance.balance > 0 && (
            <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
              (payable)
            </span>
          )}
          {balance.balance < 0 && (
            <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
              (receivable)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
