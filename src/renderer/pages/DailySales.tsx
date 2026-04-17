import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import Button from "../components/Button";
import { PAGE_SIZE } from "../../shared/constants";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import {
  exportDailySalesToCsv,
  exportDailySalesToPdf,
  getPrintTableBody,
} from "../lib/exportDailySales";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import {
  Download,
  Check,
  FileDown,
  FileText,
  Printer,
  Plus,
  X,
} from "lucide-react";
import type { DailySale } from "../../shared/types";
import {
  formatDecimal,
  formatAbbreviatedInteger,
  formatAbbreviatedRupee,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { useAuth } from "../context/AuthContext";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  SalesListHero,
  SalesListSectionPanel,
  SalesListAsyncPanel,
} from "../components/sales-list-page";

export default function DailySales() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const { authState } = useAuth();
  const currentUser = authState.status === "unlocked" ? authState.user : null;
  const location = useLocation();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const appName = getAppDisplayName(settings);
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DailySale | null>(null);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [addSaleDate, setAddSaleDate] = useState(todayISO());
  const [editSaleDate, setEditSaleDate] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    columns: string[];
    rows: string[][];
    filterDetails?: { label: string; value: string }[];
  } | null>(null);
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<DailySale | null>(
    null
  );

  const {
    refs: exportRefs,
    floatingStyles: exportFloatingStyles,
    context: exportContext,
  } = useFloating({
    open: exportOpen,
    onOpenChange: setExportOpen,
    placement: "bottom-end",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const exportClick = useClick(exportContext);
  const exportDismiss = useDismiss(exportContext, {
    escapeKey: true,
    outsidePress: true,
  });
  const {
    getReferenceProps: getExportRefProps,
    getFloatingProps: getExportFloatingProps,
  } = useInteractions([exportClick, exportDismiss]);

  useEffect(() => {
    const state = location.state as {
      dateFrom?: string;
      dateTo?: string;
    } | null;
    if (state?.dateFrom) setFromDate(state.dateFrom);
    if (state?.dateTo) setToDate(state.dateTo);
  }, [location.state]);

  const { data: invoiceTotalForDate } = useQuery({
    queryKey: ["invoiceTotalForDate", addSaleDate],
    queryFn: () =>
      api.getInvoiceTotalForDate(addSaleDate) as Promise<{ total: number }>,
    enabled: addOpen && !!addSaleDate,
  });

  useEffect(() => {
    if (addOpen) queueMicrotask(() => setAddSaleDate(todayISO()));
  }, [addOpen]);
  useEffect(() => {
    if (editing) queueMicrotask(() => setEditSaleDate(editing.sale_date));
  }, [editing]);

  const {
    data: pageResult,
    isLoading,
    isError: salesPageError,
    refetch: refetchDailySalesPage,
  } = useQuery({
    queryKey: [
      "dailySalesPage",
      fromDate || undefined,
      toDate || undefined,
      page,
    ],
    queryFn: () =>
      api.getDailySalesPage({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: DailySale[]; total: number }>,
  });
  const sales = pageResult?.data ?? [];
  const totalSales = pageResult?.total ?? 0;
  const pageSaleAmountSum = useMemo(
    () =>
      sales.reduce(
        (sum, row) =>
          sum + (Number.isFinite(row.sale_amount) ? row.sale_amount : 0),
        0
      ),
    [sales]
  );

  const createSale = useMutation({
    mutationFn: (s: {
      sale_date: string;
      misc_sales?: number;
      cash_in_hand: number;
      expenditure_amount?: number;
      notes?: string;
    }) => api.createDailySale({ ...s, _userId: currentUser?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      setAddOpen(false);
    },
  });

  const updateSale = useMutation({
    mutationFn: ({
      id,
      s,
    }: {
      id: number;
      s: {
        sale_date?: string;
        misc_sales?: number;
        cash_in_hand?: number;
        expenditure_amount?: number;
        notes?: string;
      };
    }) => api.updateDailySale(id, { ...s, _userId: currentUser?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      setEditing(null);
    },
  });

  const deleteSale = useMutation({
    mutationFn: (id: number) => api.deleteDailySale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
    },
  });

  const appliedFilters = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (fromDate) list.push({ label: "From Date", value: fromDate });
    if (toDate) list.push({ label: "To Date", value: toDate });
    return list;
  }, [fromDate, toDate]);

  async function getExportData(): Promise<DailySale[]> {
    const data = (await api.getDailySales(
      fromDate || undefined,
      toDate || undefined
    )) as DailySale[];
    return data ?? [];
  }

  async function handleExportCsv() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportDailySalesToCsv(data, appliedFilters);
    toast.success("Exported as CSV.");
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportDailySalesToPdf(data, appliedFilters, appName);
    toast.success("Exported as PDF.");
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    setPrintData(getPrintTableBody(data, appliedFilters));
  }

  useEffect(() => {
    if (!printData) return;
    const previousTitle = document.title;
    document.title = `Daily_Sales_${formatDateForFile(new Date())}`;
    const onAfterPrint = () => {
      document.title = previousTitle;
      setPrintData(null);
    };
    globalThis.addEventListener("afterprint", onAfterPrint);
    const timeoutId = setTimeout(() => globalThis.print(), 100);
    return () => {
      clearTimeout(timeoutId);
      document.title = previousTitle;
      globalThis.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printData]);

  const clearDateFilters = useCallback(() => {
    setFromDate("");
    setToDate("");
    setPage(1);
  }, []);

  const dailySalesHeroMetrics = useMemo(
    () => [
      {
        label: "Matching days",
        displayValue: formatAbbreviatedInteger(totalSales, abbreviationStyle),
      },
      {
        label: "On this page",
        displayValue: formatAbbreviatedInteger(sales.length, abbreviationStyle),
      },
      {
        label: "Page total sale",
        displayValue: formatAbbreviatedRupee(
          pageSaleAmountSum,
          abbreviationStyle
        ),
      },
    ],
    [abbreviationStyle, pageSaleAmountSum, sales.length, totalSales]
  );

  const salesHasDateFilters = !!(fromDate || toDate);
  const isSalesEmpty = !isLoading && !salesPageError && sales.length === 0;

  const salesCountBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {formatAbbreviatedInteger(totalSales, abbreviationStyle)}
    </span>
  );

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <SalesListHero
        title="Daily Sales"
        metrics={dailySalesHeroMetrics}
        actions={
          <>
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <Button variant="secondary" type="button">
                <Download size={20} className="mr-1.5" aria-hidden="true" />
                Export
              </Button>
            </div>
            <FloatingPortal>
              {exportOpen && (
                <div
                  ref={exportRefs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
                  style={exportFloatingStyles}
                  {...getExportFloatingProps()}
                  className="z-50 min-w-[160px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-1 shadow-lg"
                >
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
                    onClick={handleExportCsv}
                  >
                    <FileDown size={16} className="shrink-0" />
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
                    onClick={handleExportPdf}
                  >
                    <FileDown size={16} className="shrink-0" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
                    onClick={handleExportPrint}
                  >
                    <Printer size={16} className="shrink-0" />
                    Print
                  </button>
                </div>
              )}
            </FloatingPortal>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              Add Sale
            </Button>
          </>
        }
      />
      <DashboardSectionBoundary
        sectionTitle="Daily sales list"
        containerClassName="dashboard-panel"
        resetKeys={[
          fromDate,
          toDate,
          page,
          isLoading,
          salesPageError,
          sales.length,
        ]}
      >
        <SalesListSectionPanel
          title="Daily totals"
          description="Each row is one calendar day: invoice totals, misc sales, cash in hand, and expenditure."
          badge={salesCountBadge}
        >
          <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-lg border border-[var(--color-border-default)] overflow-hidden">
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
              From
              <DateInput
                value={fromDate}
                onChange={(v) => {
                  setFromDate(v);
                  setPage(1);
                }}
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
              />
            </label>
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
              To
              <DateInput
                value={toDate}
                onChange={(v) => {
                  setToDate(v);
                  setPage(1);
                }}
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
              />
            </label>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X size={16} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          <div className="mt-4">
            <SalesListAsyncPanel
              isLoading={isLoading}
              isError={salesPageError}
              onRetry={() => {
                void refetchDailySalesPage();
              }}
              isEmpty={isSalesEmpty}
              emptyTitle={
                salesHasDateFilters
                  ? "No sales in this range"
                  : "No daily sales yet"
              }
              emptyDescription={
                salesHasDateFilters
                  ? "Try clearing the date filters or picking a wider range."
                  : "Add a sale for today or import history so this register stays in sync with your till and invoices."
              }
              emptyActionLabel={
                salesHasDateFilters ? "Clear date filters" : "Add sale"
              }
              onEmptyAction={
                salesHasDateFilters ? clearDateFilters : () => setAddOpen(true)
              }
              emptySecondaryLabel={salesHasDateFilters ? "Add sale" : undefined}
              onEmptySecondary={
                salesHasDateFilters ? () => setAddOpen(true) : undefined
              }
              loaderColumns={6}
            >
              <DataTable<DailySale>
                scrollMaxHeight={`calc(100vh - 20.5rem)`}
                columns={[
                  {
                    key: "sale_date",
                    label: "Date",
                    render: (r) => (
                      <Tooltip content={formatDateForForm(r.sale_date)}>
                        <span>{formatDateForView(r.sale_date)}</span>
                      </Tooltip>
                    ),
                  },
                  {
                    key: "sale_amount",
                    label: "Total Sale",
                    align: "right",
                    render: (r) => formatDecimal(r.sale_amount),
                  },
                  {
                    key: "invoice_sales",
                    label: "Invoice Sales",
                    align: "right",
                    render: (r) => formatDecimal(r.invoice_sales ?? 0),
                  },
                  {
                    key: "misc_sales",
                    label: "Misc / Cash Sales",
                    align: "right",
                    render: (r) => formatDecimal(r.misc_sales ?? 0),
                  },
                  {
                    key: "cash_in_hand",
                    label: "Cash in Hand",
                    align: "right",
                    render: (r) => formatDecimal(r.cash_in_hand),
                  },
                  {
                    key: "expenditure_amount",
                    label: "Expenditure",
                    align: "right",
                    render: (r) => formatDecimal(r.expenditure_amount ?? 0),
                  },
                ]}
                data={sales}
                onEdit={setEditing}
                onDelete={(row) => setDeleteConfirmSale(row)}
                extraActions={(row) => (
                  <Link
                    to="/invoices"
                    state={{ dateFrom: row.sale_date, dateTo: row.sale_date }}
                    className="p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] rounded transition-colors"
                    title="View invoices for this date"
                    aria-label="View invoices for this date"
                  >
                    <FileText size={20} />
                  </Link>
                )}
                emptyMessage="No sales yet. Click Add Sale or adjust filters."
                pagination={{
                  type: "controlled",
                  page,
                  total: totalSales,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </SalesListAsyncPanel>
          </div>
        </SalesListSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmSale != null}
        onClose={() => setDeleteConfirmSale(null)}
        title="Delete sale"
        message="Delete this sale?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmSale) deleteSale.mutate(deleteConfirmSale.id);
        }}
      />

      <FormModal
        title="Add Sale"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <Button type="submit" form="add-sale-form">
            <Check size={20} className="mr-1.5" aria-hidden="true" />
            Save
          </Button>
        }
      >
        <form
          id="add-sale-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            if (!addSaleDate) return;
            createSale.mutate({
              sale_date: addSaleDate,
              misc_sales: Number(
                (form.misc_sales as HTMLInputElement).value || 0
              ),
              cash_in_hand: Number(
                (form.cash_in_hand as HTMLInputElement).value
              ),
              expenditure_amount:
                Number((form.expenditure_amount as HTMLInputElement).value) ||
                undefined,
              notes: (form.notes as HTMLInputElement).value || undefined,
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={addSaleDate}
              onChange={setAddSaleDate}
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
            {addSaleDate && (
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Invoice Sales for this date: ₹
                {formatDecimal(invoiceTotalForDate?.total ?? 0)} (from invoices)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Misc / Cash Sales (without invoice)
            </label>
            <input
              name="misc_sales"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full border rounded px-3 py-2"
              title="Sales not tied to an invoice (e.g. cash, small items)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Cash in Hand *
            </label>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
              Amount physically in your till at end of day
            </p>
            <input
              name="cash_in_hand"
              type="number"
              min="0"
              step="0.01"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Expenditure (if any)
            </label>
            <input
              name="expenditure_amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Notes
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Sale"
        open={!!editing}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <Button type="submit" form="edit-sale-form">
              <Check size={20} className="mr-1.5" aria-hidden="true" />
              Update
            </Button>
          ) : null
        }
      >
        {editing && (
          <form
            id="edit-sale-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              if (!editSaleDate) return;
              updateSale.mutate({
                id: editing.id,
                s: {
                  sale_date: editSaleDate,
                  misc_sales: Number(
                    (form.misc_sales as HTMLInputElement).value || 0
                  ),
                  cash_in_hand: Number(
                    (form.cash_in_hand as HTMLInputElement).value
                  ),
                  expenditure_amount:
                    Number(
                      (form.expenditure_amount as HTMLInputElement).value
                    ) || undefined,
                  notes: (form.notes as HTMLInputElement).value || undefined,
                },
              });
            }}
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editSaleDate}
                onChange={setEditSaleDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Invoice Sales (read-only)
              </label>
              <input
                type="text"
                value={formatDecimal(editing.invoice_sales ?? 0)}
                readOnly
                disabled
                className="w-full border rounded px-3 py-2 bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Misc / Cash Sales (without invoice) *
              </label>
              <input
                name="misc_sales"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.misc_sales ?? 0}
                className="w-full border rounded px-3 py-2"
                title="Sales not tied to an invoice (e.g. cash, small items)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Cash in Hand *
              </label>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
                Amount physically in your till at end of day
              </p>
              <input
                name="cash_in_hand"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.cash_in_hand}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Expenditure
              </label>
              <input
                name="expenditure_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.expenditure_amount ?? 0}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Notes
              </label>
              <input
                name="notes"
                defaultValue={editing.notes ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </form>
        )}
      </FormModal>

      {printData && (
        <div
          className="app-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-[var(--color-bg-surface)] p-6 print:block"
          aria-hidden
        >
          <header className="mb-4 border-b border-[var(--color-border-default)] pb-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {appName}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Daily Sales
            </p>
            {printData.filterDetails != null &&
              printData.filterDetails.length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium text-[var(--color-text-secondary)]">
                    Applied filters
                  </p>
                  {printData.filterDetails.map((f) => (
                    <p
                      key={f.label}
                      className="text-[var(--color-text-secondary)]"
                    >
                      {f.label}: {f.value}
                    </p>
                  ))}
                </div>
              )}
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {new Date().toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </header>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {printData.columns.map((col) => (
                  <th
                    key={col}
                    className="border border-[var(--color-border-strong)] px-2 py-1.5 text-left font-medium text-white bg-[var(--color-text-secondary)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printData.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, ci) => (
                    <td
                      key={`${row[0]}-${printData.columns[ci]}`}
                      className="border border-[var(--color-border-strong)] px-2 py-1.5 text-[var(--color-text-primary)]"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
