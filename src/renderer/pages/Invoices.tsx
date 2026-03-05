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
  CheckIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

type InvoiceRow = Invoice & { total?: number };

type PriceMode = "per_unit" | "total";

type LineRow = {
  product_id: number;
  product_name: string;
  quantity: number;
  /** Unit the quantity is measured in. */
  unit: string;
  /** Unit the price is expressed per (only relevant when priceMode is "per_unit"). */
  priceUnit: string;
  price: number;
  priceMode: PriceMode;
  /** When priceMode is "total", raw input so user can type freely. */
  totalInput?: string;
  /** Line total (from load or computed). Used when switching to Total mode and for submit. */
  amount?: number;
  /** Client-only key for list stability when creating new lines (no id yet). */
  _key?: number;
  /** Present when loaded from server (edit mode) for stable list key. */
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
};

/** Payload line sent to API (no priceMode/totalInput/priceUnit — UI-only fields). */
type LinePayload = Omit<LineRow, "priceMode" | "totalInput" | "priceUnit"> & {
  amount: number;
  price_entered_as: PriceMode;
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
}: {
  invoice: InvoiceWithLines;
  isPrint?: boolean;
  invoiceUnits?: Unit[];
}) {
  const total = invoice.lines.reduce(
    (s, l) => s + (l.amount ?? l.quantity * l.price),
    0
  );
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
        <div className="col-span-2">
          <span className="font-medium">Date:</span>{" "}
          {formatBillDateTime(new Date())}
        </div>
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
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left">
              Product
            </th>
            <th className="border border-gray-300 px-2 py-1 text-right">Qty</th>
            <th className="border border-gray-300 px-2 py-1 text-left">Unit</th>
            <th className="border border-gray-300 px-2 py-1 text-right">
              Price/unit
            </th>
            <th className="border border-gray-300 px-2 py-1 text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td className="border border-gray-300 px-2 py-1">
                {line.product_name ?? ""}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                {formatDecimal(line.quantity)}
              </td>
              <td className="border border-gray-300 px-2 py-1">
                {unitToShort(line.unit, invoiceUnits)}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                ₹{formatDecimal(line.price)}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                ₹{formatDecimal(line.amount ?? line.quantity * line.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isPrint && (
        <div className="mt-1 font-medium">Total: ₹{formatDecimal(total)}</div>
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
    if (state?.dateFrom) setDateFrom(state.dateFrom);
    if (state?.dateTo) setDateTo(state.dateTo);
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
      lines: LinePayload[];
    }) => api.createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
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
        lines: LinePayload[];
      };
    }) => api.updateInvoice(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      setEditing(null);
    },
  });

  const deleteInvoice = useMutationWithToast({
    mutationFn: (id: number) => api.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoicesPage"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
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
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
              title="View"
              onClick={() => fetchAndView(r.id)}
              aria-label="View invoice"
            >
              <EyeIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
              onClick={() => fetchAndEdit(r.id)}
              aria-label="Edit invoice"
            >
              <PencilSquareIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
              onClick={() => setDeleteConfirmInvoiceId(r.id)}
              aria-label="Delete invoice"
            >
              <TrashIcon className="w-5 h-5" />
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
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
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
              From
              <DateInput
                value={dateFrom}
                onChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
              />
            </label>
            <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
              To
              <DateInput
                value={dateTo}
                onChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
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
        onSubmit={(payload, opts) =>
          createInvoice.mutate(payload, {
            onSuccess: (newId: number) => {
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
          onSubmit={(payload, opts) =>
            updateInvoice.mutate(
              { id: editing.id, payload },
              {
                onSuccess: () => {
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
              <span className="font-medium text-gray-900">
                Total: ₹
                {formatDecimal(
                  viewing.lines.reduce(
                    (s, l) => s + (l.amount ?? l.quantity * l.price),
                    0
                  )
                )}
              </span>
              <div className="flex gap-2 items-center">
                <Link
                  to="/sales"
                  state={{
                    dateFrom: viewing.invoice_date,
                    dateTo: viewing.invoice_date,
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
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
                  <DocumentArrowDownIcon
                    className="w-5 h-5 mr-1.5"
                    aria-hidden
                  />
                  Export PDF
                </Button>
                <Button onClick={() => setPrintData(viewing)}>
                  <PrinterIcon className="w-5 h-5 mr-1.5" aria-hidden />
                  Print
                </Button>
              </div>
            </div>
          }
        >
          <ViewInvoiceContent invoice={viewing} invoiceUnits={allUnits} />
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
              <div className="text-gray-700">
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
  onSubmit: (
    payload: {
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_address?: string | null;
      invoice_date: string;
      notes?: string | null;
      lines: Array<LinePayload>;
    },
    opts?: { print?: boolean }
  ) => void;
  isPending: boolean;
}>) {
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => invoice?.invoice_number ?? ""
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
  const [lines, setLines] = useState<LineRow[]>(() => {
    if (invoice?.lines?.length) {
      return invoice.lines.map((l) => {
        const priceEnteredAs = l.price_entered_as ?? "per_unit";
        const amount = l.amount ?? l.quantity * l.price;
        return {
          id: l.id,
          product_id: l.product_id ?? 0,
          product_name: l.product_name ?? "",
          quantity: l.quantity,
          unit: l.unit,
          priceUnit: l.unit,
          price: l.price,
          amount,
          priceMode: priceEnteredAs,
          totalInput:
            priceEnteredAs === "total" && amount > 0
              ? formatDecimal(amount)
              : undefined,
        };
      });
    }
    return [{ ...DEFAULT_LINE_ROW }];
  });

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
    setLines((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              product_id: productId,
              product_name: item?.name ?? "",
              unit: defaultUnit,
              priceUnit: defaultUnit,
            }
          : p
      )
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validLines = lines.filter((l) => {
      if (l.product_id <= 0 || l.quantity <= 0) return false;
      if (l.priceMode === "per_unit") return l.price >= 0;
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
    onSubmit(
      {
        invoice_number: invoiceNumber.trim() || null,
        customer_name: customerName.trim() || null,
        customer_address: customerAddress.trim() || null,
        invoice_date: invoiceDate,
        notes: notes.trim() || null,
        lines: validLines.map((l) => {
          let amount: number;
          let price: number;
          if (l.priceMode === "per_unit") {
            const conv = getLineConvFactor(l);
            amount = roundDecimal(l.quantity * conv * l.price, 2);
            price = l.quantity > 0 ? roundDecimal(amount / l.quantity, 4) : 0;
          } else {
            amount = roundDecimal(
              (l.totalInput !== undefined && l.totalInput !== ""
                ? Number(l.totalInput)
                : (l.amount ?? l.quantity * l.price)) || 0,
              2
            );
            price = l.quantity > 0 ? roundDecimal(amount / l.quantity, 4) : 0;
          }
          return {
            product_id: l.product_id,
            product_name: l.product_name,
            quantity: l.quantity,
            unit: l.unit || "pcs",
            price,
            amount,
            price_entered_as: l.priceMode,
          };
        }),
      },
      { print: shouldPrint }
    );
  };

  const formTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      if (l.product_id <= 0 || l.quantity <= 0) return sum;
      if (l.priceMode === "per_unit") {
        const factor = getLineConvFactor(l);
        return sum + (l.quantity || 0) * factor * (l.price || 0);
      }
      const amt =
        l.totalInput !== undefined && l.totalInput !== ""
          ? Number(l.totalInput)
          : (l.amount ?? (l.quantity || 0) * (l.price || 0));
      return sum + (amt || 0);
    }, 0);
  }, [lines, getLineConvFactor]);

  return (
    <FormModal
      title={title}
      open={open}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <span className="font-medium text-gray-900">
            Total: ₹{formatDecimal(roundDecimal(formTotal, 2))}
          </span>
          <div className="flex gap-2">
            <Button
              type="submit"
              form="invoice-form-modal"
              variant="secondary"
              disabled={isPending}
              data-action="save"
            >
              <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Save
            </Button>
            <Button
              type="submit"
              form="invoice-form-modal"
              disabled={isPending}
              data-action="print"
            >
              <PrinterIcon className="w-5 h-5 mr-1.5" aria-hidden />
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
            <p className="text-sm text-gray-500 col-span-2">
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
        <FormField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base w-full resize-y"
            rows={2}
            placeholder="Optional notes for this invoice"
          />
        </FormField>

        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[36rem]">
              {lines.length > 0 && (
                <div className="grid grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem] gap-3 items-center text-sm font-medium text-gray-700 mb-2 px-1 ml-2">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Type</span>
                  <span>Amount</span>
                  <span>Rate</span>
                  <span aria-hidden="true" />
                </div>
              )}
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div
                    key={line.id ?? line._key ?? idx}
                    className="grid grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem] gap-3 items-center p-3 rounded-md bg-white border border-gray-100 shadow-sm"
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
                              {unitToShort(line.priceUnit, allUnits) || "unit"}
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
                                  ? { ...p, price: Number(e.target.value) || 0 }
                                  : p
                              )
                            )
                          }
                          className="input-base w-full text-right"
                          aria-label="Unit price"
                        />
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          ₹
                          {formatDecimal(
                            (line.quantity || 0) *
                              getLineConvFactor(line) *
                              (line.price || 0)
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
                        {line.quantity > 0 &&
                        (line.totalInput
                          ? Number(line.totalInput) > 0
                          : (line.amount ?? 0) > 0) ? (
                          <span className="text-xs text-gray-600 whitespace-nowrap ml-2">
                            ₹
                            {formatDecimal(
                              (() => {
                                const amt =
                                  line.totalInput !== undefined &&
                                  line.totalInput !== ""
                                    ? Number(line.totalInput)
                                    : line.amount ??
                                      (line.quantity || 0) * (line.price || 0);
                                const factor = getLineConvFactor(line);
                                if (
                                  factor > 0 &&
                                  (line.quantity || 0) > 0 &&
                                  line.priceUnit
                                ) {
                                  return amt / ((line.quantity || 0) * factor);
                                }
                                return line.price > 0
                                  ? line.price
                                  : amt / (line.quantity || 1);
                              })()
                            )}
                            /
                            {unitToShort(
                              line.priceUnit || line.unit,
                              allUnits
                            ) || "unit"}
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-medium py-1.5 px-2 rounded transition-colors inline-flex items-center gap-1"
                      aria-label="Remove line"
                    >
                      <TrashIcon className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { ...DEFAULT_LINE_ROW, _key: Date.now() },
                  ])
                }
                className="mt-3 !text-blue-600 hover:!text-blue-700 hover:!bg-transparent focus:outline-none focus:ring-0"
              >
                <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
                Add item
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormModal>
  );
}
