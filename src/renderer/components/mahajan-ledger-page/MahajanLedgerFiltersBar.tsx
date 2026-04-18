import { Filter, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import DateInput from "../DateInput";

export type MahajanLedgerFilterType =
  | "all"
  | "credit_purchase"
  | "settlement"
  | "lender_refund";

interface MahajanLedgerFiltersBarProps {
  filterType: MahajanLedgerFilterType;
  filterDateFrom: string;
  filterDateTo: string;
  moreFiltersOpen: boolean;
  onMoreFiltersOpenChange: (open: boolean) => void;
  onFilterChange: (updates: {
    type?: MahajanLedgerFilterType;
    dateFrom?: string;
    dateTo?: string;
  }) => void;
}

export function MahajanLedgerFiltersBar({
  filterType,
  filterDateFrom,
  filterDateTo,
  moreFiltersOpen,
  onMoreFiltersOpenChange,
  onFilterChange,
}: Readonly<MahajanLedgerFiltersBarProps>) {
  const { t } = useTranslation("transactions");
  const { t: tMah } = useTranslation("mahajans");

  return (
    <>
      <div className="flex flex-nowrap items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-3 overflow-hidden">
        <select
          className="min-w-0 shrink-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm"
          value={filterType}
          onChange={(e) =>
            onFilterChange({
              type: e.target.value as MahajanLedgerFilterType,
            })
          }
        >
          <option value="all">{t("filters.type_all")}</option>
          <option value="credit_purchase">
            {t("filters.credit_purchase_only")}
          </option>
          <option value="settlement">{t("filters.settlement_only")}</option>
          <option value="lender_refund">
            {t("filters.lender_refund_only")}
          </option>
        </select>
        <button
          type="button"
          onClick={() => onMoreFiltersOpenChange(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
        >
          <Filter size={16} aria-hidden="true" />
          {tMah("ledger.filters.moreFilters")}
          {(filterDateFrom || filterDateTo) && (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-[var(--color-accent-subtle)] px-1 text-xs font-medium text-[var(--color-accent)]">
              1
            </span>
          )}
        </button>
      </div>

      {moreFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => onMoreFiltersOpenChange(false)}
            aria-hidden
          />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-[var(--color-bg-surface)] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {tMah("ledger.filters.moreFilters")}
              </h2>
              <button
                type="button"
                onClick={() => onMoreFiltersOpenChange(false)}
                className="rounded p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-surface-raised)] hover:text-[var(--color-text-secondary)]"
                aria-label={t("actions.close")}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <label
                htmlFor="mahajan-ledger-date-from"
                className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
              >
                {t("filters.from_date")}
                <DateInput
                  id="mahajan-ledger-date-from"
                  value={filterDateFrom}
                  onChange={(v) => onFilterChange({ dateFrom: v })}
                  className="w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-sm"
                />
              </label>
              <label
                htmlFor="mahajan-ledger-date-to"
                className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
              >
                {t("filters.to_date")}
                <DateInput
                  id="mahajan-ledger-date-to"
                  value={filterDateTo}
                  onChange={(v) => onFilterChange({ dateTo: v })}
                  className="w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-sm"
                />
              </label>
              {(filterType !== "all" || filterDateFrom || filterDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange({
                      type: "all",
                      dateFrom: "",
                      dateTo: "",
                    });
                    onMoreFiltersOpenChange(false);
                  }}
                  className="inline-flex items-center gap-1 self-start text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={16} aria-hidden="true" />
                  {t("filters.clear")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
