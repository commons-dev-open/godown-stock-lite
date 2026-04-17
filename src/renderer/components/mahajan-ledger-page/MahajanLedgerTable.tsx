import Tooltip from "../Tooltip";
import TransactionTypeBadge, {
  type TransactionType,
} from "../TransactionTypeBadge";
import LedgerRowActions from "../LedgerRowActions";
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
}

export function MahajanLedgerTable({
  rows,
  onOpenInvoice,
  onEditRow,
  onDeleteRow,
}: Readonly<MahajanLedgerTableProps>) {
  return (
    <div className="table-scroll-wrap overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--color-border-default)]">
        <thead className="bg-[var(--color-bg-surface-raised)]">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Date
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Type
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Description
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Amount
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-[var(--color-text-secondary)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-default)]">
          {rows.map((row) => {
            const amountColorClass =
              row.type === "credit_purchase"
                ? "text-[var(--color-warning-text)]"
                : "text-[var(--color-success)]";
            const description = ledgerDescriptionFromPageRow(row);
            return (
              <tr
                key={`${row.type}-${row.id}`}
                className="hover:bg-[var(--color-bg-surface-raised)]"
              >
                <td className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
                  <Tooltip content={formatDateForForm(row.transaction_date)}>
                    <span>{formatDateForView(row.transaction_date)}</span>
                  </Tooltip>
                </td>
                <td className="px-4 py-2 text-sm">
                  <TransactionTypeBadge
                    type={row.type as TransactionType | "lend" | "deposit"}
                  />
                </td>
                <td className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
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
                              <span title="Lender invoice">#{invNum}</span>
                            )}
                            {invPath && (
                              <button
                                type="button"
                                onClick={() => onOpenInvoice(invPath)}
                                className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                              >
                                View invoice
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
                </td>
                <td
                  className={`px-4 py-2 text-right text-sm font-medium ${amountColorClass}`}
                >
                  {formatDecimal(row.amount)}
                </td>
                <LedgerRowActions
                  type={
                    row.type as
                      | "credit_purchase"
                      | "settlement"
                      | "cash_purchase"
                  }
                  onEdit={() => {
                    onEditRow(row);
                  }}
                  onDelete={() => {
                    onDeleteRow(row);
                  }}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
