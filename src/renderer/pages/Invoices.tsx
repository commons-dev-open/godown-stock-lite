import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import SearchFilterBar from "../components/SearchFilterBar";
import TableLoader from "../components/TableLoader";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import toast from "react-hot-toast";
import { exportInvoiceToPdf } from "../lib/exportInvoice";
import { computeProductUnits } from "../../shared/computeProductUnits";
import { amountInWords, computeLineGst } from "../../shared/gst";
import {
  computeLineWithDiscounts,
  computeOrderDiscounts,
  roundToWholeIfEnabled,
} from "../../shared/discounts";
import type {
  Invoice,
  InvoiceLine,
  Item,
  Unit,
  UnitConversion,
} from "../../shared/types";
import DateInput from "../components/DateInput";
import { formatBillDateTime, formatDateForFile } from "../lib/exportUtils";
import { formatDecimal, roundDecimal } from "../../shared/numbers";
import {
  Check,
  FileDown,
  Eye,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";

type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

type InvoiceRow = Invoice & { total?: number };

type PriceMode = "per_unit" | "total";

const GST_SLABS = [0, 5, 12, 18, 28] as const;

type LineRow = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  priceUnit: string;
  price: number;
  priceMode: PriceMode;
  totalInput?: string;
  amount?: number;
  gst_rate: number;
  gst_inclusive: boolean;
  hsn_code?: string | null;
  line_discount_percent?: number;
  line_discount_flat?: number;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  bogo_discount_percent?: number;
  _key?: number;
  id?: number;
};

const DEFAULT_LINE_ROW: LineRow = {
  product_id: 0,
  product_name: "",
  quantity: 0,
  unit: "",
  priceUnit: "",
  price: 0,
  priceMode: "per_unit",
  gst_rate: 0,
  gst_inclusive: false,
};

/** Payload line sent to API. */
type LinePayload = Omit<
  LineRow,
  "priceMode" | "totalInput" | "priceUnit"
> & {
  amount: number;
  price_entered_as: PriceMode;
  price_unit?: string | null;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
};

/** Resolve unit name to short display (symbol); falls back to name if no match. */
function unitToShort(unitName: string, units: Unit[]): string {
  if (!unitName) return unitName;
  const u = units.find((x) => x.name === unitName);
  const short = u?.symbol?.trim();
  return short ?? unitName;
}

/**
 * Returns the factor to convert 1 unit of `from` into `to` units.
 * E.g. from="gram", to="kg" → 0.001
 * Falls back to 1 if no path is found.
 */
function getConversionFactor(
  from: string,
  to: string,
  primaryUnit: string | undefined,
  itemConversions: { to_unit: string; factor: number }[],
  globalConversions: UnitConversion[]
): number {
  if (!from || !to || from === to) return 1;
  type Edge = { to: string; factor: number };
  const graph = new Map<string, Edge[]>();
  const addEdge = (a: string, b: string, f: number) => {
    if (!a || !b || !Number.isFinite(f) || f <= 0) return;
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a)!.push({ to: b, factor: f });
    graph.get(b)!.push({ to: a, factor: 1 / f });
  };
  for (const row of globalConversions)
    addEdge(row.from_unit, row.to_unit, row.factor);
  if (primaryUnit) {
    for (const row of itemConversions)
      addEdge(primaryUnit, row.to_unit, row.factor);
  }
  // BFS
  const visited = new Map<string, number>();
  visited.set(from, 1);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const { to: next, factor } of graph.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.set(next, visited.get(cur)! * factor);
        queue.push(next);
      }
    }
  }
  return visited.get(to) ?? 1;
}

/** Display value for line total input (Total mode). */
function getLineTotalDisplay(line: LineRow): string {
  if (line.totalInput !== undefined) return line.totalInput;
  const amt =
    line.amount ?? (line.quantity > 0 ? line.quantity * line.price : 0);
  return amt > 0 ? formatDecimal(amt) : "";
}

