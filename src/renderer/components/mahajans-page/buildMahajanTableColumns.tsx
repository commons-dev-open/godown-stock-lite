import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { Mahajan } from "../../../shared/types";
import { formatDecimal } from "../../../shared/numbers";

export interface MahajanBalanceColumnDeps {
  showBalanceAll: boolean;
  allBalances: Record<number, number>;
  balances: Record<number, number>;
  isLoadingAllBalances: boolean;
  loadingBalanceId: number | null;
  onLoadBalance: (mahajanId: number) => void;
  t: TFunction<"mahajans">;
}

interface ColumnShape {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: Mahajan) => ReactNode;
}

export function buildMahajanTableColumns(
  deps: MahajanBalanceColumnDeps
): ColumnShape[] {
  const {
    showBalanceAll,
    allBalances,
    balances,
    isLoadingAllBalances,
    loadingBalanceId,
    onLoadBalance,
    t,
  } = deps;

  return [
    { key: "name", label: t("columns.name") },
    { key: "address", label: t("columns.address") },
    { key: "phone", label: t("columns.phone") },
    {
      key: "balance",
      label: t("columns.balanceWithFormula"),
      align: "right",
      render: (row) => {
        const bal = showBalanceAll ? allBalances[row.id] : balances[row.id];
        if (bal !== undefined) {
          let colorClass = "text-[var(--color-text-tertiary)]";
          if (bal > 0) {
            colorClass = "text-[var(--color-danger)] font-medium";
          } else if (bal < 0) {
            colorClass = "text-[var(--color-success)] font-medium";
          }
          let hint = "";
          if (bal > 0) {
            hint = ` ${t("labels.payable")}`;
          } else if (bal < 0) {
            hint = ` ${t("labels.receivable")}`;
          }
          return (
            <span className={colorClass}>
              ₹{formatDecimal(Math.abs(bal))}
              {hint ? (
                <span className="text-[var(--color-text-tertiary)] font-normal">
                  {hint}
                </span>
              ) : null}
            </span>
          );
        }
        if (showBalanceAll && isLoadingAllBalances) {
          return (
            <span className="text-[var(--color-text-tertiary)] text-sm">
              {t("common.loading")}
            </span>
          );
        }
        if (showBalanceAll) {
          return (
            <span className="text-[var(--color-text-tertiary)] text-sm">
              {t("table.settledValue")}
            </span>
          );
        }
        const loading = loadingBalanceId === row.id;
        return (
          <button
            type="button"
            onClick={() => onLoadBalance(row.id)}
            disabled={loading}
            className="text-sm text-[var(--color-accent)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("common.loading") : t("actions.viewBalance")}
          </button>
        );
      },
    },
    {
      key: "id",
      label: t("columns.details"),
      render: (row) => (
        <Link
          to={`/mahajans/ledger/${row.id}`}
          className="text-[var(--color-accent)] hover:underline"
        >
          {t("actions.viewLedger")}
        </Link>
      ),
    },
  ];
}
