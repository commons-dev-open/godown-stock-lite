import { useMemo, type CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltip";
import TransactionTypeBadge, {
  type TransactionType,
} from "../TransactionTypeBadge";
import DataTable, {
  type DataTablePagination,
} from "../DataTable";
import { formatDateForView, formatDateForForm } from "../../lib/date";
import { formatDecimal } from "../../../shared/numbers";
import type { MahajanDeposit, MahajanLend } from "../../../shared/types";
import {
  ledgerDescriptionFromPageRow,
  toDepositRecord,
  toLendRecord,
  type LenderLedgerPageRow,
} from "../../lib/lenderLedgerRow";

interface MahajanLedgerTableProps {
  rows: LenderLedgerPageRow[];
  onOpenInvoice: (path: string) => void;
  onEditRow: (row: LenderLedgerPageRow) => void;
  onDeleteRow: (row: LenderLedgerPageRow) => void;
  pagination?: DataTablePagination;
  scrollMaxHeight?: CSSProperties["maxHeight"];
}

export function MahajanLedgerTable({
  rows,
  onOpenInvoice,
  onEditRow,
  onDeleteRow,
  pagination,
  scrollMaxHeight,
}: Readonly<MahajanLedgerTableProps>) {
  const { t } = useTranslation("mahajans");
  const columns = useMemo(
    () => [
      {
        key: "transaction_date",
        label: t("ledger.columns.date"),
        render: (row: LenderLedgerPageRow) => (
          <Tooltip content={formatDateForForm(row.transaction_date)}>
            <span>{formatDateForView(row.transaction_date)}</span>
          </Tooltip>
        ),
      },
      {
        key: "type",
        label: t("ledger.columns.type"),
        render: (row: LenderLedgerPageRow) => (
          <TransactionTypeBadge
            type={row.type as TransactionType | "lend" | "deposit"}
          />
        ),
      },
      {
        key: "description",
        label: t("ledger.columns.description"),
        render: (row: LenderLedgerPageRow) => {
          const description = ledgerDescriptionFromPageRow(row);
          return (
            <>
              <span className="block">{description}</span>
              {row.type === "credit_purchase" &&
                (() => {
                  const rec = toLendRecord(row) as MahajanLend & {
                    lender_invoice_number?: string | null;
                    invoice_file_path?: string | null;
                  };
                  const invNum = rec.lender_invoice_number;
                  const invPath = rec.invoice_file_path;
                  return (
                    (invNum || invPath) && (
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {invNum && (
                          <span title={t("ledger.lenderInvoice")}>#{invNum}</span>
                        )}
                        {invPath && (
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(invPath)}
                            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                          >
                            {t("ledger.viewInvoice")}
                          </button>
                        )}
                      </span>
                    )
                  );
                })()}
              {row.type === "settlement" &&
                (() => {
                  const rec = toDepositRecord(row) as MahajanDeposit & {
                    payment_method?: string | null;
                    reference_number?: string | null;
                  };
                  const pm = rec.payment_method;
                  const ref = rec.reference_number;
                  return (
                    (pm || ref) && (
                      <span className="mt-1 block text-xs text-[var(--color-text-tertiary)]">
                        {pm && <span className="capitalize">{pm}</span>}
                        {pm && ref && " · "}
                        {ref && (
                          <span title={ref}>
                            {ref.length > 16
                              ? `${ref.slice(0, 14)}…`
                              : ref}
                          </span>
                        )}
                      </span>
                    )
                  );
                })()}
            </>
          );
        },
      },
      {
        key: "amount",
        label: t("ledger.columns.amount"),
        align: "right" as const,
        render: (row: LenderLedgerPageRow) => {
          const amountColorClass =
            row.type === "credit_purchase"
              ? "text-[var(--color-warning-text)]"
              : "text-[var(--color-success)]";
          return (
            <span className={`text-sm font-medium ${amountColorClass}`}>
              {formatDecimal(row.amount)}
            </span>
          );
        },
      },
    ],
    [onOpenInvoice, t]
  );

  return (
    <DataTable<LenderLedgerPageRow>
      columns={columns}
      data={rows}
      scrollMaxHeight={scrollMaxHeight}
      pagination={pagination}
      getRowKey={(r) => `${r.type}-${r.id}`}
      tableClassName="min-w-full divide-y divide-[var(--color-border-default)]"
      rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
      alwaysShowRowActions
      extraActions={(row) => (
        <span className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEditRow(row)}
            className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
            title={t("common.edit")}
            aria-label={t("common.edit")}
          >
            <Pencil size={20} />
          </button>
          <button
            type="button"
            onClick={() => onDeleteRow(row)}
            className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
            title={t("common.delete")}
            aria-label={t("common.delete")}
          >
            <Trash2 size={20} />
          </button>
        </span>
      )}
    />
  );
}