const ViewInvoiceContent = memo(function ViewInvoiceContent({
  invoice,
  isPrint,
  invoiceUnits = [],
  settings = {},
}: {
  invoice: InvoiceWithLines;
  isPrint?: boolean;
  invoiceUnits?: Unit[];
  settings?: Record<string, string>;
}) {
  const total = invoice.lines.reduce(
    (s, l) => s + (l.amount ?? l.quantity * l.price),
    0
  );
  const gstEnabled = settings.gst_enabled === "true";
  const anyLineHasGst = invoice.lines.some((l) => (l.gst_rate ?? 0) > 0);
  const useGstLayout = gstEnabled && anyLineHasGst;
  const hsnEnabled = settings.hsn_enabled !== "false";
  const hasHsn =
    hsnEnabled && invoice.lines.some((l) => l.hsn_code?.trim());
  const taxableTotal = useGstLayout
    ? invoice.lines.reduce((s, l) => s + (l.taxable_amount ?? l.amount ?? 0), 0)
    : 0;
  const cgstTotal = useGstLayout
    ? invoice.lines.reduce((s, l) => s + (l.cgst_amount ?? 0), 0)
    : 0;
  const sgstTotal = useGstLayout
    ? invoice.lines.reduce((s, l) => s + (l.sgst_amount ?? 0), 0)
    : 0;

  return (
    <div className={isPrint ? "text-sm invoice-view-content" : ""}>
      <div
        className={
          isPrint
            ? "grid grid-cols-2 gap-0.5 mb-1"
            : "grid grid-cols-2 gap-2 mb-4"
        }
      >
        {invoice.invoice_number && (
          <div>
            <span className="font-medium">Invoice #:</span>{" "}
            {invoice.invoice_number}
          </div>
        )}
        {gstEnabled && settings.place_of_supply?.trim() && (
          <div className="col-span-2">
            <span className="font-medium">Place of Supply:</span>{" "}
            {settings.place_of_supply.trim()}
          </div>
        )}
        <div className="col-span-2">
          <span className="font-medium">Date:</span>{" "}
          {formatBillDateTime(new Date())}
        </div>
        {invoice.customer_phone && (
          <div className="col-span-2">
            <span className="font-medium">Phone:</span> {invoice.customer_phone}
          </div>
        )}
        {invoice.customer_name && (
          <div className="col-span-2">
            <span className="font-medium">Customer:</span>{" "}
            {invoice.customer_name}
          </div>
        )}
        {invoice.customer_address && (
          <div className="col-span-2">
            <span className="font-medium">Address:</span>{" "}
            {invoice.customer_address}
          </div>
        )}
      </div>
      <table className="w-full border-collapse border border-[var(--color-border-strong)]">
        <thead>
          <tr className="bg-[var(--color-bg-surface-raised)]">
            {useGstLayout && hasHsn && (
              <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">
                HSN
              </th>
            )}
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">
              Product
            </th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">Qty</th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">Unit</th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
              Rate/unit
            </th>
            {useGstLayout && (
              <>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  Taxable
                </th>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  CGST
                </th>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  SGST
                </th>
              </>
            )}
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => {
            const amount = line.amount ?? line.quantity * line.price;
            const gstRate = line.gst_rate ?? 0;
            const taxable = line.taxable_amount ?? amount;
            const cgst = line.cgst_amount ?? 0;
            const sgst = line.sgst_amount ?? 0;
            return (
              <tr key={line.id}>
                {useGstLayout && hasHsn && (
                  <td className="border border-[var(--color-border-strong)] px-2 py-1">
                    {line.hsn_code ?? ""}
                  </td>
                )}
                <td className="border border-[var(--color-border-strong)] px-2 py-1">
                  {line.product_name ?? ""}
                </td>
                <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  {formatDecimal(line.quantity)}
                </td>
                <td className="border border-[var(--color-border-strong)] px-2 py-1">
                  {unitToShort(line.unit, invoiceUnits)}
                </td>
                <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  ₹{formatDecimal(line.price)}/
                  {unitToShort(
                    (line as { price_unit?: string | null }).price_unit ??
                      line.unit,
                    invoiceUnits
                  )}
                  {useGstLayout && gstRate > 0 && ` (${gstRate}%)`}
                </td>
                {useGstLayout && (
                  <>
                    <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                      ₹{formatDecimal(taxable)}
                    </td>
                    <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                      ₹{formatDecimal(cgst)}
                    </td>
                    <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                      ₹{formatDecimal(sgst)}
                    </td>
                  </>
                )}
                <td className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  ₹{formatDecimal(amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(isPrint || useGstLayout) && (
        <div className="mt-2 space-y-0.5">
          {useGstLayout && (
            <>
              <div className="text-sm">
                Taxable Amount: ₹{formatDecimal(taxableTotal)}
              </div>
              <div className="text-sm">CGST: ₹{formatDecimal(cgstTotal)}</div>
              <div className="text-sm">SGST: ₹{formatDecimal(sgstTotal)}</div>
            </>
          )}
          <div className="font-medium">
            {useGstLayout ? "Grand Total: " : "Total: "}₹{formatDecimal(total)}
          </div>
          {useGstLayout && (
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">
              {amountInWords(total)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function Invoices() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceWithLines | null>(null);
  const [viewing, setViewing] = useState<InvoiceWithLines | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const location = useLocation();

  useEffect(() => {
    const state = location.state as {
      dateFrom?: string;
      dateTo?: string;
    } | null;
    if (state?.dateFrom) setDateFrom(state.dateFrom); // eslint-disable-line react-hooks/set-state-in-effect -- sync nav state to form
    if (state?.dateTo) setDateTo(state.dateTo); // eslint-disable-line react-hooks/set-state-in-effect -- sync nav state to form
  }, [location.state]);
  const [printData, setPrintData] = useState<InvoiceWithLines | null>(null);
  const [deleteConfirmInvoiceId, setDeleteConfirmInvoiceId] = useState<
    number | null
  >(null);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems() as Promise<Item[]>,
  });

  const { data: itemsWithUnits } = useQuery({
    queryKey: ["itemsWithUnits"],
    queryFn: () =>
      api.getItemsWithUnits() as Promise<
        (Item & {
          other_units: { unit: string; sort_order: number }[];
          item_unit_conversions: { to_unit: string; factor: number }[];
        })[]
      >,
    enabled: createOpen || !!editing,
  });

  const { data: allUnits = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions() as Promise<UnitConversion[]>,
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  const { data: pageResult, isLoading } = useQuery({
    queryKey: ["invoicesPage", search, dateFrom, dateTo, page],
    queryFn: () =>
      api.getInvoicesPage({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: InvoiceRow[]; total: number }>,
  });
  const invoicesPage = pageResult?.data ?? [];
  const totalInvoices = pageResult?.total ?? 0;

  const createInvoice = useMutationWithToast({
    mutationFn: (payload: {
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_address?: string | null;
      invoice_date: string;
      notes?: string | null;
      order_discount_amount?: number;
      round_to_whole?: boolean;
      coupon_code?: string | null;
      lines: LinePayload[];
    }) => api.createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setCreateOpen(false);
    },
  });

  const updateInvoice = useMutationWithToast({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        invoice_number?: string | null;
        customer_name?: string | null;
        customer_address?: string | null;
        invoice_date: string;
        notes?: string | null;
        order_discount_amount?: number;
        round_to_whole?: boolean;
        coupon_code?: string | null;
        lines: LinePayload[];
      };
    }) => api.updateInvoice(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setEditing(null);
    },
  });

  const deleteInvoice = useMutationWithToast({
    mutationFn: (id: number) => api.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setViewing(null);
    },
  });

  const fetchAndView = useCallback(
    async (id: number) => {
      const full = (await api.getInvoiceById(id)) as InvoiceWithLines;
      setViewing(full);
    },
    [api]
  );

  const fetchAndEdit = useCallback(
    async (id: number) => {
      const full = (await api.getInvoiceById(id)) as InvoiceWithLines;
      setEditing(full);
    },
    [api]
  );

  const tableColumns = useMemo(
    () => [
      {
        key: "invoice_number" as const,
        label: "Invoice #",
        render: (r: InvoiceRow) => r.invoice_number ?? "—",
      },
      { key: "invoice_date" as const, label: "Date" },
      {
        key: "customer_name" as const,
        label: "Customer",
        render: (r: InvoiceRow) => r.customer_name ?? "—",
      },
      {
        key: "total" as const,
        label: "Total",
        render: (r: InvoiceRow) =>
          r.total != null && r.total > 0 ? `₹${formatDecimal(r.total)}` : "—",
      },
      {
        key: "actions" as const,
        label: "Actions",
        render: (r: InvoiceRow) => (
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded transition-colors shrink-0"
              title="View"
              onClick={() => fetchAndView(r.id)}
              aria-label="View invoice"
            >
              <Eye size={20} />
            </button>
            <button
              type="button"
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded transition-colors"
              title="Edit"
              onClick={() => fetchAndEdit(r.id)}
              aria-label="Edit invoice"
            >
              <Pencil size={20} />
            </button>
            <button
              type="button"
              className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded transition-colors"
              title="Delete"
              onClick={() => setDeleteConfirmInvoiceId(r.id)}
              aria-label="Delete invoice"
            >
              <Trash2 size={20} />
            </button>
          </span>
        ),
      },
    ],
    [fetchAndView, fetchAndEdit]
  );

  useEffect(() => {
    if (!printData) return;
    const previousTitle = document.title;
    const invNum = (printData.invoice_number ?? `INV-${printData.id}`)
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "_");
    const customer = (printData.customer_name ?? "")
      .trim()
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "_");
    const base = customer
      ? `Invoice_${invNum}_${customer}`
      : `Invoice_${invNum}`;
    document.title = `${base}_${formatDateForFile(new Date())}`;
    const onAfterPrint = () => {
      document.title = previousTitle;
      setPrintData(null);
    };
    globalThis.addEventListener("afterprint", onAfterPrint);
    const t = setTimeout(() => globalThis.print(), 100);
    return () => {
      clearTimeout(t);
      document.title = previousTitle;
      globalThis.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printData]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 bg-[var(--color-bg-app)] pt-6 pb-3 -mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Invoices</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={20} className="mr-1.5" aria-hidden="true" />
          Create Invoice
        </Button>
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search by invoice # or customer..."
        hasActiveFilters={!!(search || dateFrom || dateTo)}
        onClearFilters={
          search || dateFrom || dateTo
            ? () => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }
            : undefined
        }
        rightContent={
          <>
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
              From
              <DateInput
                value={dateFrom}
                onChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
              />
            </label>
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
              To
              <DateInput
                value={dateTo}
                onChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
              />
            </label>
          </>
        }
      />

      {isLoading ? (
        <TableLoader />
      ) : invoicesPage.length === 0 ? (
        <EmptyState
          message="No invoices yet."
          actionLabel="Create Invoice"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <DataTable<InvoiceRow>
            columns={tableColumns}
            data={invoicesPage}
            emptyMessage="No invoices."
          />
          <Pagination
            page={page}
            total={totalInvoices}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmModal
        open={deleteConfirmInvoiceId != null}
        onClose={() => setDeleteConfirmInvoiceId(null)}
        title="Delete invoice"
        message="Delete this invoice?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmInvoiceId != null)
            deleteInvoice.mutate(deleteConfirmInvoiceId);
        }}
      />

      {/* Create Invoice modal */}
      <InvoiceFormModal
        key={`${createOpen}-new`}
        open={createOpen}
        title="Create Invoice"
        onClose={() => setCreateOpen(false)}
        items={itemsWithUnits ?? items}
        units={allUnits}
        unitConversions={unitConversions}
        settings={settings}
        onSubmit={(payload, opts) =>
          createInvoice.mutate(payload, {
            onSuccess: (newId: number) => {
              if (opts?.incrementCoupon) {
                api.incrementCouponUsed(opts.incrementCoupon);
              }
              if (opts?.print) {
                void api.getInvoiceById(newId).then((full) => {
                  setPrintData(full as InvoiceWithLines);
                });
              }
            },
          })
        }
        isPending={createInvoice.isPending}
      />

      {/* Edit Invoice modal */}
      {editing && (
        <InvoiceFormModal
          key={`edit-${editing.id}`}
          open={!!editing}
          title="Edit Invoice"
          invoice={editing}
          onClose={() => setEditing(null)}
          items={itemsWithUnits ?? items}
          units={allUnits}
          unitConversions={unitConversions}
          settings={settings}
          onSubmit={(payload, opts) =>
            updateInvoice.mutate(
              { id: editing.id, payload },
              {
                onSuccess: () => {
                  if (opts?.incrementCoupon) {
                    api.incrementCouponUsed(opts.incrementCoupon);
                  }
                  if (opts?.print) {
                    void api.getInvoiceById(editing.id).then((full) => {
                      setPrintData(full as InvoiceWithLines);
                    });
                  }
                },
              }
            )
          }
          isPending={updateInvoice.isPending}
        />
      )}

      {/* View Invoice modal */}
      {viewing && (
        <FormModal
          title={`Invoice ${viewing.invoice_number ?? viewing.id}`}
          open={!!viewing}
          onClose={() => setViewing(null)}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex w-full items-center justify-between gap-4 flex-wrap">
              <span className="font-medium text-[var(--color-text-primary)]">
                Total: ₹
                {formatDecimal(
                  viewing.lines.reduce(
                    (s, l) => s + (l.amount ?? l.quantity * l.price),
                    0
                  ) - (viewing.order_discount_amount ?? 0)
                )}
              </span>
              <div className="flex gap-2 items-center">
                <Link
                  to="/sales"
                  state={{
                    dateFrom: viewing.invoice_date,
                    dateTo: viewing.invoice_date,
                  }}
                  className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                >
                  View daily sale for this date
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      exportInvoiceToPdf(
                        viewing,
                        viewing.lines,
                        settings,
                        allUnits
                      );
                      toast.success("Exported as PDF.");
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to export PDF."
                      );
                    }
                  }}
                >
                  <FileDown size={20} className="mr-1.5" aria-hidden="true" />
                  Export PDF
                </Button>
                <Button onClick={() => setPrintData(viewing)}>
                  <Printer size={20} className="mr-1.5" aria-hidden="true" />
                  Print
                </Button>
              </div>
            </div>
          }
        >
          <ViewInvoiceContent
            invoice={viewing}
            invoiceUnits={allUnits}
            settings={settings}
          />
        </FormModal>
      )}

      {printData && (
        <div
          className="hidden print:block invoice-print-container"
          id="invoice-print"
        >
          <div className="invoice-print-header">
            {settings?.company_name?.trim() && (
              <div className="font-semibold text-[150%] mb-1">
                {settings.company_name.trim()}
              </div>
            )}
            {settings?.company_address?.trim() && (
              <div className="text-[var(--color-text-secondary)]">
                {settings.company_address.trim()}
              </div>
            )}
            {settings?.owner_phone?.trim() && (
              <div>Phone: {settings.owner_phone.trim()}</div>
            )}
            {settings?.gstin?.trim() && (
              <div>GST No.: {settings.gstin.trim()}</div>
            )}
          </div>
          <ViewInvoiceContent
            invoice={printData}
            isPrint
            invoiceUnits={allUnits}
            settings={settings}
          />
        </div>
      )}
    </div>
  );
}

