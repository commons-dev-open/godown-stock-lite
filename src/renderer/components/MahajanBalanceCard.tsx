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
  /** Label for balanceAfter, e.g. "After this lend:" */
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
  const balanceClass = balance >= 0 ? "text-amber-700" : "text-green-700";
  const hint = balance > 0 ? " (payable)" : balance < 0 ? " (receivable)" : "";

  return (
    <>
      <span className={balanceClass}>
        ₹{formatDecimal(Math.abs(balance))}
        {hint && <span className="ml-1 text-gray-500 font-normal">{hint}</span>}
      </span>
      {balanceAfter !== undefined &&
        balanceAfterLabel !== undefined &&
        (() => {
          const afterClass =
            balanceAfter >= 0 ? "text-amber-700" : "text-green-700";
          const afterHint =
            balanceAfter > 0
              ? " (payable)"
              : balanceAfter < 0
                ? " (receivable)"
                : "";
          return (
            <>
              {" — "}
              <span className="font-medium">
                {balanceAfterLabel}{" "}
                <span className={afterClass}>
                  ₹{formatDecimal(Math.abs(balanceAfter))}
                  {afterHint && (
                    <span className="ml-1 text-gray-500 font-normal">
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
    return <p className="text-sm text-gray-500">Loading balance…</p>;
  }
  if (balance == null) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div className="text-sm rounded border p-3 bg-gray-50 space-y-1">
        <p>Total Lends: ₹{formatDecimal(balance.totalLends)}</p>
        <p>Total Deposits: ₹{formatDecimal(balance.totalDeposits)}</p>
        <p className="font-medium">
          Balance (Lend - Deposit): <BalanceLine balance={balance.balance} />
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
    <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div>
        <span className="text-xs font-medium uppercase text-gray-500">
          Total Lends
        </span>
        <p className="text-lg font-semibold text-amber-800">
          ₹{formatDecimal(balance.totalLends)}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium uppercase text-gray-500">
          Total Deposits
        </span>
        <p className="text-lg font-semibold text-green-800">
          ₹{formatDecimal(balance.totalDeposits)}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium uppercase text-gray-500">
          Balance (Lend - Deposit)
        </span>
        <p
          className={
            balance.balance >= 0
              ? "text-lg font-semibold text-amber-800"
              : "text-lg font-semibold text-green-800"
          }
        >
          ₹{formatDecimal(Math.abs(balance.balance))}
          {balance.balance > 0 && (
            <span className="ml-1 text-sm font-normal text-gray-500">
              (payable)
            </span>
          )}
          {balance.balance < 0 && (
            <span className="ml-1 text-sm font-normal text-gray-500">
              (receivable)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
