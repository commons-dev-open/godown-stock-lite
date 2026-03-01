import { useState, useEffect, useMemo } from "react";
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
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import TableLoader from "../components/TableLoader";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
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
  ArrowDownTrayIcon,
  CheckIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { DailySale } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

export default function DailySales() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const appName = getAppDisplayName(settings);
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
    if (addOpen) queueMicrotask(() => setAddSaleDate(todayISO()));
  }, [addOpen]);
  useEffect(() => {
    if (editing) queueMicrotask(() => setEditSaleDate(editing.sale_date));
  }, [editing]);

  const { data: pageResult, isLoading } = useQuery({
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

  const createSale = useMutation({
    mutationFn: (s: {
      sale_date: string;
      sale_amount: number;
      cash_in_hand: number;
      expenditure_amount?: number;
      notes?: string;
    }) => api.createDailySale(s),
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
        sale_amount?: number;
        cash_in_hand?: number;
        expenditure_amount?: number;
        notes?: string;
      };
    }) => api.updateDailySale(id, s),
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

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Daily Sales</h1>
          <div className="flex items-center gap-2">
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <Button variant="secondary" type="button">
                <ArrowDownTrayIcon className="w-5 h-5 mr-1.5" aria-hidden />
                Export
              </Button>
            </div>
            <FloatingPortal>
              {exportOpen && (
                <div
                  ref={exportRefs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
                  style={exportFloatingStyles}
                  {...getExportFloatingProps()}
                  className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportCsv}
                  >
                    <DocumentArrowDownIcon className="w-4 h-4 shrink-0" />
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportPdf}
                  >
                    <DocumentArrowDownIcon className="w-4 h-4 shrink-0" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportPrint}
                  >
                    <PrinterIcon className="w-4 h-4 shrink-0" />
                    Print
                  </button>
                </div>
              )}
            </FloatingPortal>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add Sale
            </Button>
          </div>
        </div>
        <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
            From
            <DateInput
              value={fromDate}
              onChange={(v) => {
                setFromDate(v);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </label>
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
            To
            <DateInput
              value={toDate}
              onChange={(v) => {
                setToDate(v);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
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
              className="inline-flex items-center gap-1 shrink-0 text-sm text-gray-600 hover:text-gray-900"
            >
              <XMarkIcon className="w-4 h-4" aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : sales.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <DataTable<DailySale>
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
                  label: "Sale Amount",
                  render: (r) => formatDecimal(r.sale_amount),
                },
                {
                  key: "cash_in_hand",
                  label: "Cash in Hand",
                  render: (r) => formatDecimal(r.cash_in_hand),
                },
                {
                  key: "expenditure_amount",
                  label: "Expenditure",
                  render: (r) => formatDecimal(r.expenditure_amount ?? 0),
                },
              ]}
              data={sales}
              onEdit={setEditing}
              onDelete={(row) => {
                if (globalThis.confirm("Delete this sale?"))
                  deleteSale.mutate(row.id);
              }}
              emptyMessage="No sales yet. Click Add Sale or adjust filters."
            />
            <Pagination
              page={page}
              total={totalSales}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Add Sale"
        open={addOpen}
        onClose={() => setAddOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            if (!addSaleDate) return;
            createSale.mutate({
              sale_date: addSaleDate,
              sale_amount: Number((form.sale_amount as HTMLInputElement).value),
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={addSaleDate}
              onChange={setAddSaleDate}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sale Amount *
            </label>
            <input
              name="sale_amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cash in Hand *
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddOpen(false)}
            >
              <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Cancel
            </Button>
            <Button type="submit">
              <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Save
            </Button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Sale"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              if (!editSaleDate) return;
              updateSale.mutate({
                id: editing.id,
                s: {
                  sale_date: editSaleDate,
                  sale_amount: Number(
                    (form.sale_amount as HTMLInputElement).value
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editSaleDate}
                onChange={setEditSaleDate}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Amount *
              </label>
              <input
                name="sale_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.sale_amount}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash in Hand *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                name="notes"
                defaultValue={editing.notes ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
              >
                <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
                Cancel
              </Button>
              <Button type="submit">
                <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
                Update
              </Button>
            </div>
          </form>
        )}
      </FormModal>

      {printData && (
        <div
          className="app-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-white p-6 print:block"
          aria-hidden
        >
          <header className="mb-4 border-b border-gray-200 pb-3">
            <p className="text-sm font-semibold text-gray-900">{appName}</p>
            <p className="text-xs text-gray-600">Daily Sales</p>
            {printData.filterDetails != null &&
              printData.filterDetails.length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium text-gray-700">Applied filters</p>
                  {printData.filterDetails.map((f) => (
                    <p key={f.label} className="text-gray-600">
                      {f.label}: {f.value}
                    </p>
                  ))}
                </div>
              )}
            <p className="mt-1 text-xs text-gray-500">
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
                    className="border border-gray-300 px-2 py-1.5 text-left font-medium text-white bg-gray-700"
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
                      className="border border-gray-300 px-2 py-1.5 text-gray-800"
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