type ItemWithUnits = Item & {
  other_units?: { unit: string; sort_order: number }[];
  retail_primary_unit?: string | null;
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

function InvoiceFormModal({
  open,
  title,
  onClose,
  invoice,
  items,
  units: allUnits,
  unitConversions,
  settings = {},
  onSubmit,
  isPending,
}: Readonly<{
  open: boolean;
  title: string;
  onClose: () => void;
  invoice?: InvoiceWithLines | null;
  items: Item[] | ItemWithUnits[];
  units: Unit[];
  unitConversions: UnitConversion[];
  settings?: Record<string, string>;
  onSubmit: (
    payload: {
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_address?: string | null;
      customer_phone?: string | null;
      customer_gstin?: string | null;
      invoice_date: string;
      notes?: string | null;
      order_discount_amount?: number;
      round_to_whole?: boolean;
      coupon_code?: string | null;
      lines: Array<LinePayload>;
    },
    opts?: { print?: boolean; incrementCoupon?: string }
  ) => void;
  isPending: boolean;
}>) {
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => invoice?.invoice_number ?? ""
  );
  const [customerPhone, setCustomerPhone] = useState(
    () => invoice?.customer_phone ?? ""
  );
  const [customerName, setCustomerName] = useState(
    () => invoice?.customer_name ?? ""
  );
  const [customerAddress, setCustomerAddress] = useState(
    () => invoice?.customer_address ?? ""
  );
  const [invoiceDate, setInvoiceDate] = useState(() =>
    invoice
      ? invoice.invoice_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(() => invoice?.notes ?? "");
  const [customerGstin, setCustomerGstin] = useState(
    () =>
      (invoice as { customer_gstin?: string } | undefined)?.customer_gstin ?? ""
  );
  const [lines, setLines] = useState<LineRow[]>(() => {
    if (invoice?.lines?.length) {
      return invoice.lines.map((l) => {
        const priceEnteredAs = l.price_entered_as ?? "per_unit";
        const amount = l.amount ?? l.quantity * l.price;
        const line = l as {
          line_discount_percent?: number;
          line_discount_flat?: number;
          bogo_buy_qty?: number | null;
          bogo_get_qty?: number | null;
          bogo_discount_percent?: number;
        };
        return {
          id: l.id,
          product_id: l.product_id ?? 0,
          product_name: l.product_name ?? "",
          quantity: l.quantity,
          unit: l.unit,
          priceUnit: (l as { price_unit?: string | null }).price_unit ?? l.unit,
          price: l.price,
          amount,
          priceMode: priceEnteredAs,
          totalInput:
            priceEnteredAs === "total" && amount > 0
              ? formatDecimal(amount)
              : undefined,
          gst_rate: (l as { gst_rate?: number }).gst_rate ?? 0,
          gst_inclusive: Boolean(
            (l as { gst_inclusive?: boolean }).gst_inclusive
          ),
          hsn_code: (l as { hsn_code?: string | null }).hsn_code ?? null,
          line_discount_percent: line.line_discount_percent ?? 0,
          line_discount_flat: line.line_discount_flat ?? 0,
          bogo_buy_qty: line.bogo_buy_qty ?? null,
          bogo_get_qty: line.bogo_get_qty ?? null,
          bogo_discount_percent: (line.bogo_buy_qty && line.bogo_get_qty) ? (line.bogo_discount_percent ?? 100) : (line.bogo_discount_percent ?? undefined),
        };
      });
    }
    return [{ ...DEFAULT_LINE_ROW }];
  });

  const inv = invoice as { order_discount_amount?: number; round_to_whole?: number; coupon_code?: string } | undefined;
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(0);
  const [orderDiscountFlat, setOrderDiscountFlat] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    discount_type: "percent" | "flat";
    discount_value: number;
    code: string;
  } | null>(null);
  const [couponCodeInit, setCouponCodeInit] = useState(false);
  useEffect(() => {
    if (!couponCodeInit && inv?.coupon_code && open) {
      setCouponCodeInit(true);
      setCouponCode(inv.coupon_code);
      getElectron()
        .getCouponByCode(inv.coupon_code)
        .then((c) => {
          const row = c as {
            discount_type?: string;
            discount_value?: number;
            code?: string;
          } | null;
          if (row) {
            setAppliedCoupon({
              discount_type:
                (row.discount_type as "percent" | "flat") ?? "percent",
              discount_value: row.discount_value ?? 0,
              code: row.code ?? inv!.coupon_code!,
            });
          }
        });
    }
    if (!open) setCouponCodeInit(false);
  }, [open, inv?.coupon_code, couponCodeInit]);

  const getUnitsForLine = useCallback(
    (lineIdx: number): Unit[] => {
      const line = lines[lineIdx];
      if (!line?.product_id) return [];
      const item = items.find((i) => i.id === line.product_id) as
        | ItemWithUnits
        | undefined;
      if (!item) return [];

      const unitNames = computeProductUnits({
        primaryUnit: item.unit,
        retailPrimaryUnit: item.retail_primary_unit,
        otherUnits: item.other_units,
        itemConversions: item.item_unit_conversions ?? [],
        globalConversions: unitConversions,
        sortDirection: "asc",
        pinUnit: item.retail_primary_unit ?? item.unit,
      });

      return unitNames
        .map((name) => allUnits.find((u) => u.name === name))
        .filter((u): u is Unit => u != null);
    },
    [items, allUnits, unitConversions, lines]
  );

  const gstEnabled = settings.gst_enabled === "true";
  const gstDefaultMode = settings.gst_default_mode ?? "exclusive";
  const customerGstinEnabled = settings.customer_gstin_enabled === "true";
  const roundToWhole = settings.round_bill_to_whole === "true";
  const discountPctEnabled = settings.discount_percentage_enabled === "true";
  const discountFlatEnabled = settings.discount_flat_enabled === "true";
  const discountBogoEnabled = settings.discount_bogo_enabled === "true";
  const discountCouponEnabled = settings.discount_coupon_enabled === "true";
  const discountTieredEnabled = settings.discount_tiered_enabled === "true";

  const { data: tieredRules = [] } = useQuery({
    queryKey: ["tieredDiscountRules"],
    queryFn: () =>
      getElectron().getTieredDiscountRules() as Promise<
        { min_order_amount: number; discount_percent: number; discount_flat: number; max_discount_amount: number | null }[]
      >,
    enabled: open && discountTieredEnabled,
  });

  const lookupCustomerByPhone = useCallback(
    (phone: string) => {
      const trimmed = phone.trim();
      if (!trimmed) return;
      void getElectron()
        .getCustomerByPhone(trimmed)
        .then((customer) => {
          if (customer) {
            setCustomerName(customer.name ?? "");
            setCustomerAddress(customer.address ?? "");
            if (customerGstinEnabled) {
              setCustomerGstin(
                (customer as { gstin?: string | null }).gstin ?? ""
              );
            }
          }
        });
    },
    [customerGstinEnabled]
  );

  const handlePhoneBlur = useCallback(() => {
    lookupCustomerByPhone(customerPhone);
  }, [customerPhone, lookupCustomerByPhone]);

  useEffect(() => {
    if (!customerPhone.trim()) return;
    const t = setTimeout(() => lookupCustomerByPhone(customerPhone), 400);
    return () => clearTimeout(t);
  }, [customerPhone, lookupCustomerByPhone]);

  const getLineConvFactor = useCallback(
    (line: LineRow): number => {
      if (!line.unit || !line.priceUnit || line.unit === line.priceUnit)
        return 1;
      const item = items.find((i) => i.id === line.product_id) as
        | ItemWithUnits
        | undefined;
      return getConversionFactor(
        line.unit,
        line.priceUnit,
        item?.unit,
        item?.item_unit_conversions ?? [],
        unitConversions
      );
    },
    [items, unitConversions]
  );

  const handleProductChange = (idx: number, productId: number) => {
    const item = items.find((i) => i.id === productId) as
      | ItemWithUnits
      | undefined;
    const defaultUnit = item?.retail_primary_unit ?? item?.unit ?? "";
    const sellingPriceUnit =
      item?.selling_price_unit ??
      item?.retail_primary_unit ??
      item?.unit ??
      defaultUnit;
    const sellingPrice = item?.selling_price ?? 0;
    const itemGstRate = item?.gst_rate ?? 0;
    const itemHsn = item?.hsn_code ?? null;
    setLines((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              product_id: productId,
              product_name: item?.name ?? "",
              unit: defaultUnit,
              priceUnit: sellingPriceUnit,
              price: sellingPrice,
              gst_rate: itemGstRate,
              gst_inclusive: gstDefaultMode === "inclusive",
              hsn_code: itemHsn,
            }
          : p
      )
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validLines = lines.filter((l) => {
      if (l.product_id <= 0 || l.quantity <= 0) return false;
      if (l.priceMode === "per_unit") return l.price > 0;
      const amt =
        l.totalInput !== undefined && l.totalInput !== ""
          ? Number(l.totalInput)
          : (l.amount ?? l.quantity * l.price);
      return amt > 0;
    });
    if (validLines.length === 0) {
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const shouldPrint =
      (submitter as HTMLElement)?.getAttribute?.("data-action") === "print";
    const discSettings = {
      discount_percentage_enabled: settings.discount_percentage_enabled,
      discount_flat_enabled: settings.discount_flat_enabled,
      discount_bogo_enabled: settings.discount_bogo_enabled,
      discount_coupon_enabled: settings.discount_coupon_enabled,
      discount_tiered_enabled: settings.discount_tiered_enabled,
    };
    const linePayloads = validLines.map((l) => {
      let gross: number;
      let price: number;
      let priceUnit: string | null;
      const pricePerUnit =
        l.priceMode === "per_unit"
          ? l.price ?? 0
          : (l.totalInput && l.totalInput !== "" ? Number(l.totalInput) : l.amount ?? 0) /
            (l.quantity || 1);
      if (l.priceMode === "per_unit") {
        const conv = getLineConvFactor(l);
        gross = roundDecimal(l.quantity * conv * l.price, 2);
        price = roundDecimal(l.price, 4);
        priceUnit = l.priceUnit || null;
      } else {
        gross = roundDecimal(
          (l.totalInput !== undefined && l.totalInput !== ""
            ? Number(l.totalInput)
            : (l.amount ?? l.quantity * l.price)) || 0,
          2
        );
        price = l.quantity > 0 ? roundDecimal(gross / l.quantity, 4) : 0;
        priceUnit = l.unit ? l.unit : l.priceUnit || null;
      }
      const lineDiscResult = computeLineWithDiscounts(
        {
          gross,
          quantity: l.quantity,
          pricePerUnit,
          line_discount_percent: l.line_discount_percent ?? 0,
          line_discount_flat: l.line_discount_flat ?? 0,
          bogo_buy_qty: l.bogo_buy_qty ?? null,
          bogo_get_qty: l.bogo_get_qty ?? null,
          bogo_discount_percent: l.bogo_discount_percent ?? 100,
        },
        discSettings
      );
      const discountedGross = lineDiscResult.discountedGross;
      const gstResult = gstEnabled
        ? computeLineGst(discountedGross, l.gst_rate, l.gst_inclusive)
        : {
            taxable_amount: discountedGross,
            cgst_amount: 0,
            sgst_amount: 0,
            total_amount: discountedGross,
          };
      return {
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        unit: l.unit || "pcs",
        price,
        amount: roundDecimal(gstResult.total_amount, 2),
        price_entered_as: l.priceMode,
        price_unit: priceUnit,
        gst_rate: l.gst_rate,
        gst_inclusive: l.gst_inclusive,
        taxable_amount: gstResult.taxable_amount,
        cgst_amount: gstResult.cgst_amount,
        sgst_amount: gstResult.sgst_amount,
        hsn_code: l.hsn_code ?? null,
        line_discount_percent: l.line_discount_percent ?? 0,
        line_discount_flat: l.line_discount_flat ?? 0,
        bogo_buy_qty: l.bogo_buy_qty ?? null,
        bogo_get_qty: l.bogo_get_qty ?? null,
        bogo_discount_percent: (l.bogo_buy_qty && l.bogo_get_qty) ? (l.bogo_discount_percent ?? 100) : (l.bogo_discount_percent ?? undefined),
      };
    });
    const subtotal = linePayloads.reduce((s, l) => s + l.amount, 0);
    const orderDiscResult = computeOrderDiscounts(
      {
        subtotal,
        order_discount_percent: orderDiscountPercent,
        order_discount_flat: orderDiscountFlat,
        coupon: appliedCoupon,
        tieredRules: tieredRules.map((r) => ({
          min_order_amount: r.min_order_amount,
          discount_percent: r.discount_percent ?? 0,
          discount_flat: r.discount_flat ?? 0,
          max_discount_amount: r.max_discount_amount ?? null,
        })),
      },
      discSettings
    );
    const orderDiscountAmount = orderDiscResult.total;
    onSubmit(
      {
        invoice_number: invoiceNumber.trim() || null,
        customer_name: customerName.trim() || null,
        customer_address: customerAddress.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_gstin:
          customerGstinEnabled && customerGstin.trim()
            ? customerGstin.trim()
            : null,
        invoice_date: invoiceDate,
        notes: notes.trim() || null,
        order_discount_amount: orderDiscountAmount,
        round_to_whole: roundToWhole,
        coupon_code: appliedCoupon?.code ?? null,
        lines: linePayloads,
      },
      { print: shouldPrint, incrementCoupon: appliedCoupon?.code }
    );
  };

  const formTotals = useMemo(() => {
    const discSettings = {
      discount_percentage_enabled: settings.discount_percentage_enabled,
      discount_flat_enabled: settings.discount_flat_enabled,
      discount_bogo_enabled: settings.discount_bogo_enabled,
      discount_coupon_enabled: settings.discount_coupon_enabled,
      discount_tiered_enabled: settings.discount_tiered_enabled,
    };
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let grand = 0;
    for (const l of lines) {
      if (l.product_id <= 0 || l.quantity <= 0) continue;
      let gross: number;
      const pricePerUnit =
        l.priceMode === "per_unit"
          ? l.price ?? 0
          : (l.totalInput && l.totalInput !== "" ? Number(l.totalInput) : l.amount ?? 0) /
            (l.quantity || 1);
      if (l.priceMode === "per_unit") {
        const factor = getLineConvFactor(l);
        gross = (l.quantity || 0) * factor * (l.price || 0);
      } else {
        gross =
          l.totalInput !== undefined && l.totalInput !== ""
            ? Number(l.totalInput)
            : l.amount ?? (l.quantity || 0) * (l.price || 0);
      }
      const lineDiscResult = computeLineWithDiscounts(
        {
          gross,
          quantity: l.quantity,
          pricePerUnit,
          line_discount_percent: l.line_discount_percent ?? 0,
          line_discount_flat: l.line_discount_flat ?? 0,
          bogo_buy_qty: l.bogo_buy_qty ?? null,
          bogo_get_qty: l.bogo_get_qty ?? null,
          bogo_discount_percent: l.bogo_discount_percent ?? 100,
        },
        discSettings
      );
      const discountedGross = lineDiscResult.discountedGross;
      if (gstEnabled && l.gst_rate > 0) {
        const r = computeLineGst(
          discountedGross,
          l.gst_rate,
          l.gst_inclusive
        );
        taxable += r.taxable_amount;
        cgst += r.cgst_amount;
        sgst += r.sgst_amount;
        grand += r.total_amount;
      } else {
        taxable += discountedGross;
        grand += discountedGross;
      }
    }
    taxable = roundDecimal(taxable);
    cgst = roundDecimal(cgst);
    sgst = roundDecimal(sgst);
    const orderDiscResult = computeOrderDiscounts(
      {
        subtotal: grand,
        order_discount_percent: orderDiscountPercent,
        order_discount_flat: orderDiscountFlat,
        coupon: appliedCoupon,
        tieredRules: tieredRules.map((r) => ({
          min_order_amount: r.min_order_amount,
          discount_percent: r.discount_percent ?? 0,
          discount_flat: r.discount_flat ?? 0,
          max_discount_amount: r.max_discount_amount ?? null,
        })),
      },
      discSettings
    );
    const orderDiscountTotal = orderDiscResult.total;
    const beforeRound = grand - orderDiscountTotal;
    const finalTotal = roundToWholeIfEnabled(beforeRound, roundToWhole);
    return {
      taxable,
      cgst,
      sgst,
      grand,
      orderDiscountTotal,
      orderDiscBreakdown: orderDiscResult,
      finalTotal,
    };
  }, [
    lines,
    getLineConvFactor,
    gstEnabled,
    settings,
    orderDiscountPercent,
    orderDiscountFlat,
    appliedCoupon,
    tieredRules,
    roundToWhole,
  ]);

  const formTotal = formTotals.finalTotal;

  return (
    <FormModal
      title={title}
      open={open}
      onClose={onClose}
      maxWidth="max-w-6xl"
      footer={
        <div className="flex w-full items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-0.5">
            {gstEnabled && formTotals.cgst + formTotals.sgst > 0 ? (
              <>
                <span className="text-sm">
                  Subtotal: ₹{formatDecimal(formTotals.taxable)} | CGST: ₹
                  {formatDecimal(formTotals.cgst)} | SGST: ₹
                  {formatDecimal(formTotals.sgst)}
                </span>
                {formTotals.orderDiscountTotal > 0 && (
                  <span className="text-sm text-[var(--color-warning-text)]">
                    Order discount: -₹
                    {formatDecimal(formTotals.orderDiscountTotal)} | Before
                    rounding: ₹
                    {formatDecimal(
                      formTotals.grand - formTotals.orderDiscountTotal
                    )}
                  </span>
                )}
                {roundToWhole && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Rounded to nearest whole
                  </span>
                )}
                <span className="font-medium text-[var(--color-text-primary)]">
                  Grand Total: ₹{formatDecimal(roundDecimal(formTotal, 2))}
                </span>
              </>
            ) : (
              <>
                {formTotals.orderDiscountTotal > 0 && (
                  <span className="text-sm text-[var(--color-warning-text)]">
                    Order discount: -₹
                    {formatDecimal(formTotals.orderDiscountTotal)}
                  </span>
                )}
                {roundToWhole && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Rounded to nearest whole
                  </span>
                )}
                <span className="font-medium text-[var(--color-text-primary)]">
                  Total: ₹{formatDecimal(roundDecimal(formTotal, 2))}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              form="invoice-form-modal"
              variant="secondary"
              disabled={isPending}
              data-action="save"
            >
              <Check size={20} className="mr-1.5" aria-hidden="true" />
              Save
            </Button>
            <Button
              type="submit"
              form="invoice-form-modal"
              disabled={isPending}
              data-action="print"
            >
              <Printer size={20} className="mr-1.5" aria-hidden="true" />
              Save and Print
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="invoice-form-modal"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="grid grid-cols-2 gap-4">
          {invoice ? (
            <FormField label="Invoice #">
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="input-base w-full"
              />
            </FormField>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)] col-span-2">
              Invoice # will be auto-generated as INV-YYYY-NNNN (e.g.
              INV-2025-0001).
            </p>
          )}
          <FormField label="Date" required>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input-base w-full"
              required
            />
          </FormField>
        </div>
        <FormField label="Customer phone">
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            onBlur={handlePhoneBlur}
            className="input-base w-full"
            placeholder="Optional - enter to auto-fill name/address"
          />
        </FormField>
        <FormField label="Customer name">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input-base w-full"
          />
        </FormField>
        <FormField label="Customer address">
          <textarea
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            className="input-base w-full resize-y"
            rows={2}
          />
        </FormField>
        {customerGstinEnabled && (
          <FormField label="Customer GSTIN">
            <input
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value)}
              className="input-base w-full"
              placeholder="Optional"
            />
          </FormField>
        )}
        <FormField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base w-full resize-y"
            rows={2}
            placeholder="Optional notes for this invoice"
          />
        </FormField>

        {(discountPctEnabled ||
          discountFlatEnabled ||
          discountCouponEnabled ||
          discountTieredEnabled) && (
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-warning-subtle)]/50 p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Order-level discounts
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {discountPctEnabled && (
                <FormField label="Order % off">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={orderDiscountPercent || ""}
                    onChange={(e) =>
                      setOrderDiscountPercent(
                        Number(e.target.value) || 0
                      )
                    }
                    className="input-base w-full"
                    placeholder="0"
                  />
                </FormField>
              )}
              {discountFlatEnabled && (
                <FormField label="Order flat (Rs.) off">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={orderDiscountFlat || ""}
                    onChange={(e) =>
                      setOrderDiscountFlat(Number(e.target.value) || 0)
                    }
                    className="input-base w-full"
                    placeholder="0"
                  />
                </FormField>
              )}
              {discountCouponEnabled && (
                <div className="col-span-2 flex gap-2 items-end">
                  <FormField
                    label="Coupon code"
                    extra={
                      appliedCoupon ? (
                        <span className="text-xs text-[var(--color-success)]">
                          Applied: {appliedCoupon.code} (
                          {appliedCoupon.discount_type === "percent"
                            ? `${appliedCoupon.discount_value}%`
                            : `₹${appliedCoupon.discount_value}`}{" "}
                          off)
                        </span>
                      ) : null
                    }
                  >
                    <input
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      className="input-base w-full"
                      placeholder="Enter code"
                      disabled={!!appliedCoupon}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (appliedCoupon) {
                        setAppliedCoupon(null);
                        setCouponCode("");
                        return;
                      }
                      const subtotal = formTotals.grand;
                      void getElectron()
                        .validateAndApplyCoupon(couponCode.trim(), subtotal)
                        .then((result) => {
                          if (result) {
                            setAppliedCoupon(result);
                          } else {
                            toast.error("Invalid or expired coupon");
                          }
                        })
                        .catch(() => toast.error("Coupon validation failed"));
                    }}
                  >
                    {appliedCoupon ? "Remove" : "Apply"}
                  </Button>
                </div>
              )}
            </div>
            {discountTieredEnabled &&
              tieredRules.length > 0 &&
              formTotals.orderDiscBreakdown.tieredAmount > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Tiered discount applied (order &gt;= min amount)
                </p>
              )}
          </div>
        )}

        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[36rem]">
              {lines.length > 0 && (
                <div
                  className={`grid gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1 ml-2 ${gstEnabled ? "grid-cols-[10rem_5rem_5rem_6rem_6rem_5rem_1fr_5rem_2.5rem]" : "grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem]"}`}
                >
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  {gstEnabled && (
                    <>
                      <span>GST%</span>
                      <span>Mode</span>
                    </>
                  )}
                  <span>Type</span>
                  <span>Amount</span>
                  <span>Total</span>
                  <span aria-hidden="true" />
                </div>
              )}
              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const lineGross =
                    line.priceMode === "per_unit"
                      ? (line.quantity || 0) *
                        getLineConvFactor(line) *
                        (line.price || 0)
                      : ((line.totalInput !== undefined &&
                        line.totalInput !== ""
                          ? Number(line.totalInput)
                          : (line.amount ??
                            (line.quantity || 0) * (line.price || 0))) ?? 0);
                  const pricePerUnit =
                    line.priceMode === "per_unit"
                      ? line.price ?? 0
                      : (line.quantity || 0) > 0
                        ? lineGross / (line.quantity || 1)
                        : 0;
                  const lineDiscResult = computeLineWithDiscounts(
                    {
                      gross: lineGross,
                      quantity: line.quantity,
                      pricePerUnit,
                      line_discount_percent: line.line_discount_percent ?? 0,
                      line_discount_flat: line.line_discount_flat ?? 0,
                      bogo_buy_qty: line.bogo_buy_qty ?? null,
                      bogo_get_qty: line.bogo_get_qty ?? null,
                      bogo_discount_percent:
                        line.bogo_discount_percent ?? 100,
                    },
                    {
                      discount_percentage_enabled:
                        settings.discount_percentage_enabled,
                      discount_flat_enabled: settings.discount_flat_enabled,
                      discount_bogo_enabled: settings.discount_bogo_enabled,
                    }
                  );
                  const discountedGross = lineDiscResult.discountedGross;
                  const lineGst =
                    gstEnabled && line.gst_rate > 0
                      ? computeLineGst(
                          discountedGross,
                          line.gst_rate,
                          line.gst_inclusive
                        )
                      : null;
                  const lineTotal = lineGst?.total_amount ?? discountedGross;
                  return (
                    <div key={line.id ?? line._key ?? idx} className="space-y-0">
                    <div
                      className={`grid gap-3 items-center p-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm ${gstEnabled ? "grid-cols-[10rem_5rem_5rem_6rem_6rem_5rem_1fr_5rem_2.5rem]" : "grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem]"}`}
                    >
                      <select
                        value={line.product_id || ""}
                        onChange={(e) =>
                          handleProductChange(idx, Number(e.target.value))
                        }
                        className="input-base w-full min-w-0"
                        aria-label="Product"
                      >
                        <option value="">Select product</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={line.quantity || ""}
                        onChange={(e) => {
                          const qty = Number(e.target.value) || 0;
                          setLines((prev) =>
                            prev.map((p, i) => {
                              if (i !== idx) return p;
                              const next = { ...p, quantity: qty };
                              if (
                                p.priceMode === "total" &&
                                p.totalInput !== undefined &&
                                p.totalInput !== "" &&
                                qty > 0
                              ) {
                                next.price = roundDecimal(
                                  Number(p.totalInput) / qty,
                                  4
                                );
                              }
                              return next;
                            })
                          );
                        }}
                        className="input-base w-full text-right"
                        aria-label="Quantity"
                      />
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, unit: e.target.value } : p
                            )
                          )
                        }
                        className="input-base w-full min-w-0"
                        aria-label="Unit"
                      >
                        <option value="">—</option>
                        {getUnitsForLine(idx).map((u) => (
                          <option key={u.id} value={u.name}>
                            {(u.symbol && u.symbol.trim()) || u.name}
                          </option>
                        ))}
                      </select>
                      {gstEnabled && (
                        <>
                          <select
                            value={line.gst_rate}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? { ...p, gst_rate: Number(e.target.value) }
                                    : p
                                )
                              )
                            }
                            className="input-base w-full text-sm min-w-0"
                            aria-label="GST rate"
                          >
                            {GST_SLABS.map((r) => (
                              <option key={r} value={r}>
                                {r}%
                              </option>
                            ))}
                          </select>
                          <select
                            value={
                              line.gst_inclusive ? "inclusive" : "exclusive"
                            }
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? {
                                        ...p,
                                        gst_inclusive:
                                          e.target.value === "inclusive",
                                      }
                                    : p
                                )
                              )
                            }
                            className="input-base w-full text-xs min-w-0"
                            aria-label="GST mode"
                          >
                            <option value="exclusive">Excl.</option>
                            <option value="inclusive">Incl.</option>
                          </select>
                        </>
                      )}
                      {(() => {
                        const lineUnits = getUnitsForLine(idx);
                        const typeValue =
                          line.priceMode === "per_unit"
                            ? line.priceUnit
                            : "total";
                        return (
                          <select
                            value={typeValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "total") {
                                setLines((prev) =>
                                  prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    const factor = getLineConvFactor(p);
                                    const lineAmt =
                                      p.amount ??
                                      (p.quantity > 0
                                        ? p.quantity * factor * p.price
                                        : 0);
                                    const totalInput =
                                      lineAmt > 0 ? formatDecimal(lineAmt) : "";
                                    return {
                                      ...p,
                                      priceMode: "total",
                                      totalInput,
                                    };
                                  })
                                );
                              } else {
                                setLines((prev) =>
                                  prev.map((p, i) =>
                                    i !== idx
                                      ? p
                                      : {
                                          ...p,
                                          priceMode: "per_unit",
                                          priceUnit: val,
                                          totalInput: undefined,
                                        }
                                  )
                                );
                              }
                            }}
                            className="input-base w-full text-sm min-w-0"
                            title="Enter price per unit or total for this line"
                            aria-label="Price type"
                          >
                            {lineUnits.length > 0 ? (
                              lineUnits.map((u) => (
                                <option key={u.id} value={u.name}>
                                  Per {u?.symbol?.trim() || u.name}
                                </option>
                              ))
                            ) : (
                              <option value={line.priceUnit || ""}>
                                Per{" "}
                                {unitToShort(line.priceUnit, allUnits) ||
                                  "unit"}
                              </option>
                            )}
                            <option value="total">Total</option>
                          </select>
                        );
                      })()}
                      {line.priceMode === "per_unit" ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={line.price || ""}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? {
                                        ...p,
                                        price: Number(e.target.value) || 0,
                                      }
                                    : p
                                )
                              )
                            }
                            className="input-base w-full text-right"
                            aria-label="Unit price"
                          />
                          <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                            ₹{formatDecimal(lineTotal)}
                            {lineGst && line.gst_rate > 0 && (
                              <span className="block text-[10px] text-[var(--color-text-tertiary)]">
                                (tax ₹
                                {formatDecimal(
                                  lineGst.cgst_amount + lineGst.sgst_amount
                                )}
                                )
                              </span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={getLineTotalDisplay(line)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const total = Number(raw) || 0;
                              setLines((prev) =>
                                prev.map((p, i) => {
                                  if (i !== idx) return p;
                                  const next = {
                                    ...p,
                                    totalInput: raw,
                                  };
                                  if (p.quantity > 0 && total >= 0) {
                                    next.price = roundDecimal(
                                      total / p.quantity,
                                      4
                                    );
                                  }
                                  return next;
                                })
                              );
                            }}
                            className="input-base w-full text-right"
                            title="Total amount for this line (quantity can be entered before or after)"
                            aria-label="Line total"
                          />
                          <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                            ₹{formatDecimal(lineTotal)}
                            {lineGst && line.gst_rate > 0 && (
                              <span className="block text-[10px] text-[var(--color-text-tertiary)]">
                                (tax ₹
                                {formatDecimal(
                                  lineGst.cgst_amount + lineGst.sgst_amount
                                )}
                                )
                              </span>
                            )}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] text-xs font-medium py-1.5 px-2 rounded transition-colors inline-flex items-center gap-1"
                        aria-label="Remove line"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {(discountPctEnabled ||
                      discountFlatEnabled ||
                      discountBogoEnabled) && (
                      <div className="pl-2 pt-1 flex flex-wrap gap-4 text-xs">
                        {discountPctEnabled && (
                          <label className="flex items-center gap-1">
                            <span className="text-[var(--color-text-secondary)]">% off:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={
                                (line.line_discount_percent ?? 0) || ""
                              }
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          line_discount_percent:
                                            Number(e.target.value) || 0,
                                        }
                                      : p
                                  )
                                )
                              }
                              className="input-base w-14 py-1 text-right"
                            />
                          </label>
                        )}
                        {discountFlatEnabled && (
                          <label className="flex items-center gap-1">
                            <span className="text-[var(--color-text-secondary)]">Rs off:</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                (line.line_discount_flat ?? 0) || ""
                              }
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          line_discount_flat:
                                            Number(e.target.value) || 0,
                                        }
                                      : p
                                  )
                                )
                              }
                              className="input-base w-16 py-1 text-right"
                            />
                          </label>
                        )}
                        {discountBogoEnabled && (
                          <>
                            <label className="flex items-center gap-1">
                              <span className="text-[var(--color-text-secondary)]">BOGO buy:</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="—"
                                value={
                                  (line.bogo_buy_qty ?? "") === ""
                                    ? ""
                                    : line.bogo_buy_qty ?? ""
                                }
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((p, i) =>
                                      i === idx
                                        ? {
                                            ...p,
                                            bogo_buy_qty:
                                              e.target.value === ""
                                                ? null
                                                : Number(e.target.value) || 0,
                                          }
                                        : p
                                    )
                                  )
                                }
                                className="input-base w-12 py-1 text-right"
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span className="text-[var(--color-text-secondary)]">get:</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="—"
                                value={
                                  (line.bogo_get_qty ?? "") === ""
                                    ? ""
                                    : line.bogo_get_qty ?? ""
                                }
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((p, i) =>
                                      i === idx
                                        ? {
                                            ...p,
                                            bogo_get_qty:
                                              e.target.value === ""
                                                ? null
                                                : Number(e.target.value) || 0,
                                          }
                                        : p
                                    )
                                  )
                                }
                                className="input-base w-12 py-1 text-right"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      ...DEFAULT_LINE_ROW,
                      _key: Date.now(),
                      gst_rate: Number(settings?.gst_default_rate) || 0,
                      gst_inclusive:
                        (settings?.gst_default_mode ?? "exclusive") ===
                        "inclusive",
                    },
                  ])
                }
                className="mt-3 !text-[var(--color-accent)] hover:!text-[var(--color-accent)] hover:!bg-transparent focus:outline-none focus:ring-0"
              >
                <Plus size={20} className="mr-1.5" aria-hidden="true" />
                Add item
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormModal>
  );
}
