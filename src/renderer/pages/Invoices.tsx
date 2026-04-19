import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n, {
  INVOICE_PRINT_LOCALE_STORAGE_KEY,
  readStoredInvoicePrintLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import { useAuth } from "../context/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import SearchFilterBar from "../components/SearchFilterBar";
import { PAGE_SIZE } from "../../shared/constants";
import { PAGE } from "shared/test-ids";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import toast from "react-hot-toast";
import {
  formatInvoiceLineDiscountNote,
  invoiceLinesSubtotal,
  invoiceNetTotal,
} from "../lib/invoiceDisplayTotals";
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
import {
  formatBillDateTime,
  formatDateForFile,
  sanitizeForFilename,
} from "../lib/exportUtils";
import {
  useElectronHtmlPrintJob,
  type HtmlPrintJobBase,
} from "../hooks/useElectronHtmlPrintJob";
import {
  formatDecimal,
  roundDecimal,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { useFormatters } from "../i18n/useFormatters";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  SalesListHero,
  SalesListSectionPanel,
  SalesListAsyncPanel,
} from "../components/sales-list-page";
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

function invoicePrintDocumentTitle(inv: InvoiceWithLines): string {
  const invNum = (inv.invoice_number ?? `INV-${inv.id}`)
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "_");
  const customer = (inv.customer_name ?? "")
    .trim()
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "_");
  const base = customer ? `Invoice_${invNum}_${customer}` : `Invoice_${invNum}`;
  return `${base}_${formatDateForFile(new Date())}`;
}

function invoicePrintDefaultPdfPath(inv: InvoiceWithLines): string {
  const safeNum = inv.invoice_number
    ? sanitizeForFilename(inv.invoice_number)
    : `invoice-${inv.id}`;
  return `invoice-${safeNum}-${formatDateForFile(new Date())}.pdf`;
}

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
type LinePayload = Omit<LineRow, "priceMode" | "totalInput" | "priceUnit"> & {
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
  printLocale,
  invoiceUnits = [],
  settings = {},
}: {
  invoice: InvoiceWithLines;
  isPrint?: boolean;
  /** When printing/PDF, labels use this locale (independent of app UI language). */
  printLocale?: SupportedLocale;
  invoiceUnits?: Unit[];
  settings?: Record<string, string>;
}) {
  const { t, i18n: i18nInstance } = useTranslation("invoices");
  const tView = useMemo(() => {
    if (isPrint && printLocale) {
      return i18nInstance.getFixedT(printLocale, "invoices") as (
        k: string,
        o?: Record<string, unknown>
      ) => string;
    }
    return t;
  }, [isPrint, printLocale, i18nInstance, t]);
  const linesSubtotal = invoiceLinesSubtotal(invoice.lines);
  const netTotal = invoiceNetTotal(invoice, invoice.lines);
  const orderDiscAmount = invoice.order_discount_amount ?? 0;
  const gstEnabled = settings.gst_enabled === "true";
  const anyLineHasGst = invoice.lines.some((l) => (l.gst_rate ?? 0) > 0);
  const useGstLayout = gstEnabled && anyLineHasGst;
  const hsnEnabled = settings.hsn_enabled !== "false";
  const hasHsn = hsnEnabled && invoice.lines.some((l) => l.hsn_code?.trim());
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
            <span className="font-medium">{tView("view.invoiceNumber")}</span>{" "}
            {invoice.invoice_number}
          </div>
        )}
        {gstEnabled && settings.place_of_supply?.trim() && (
          <div className="col-span-2">
            <span className="font-medium">{tView("view.placeOfSupply")}</span>{" "}
            {settings.place_of_supply.trim()}
          </div>
        )}
        <div className="col-span-2">
          <span className="font-medium">{tView("view.date")}</span>{" "}
          {formatBillDateTime(new Date())}
        </div>
        {invoice.customer_phone && (
          <div className="col-span-2">
            <span className="font-medium">{tView("view.phone")}</span>{" "}
            {invoice.customer_phone}
          </div>
        )}
        {invoice.customer_name && (
          <div className="col-span-2">
            <span className="font-medium">{tView("view.customer")}</span>{" "}
            {invoice.customer_name}
          </div>
        )}
        {invoice.customer_address && (
          <div className="col-span-2">
            <span className="font-medium">{tView("view.address")}</span>{" "}
            {invoice.customer_address}
          </div>
        )}
      </div>
      <table className="w-full border-collapse border border-[var(--color-border-strong)]">
        <thead>
          <tr className="bg-[var(--color-bg-surface-raised)]">
            {useGstLayout && hasHsn && (
              <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">
                {tView("view.table.hsn")}
              </th>
            )}
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">
              {tView("view.table.product")}
            </th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
              {tView("view.table.qty")}
            </th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-left">
              {tView("view.table.unit")}
            </th>
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
              {tView("view.table.ratePerUnit")}
            </th>
            {useGstLayout && (
              <>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  {tView("view.table.taxable")}
                </th>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  {tView("view.table.cgst")}
                </th>
                <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
                  {tView("view.table.sgst")}
                </th>
              </>
            )}
            <th className="border border-[var(--color-border-strong)] px-2 py-1 text-right">
              {tView("view.table.total")}
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
            const lineDiscNote = formatInvoiceLineDiscountNote(
              line,
              isPrint && printLocale
                ? { lineNotesLocale: printLocale }
                : undefined
            );
            return (
              <tr key={line.id}>
                {useGstLayout && hasHsn && (
                  <td className="border border-[var(--color-border-strong)] px-2 py-1">
                    {line.hsn_code ?? ""}
                  </td>
                )}
                <td className="border border-[var(--color-border-strong)] px-2 py-1">
                  <div>{line.product_name ?? ""}</div>
                  {lineDiscNote ? (
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {lineDiscNote}
                    </div>
                  ) : null}
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
      <div className="mt-2 space-y-0.5">
        {useGstLayout && orderDiscAmount > 0 && (
          <div className="text-sm">
            {tView("view.subtotalLines", {
              amount: formatDecimal(linesSubtotal),
            })}
          </div>
        )}
        {useGstLayout && (
          <>
            <div className="text-sm">
              {tView("view.taxableAmount", {
                amount: formatDecimal(taxableTotal),
              })}
            </div>
            <div className="text-sm">
              {tView("view.cgstAmount", { amount: formatDecimal(cgstTotal) })}
            </div>
            <div className="text-sm">
              {tView("view.sgstAmount", { amount: formatDecimal(sgstTotal) })}
            </div>
          </>
        )}
        {!useGstLayout && orderDiscAmount > 0 && (
          <div className="text-sm">
            {tView("view.subtotal", { amount: formatDecimal(linesSubtotal) })}
          </div>
        )}
        {orderDiscAmount > 0 && (
          <div className="text-sm text-[var(--color-warning-text)]">
            {tView("view.orderDiscount", {
              amount: formatDecimal(orderDiscAmount),
            })}
          </div>
        )}
        {orderDiscAmount > 0 && invoice.coupon_code?.trim() && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {tView("view.couponApplied", { code: invoice.coupon_code.trim() })}
          </div>
        )}
        {Boolean(invoice.round_to_whole) && (
          <div className="text-xs text-[var(--color-text-tertiary)]">
            {tView("view.roundedWhole")}
          </div>
        )}
        <div className="font-medium">
          {useGstLayout
            ? tView("view.grandTotal", { amount: formatDecimal(netTotal) })
            : tView("view.total", { amount: formatDecimal(netTotal) })}
        </div>
        {useGstLayout && (
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">
            {amountInWords(netTotal)}
          </div>
        )}
      </div>
    </div>
  );
});

export default function Invoices() {
  const { t } = useTranslation("invoices");
  const { t: tc } = useTranslation("common");
  const queryClient = useQueryClient();
  const api = getElectron();
  const { authState } = useAuth();
  const currentUser = authState.status === "unlocked" ? authState.user : null;
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
  type InvoiceHtmlPrintJob =
    | null
    | (HtmlPrintJobBase & {
        invoice: InvoiceWithLines;
        printLocale: SupportedLocale;
        pdfLandscape?: boolean;
      });
  const [invoicePrintJob, setInvoicePrintJob] =
    useState<InvoiceHtmlPrintJob>(null);
  const [invoicePrintLocale, setInvoicePrintLocale] = useState<SupportedLocale>(
    readStoredInvoicePrintLocale
  );
  const persistInvoicePrintLocale = useCallback((l: SupportedLocale) => {
    setInvoicePrintLocale(l);
    try {
      window.localStorage.setItem(INVOICE_PRINT_LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
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

  const {
    data: pageResult,
    isLoading,
    isError: invoicesPageError,
    refetch: refetchInvoicesPage,
  } = useQuery({
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
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const { formatAbbreviatedInteger } = useFormatters();
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
    }) => api.createInvoice({ ...payload, _userId: currentUser?.id ?? null }),
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
        label: t("columns.number"),
        render: (r: InvoiceRow) =>
          r.invoice_number ?? t("tableActions.emptyCell"),
      },
      { key: "invoice_date" as const, label: t("columns.date") },
      {
        key: "customer_name" as const,
        label: t("columns.customer"),
        render: (r: InvoiceRow) =>
          r.customer_name ?? t("tableActions.emptyCell"),
      },
      {
        key: "total" as const,
        label: t("columns.total"),
        align: "right" as const,
        render: (r: InvoiceRow) =>
          r.total != null && r.total > 0
            ? `₹${formatDecimal(r.total)}`
            : t("tableActions.emptyCell"),
      },
      {
        key: "actions" as const,
        label: t("columns.actions"),
        render: (r: InvoiceRow) => (
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded transition-colors shrink-0"
              title={t("tableActions.viewTitle")}
              onClick={() => fetchAndView(r.id)}
              aria-label={t("tableActions.viewInvoiceAria")}
            >
              <Eye size={20} />
            </button>
            <button
              type="button"
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded transition-colors"
              title={t("tableActions.editTitle")}
              onClick={() => fetchAndEdit(r.id)}
              aria-label={t("tableActions.editInvoiceAria")}
            >
              <Pencil size={20} />
            </button>
            <button
              type="button"
              className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded transition-colors"
              title={t("tableActions.deleteTitle")}
              onClick={() => setDeleteConfirmInvoiceId(r.id)}
              aria-label={t("tableActions.deleteInvoiceAria")}
            >
              <Trash2 size={20} />
            </button>
          </span>
        ),
      },
    ],
    [fetchAndView, fetchAndEdit, t]
  );

  const clearInvoiceFilters = useCallback(() => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const invoicesHasFilters = !!(search.trim() || dateFrom || dateTo);
  const isInvoicesEmpty =
    !isLoading && !invoicesPageError && invoicesPage.length === 0;

  const invoicesCountBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {formatAbbreviatedInteger(totalInvoices, abbreviationStyle)}
    </span>
  );

  const invoicePrintFixedT = useMemo(() => {
    if (!invoicePrintJob) {
      return null;
    }
    return i18n.getFixedT(invoicePrintJob.printLocale, "invoices") as (
      k: string,
      o?: Record<string, unknown>
    ) => string;
  }, [invoicePrintJob]);

  useElectronHtmlPrintJob(invoicePrintJob, setInvoicePrintJob, api, {
    onPdfFinished: ({ saved }) => {
      if (saved) {
        toast.success(t("toasts.exportedPdf"));
      }
    },
    onPdfError: (err) => {
      toast.error(
        err instanceof Error ? err.message : t("toasts.exportPdfFailed")
      );
    },
  });

  return (
    <div className="space-y-4 home-dashboard pb-3" data-testid={PAGE.invoices}>
      <SalesListHero
        title={t("page.title")}
        metrics={[]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
            {t("page.createInvoice")}
          </Button>
        }
      />

      <DashboardSectionBoundary
        sectionTitle={t("page.sectionListTitle")}
        containerClassName="dashboard-panel"
        resetKeys={[
          search,
          dateFrom,
          dateTo,
          page,
          isLoading,
          invoicesPageError,
          invoicesPage.length,
        ]}
      >
        <SalesListSectionPanel
          title={t("page.registerTitle")}
          description={t("page.registerDescription")}
          badge={invoicesCountBadge}
        >
          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            placeholder={t("page.searchPlaceholder")}
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
                  {t("page.dateFrom")}
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
                  {t("page.dateTo")}
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

          <div className="mt-4">
            <SalesListAsyncPanel
              isLoading={isLoading}
              isError={invoicesPageError}
              onRetry={() => {
                void refetchInvoicesPage();
              }}
              isEmpty={isInvoicesEmpty}
              emptyTitle={
                invoicesHasFilters
                  ? t("page.emptyFilteredTitle")
                  : t("page.emptyDefaultTitle")
              }
              emptyDescription={
                invoicesHasFilters
                  ? t("page.emptyFilteredDescription")
                  : t("page.emptyDefaultDescription")
              }
              emptyActionLabel={
                invoicesHasFilters
                  ? t("page.clearFilters")
                  : t("page.createInvoiceCta")
              }
              onEmptyAction={
                invoicesHasFilters
                  ? clearInvoiceFilters
                  : () => setCreateOpen(true)
              }
              emptySecondaryLabel={
                invoicesHasFilters ? t("page.createInvoiceCta") : undefined
              }
              onEmptySecondary={
                invoicesHasFilters ? () => setCreateOpen(true) : undefined
              }
              loaderColumns={5}
            >
              <DataTable<InvoiceRow>
                columns={tableColumns}
                data={invoicesPage}
                emptyMessage={t("page.tableEmptyMessage")}
                scrollMaxHeight={`calc(100vh - 20.5rem)`}
                pagination={{
                  type: "controlled",
                  page,
                  total: totalInvoices,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </SalesListAsyncPanel>
          </div>
        </SalesListSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmInvoiceId != null}
        onClose={() => setDeleteConfirmInvoiceId(null)}
        title={t("confirmDelete.title")}
        message={t("confirmDelete.message")}
        confirmLabel={tc("actions.delete")}
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
        title={t("formModal.createTitle")}
        onClose={() => setCreateOpen(false)}
        invoicePrintLocale={invoicePrintLocale}
        onInvoicePrintLocaleChange={persistInvoicePrintLocale}
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
                  const inv = full as InvoiceWithLines;
                  setInvoicePrintJob({
                    mode: "browser",
                    invoice: inv,
                    printLocale: invoicePrintLocale,
                    documentTitle: invoicePrintDocumentTitle(inv),
                    defaultPdfPath: invoicePrintDefaultPdfPath(inv),
                    pdfLandscape: false,
                  });
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
          title={t("formModal.editTitle")}
          invoice={editing}
          onClose={() => setEditing(null)}
          invoicePrintLocale={invoicePrintLocale}
          onInvoicePrintLocaleChange={persistInvoicePrintLocale}
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
                      const inv = full as InvoiceWithLines;
                      setInvoicePrintJob({
                        mode: "browser",
                        invoice: inv,
                        printLocale: invoicePrintLocale,
                        documentTitle: invoicePrintDocumentTitle(inv),
                        defaultPdfPath: invoicePrintDefaultPdfPath(inv),
                        pdfLandscape: false,
                      });
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
          title={t("viewModal.title", {
            id: String(viewing.invoice_number ?? viewing.id),
          })}
          open={!!viewing}
          onClose={() => setViewing(null)}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex w-full items-center justify-between gap-4 flex-wrap">
              <span className="font-medium text-[var(--color-text-primary)]">
                {t("viewModal.total", {
                  amount: formatDecimal(
                    invoiceNetTotal(viewing, viewing.lines)
                  ),
                })}
              </span>
              <div className="flex gap-2 items-center w-full justify-between">
                <Link
                  to="/sales"
                  state={{
                    dateFrom: viewing.invoice_date,
                    dateTo: viewing.invoice_date,
                  }}
                  className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                >
                  {t("viewModal.linkDailySale")}
                </Link>
                <div className="flex gap-2 items-center">
                  {/* Same snapshot as Print; language applies to both. */}
                  <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] shrink-0">
                    <select
                      className="input-base py-1 text-sm min-w-[7.5rem]"
                      value={invoicePrintLocale}
                      onChange={(e) =>
                        persistInvoicePrintLocale(
                          e.target.value as SupportedLocale
                        )
                      }
                      aria-label={t("viewModal.printLanguage")}
                    >
                      {SUPPORTED_LOCALES.map((loc) => (
                        <option key={loc} value={loc}>
                          {t(`printLanguageOption.${loc}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInvoicePrintJob({
                        mode: "pdf",
                        invoice: viewing,
                        printLocale: invoicePrintLocale,
                        documentTitle: invoicePrintDocumentTitle(viewing),
                        defaultPdfPath: invoicePrintDefaultPdfPath(viewing),
                        pdfLandscape: false,
                      });
                    }}
                  >
                    <FileDown size={20} className="mr-1.5" aria-hidden="true" />
                    {t("viewModal.exportPdf")}
                  </Button>

                  <Button
                    onClick={() => {
                      setInvoicePrintJob({
                        mode: "browser",
                        invoice: viewing,
                        printLocale: invoicePrintLocale,
                        documentTitle: invoicePrintDocumentTitle(viewing),
                        defaultPdfPath: invoicePrintDefaultPdfPath(viewing),
                        pdfLandscape: false,
                      });
                    }}
                  >
                    <Printer size={20} className="mr-1.5" aria-hidden="true" />
                    {t("viewModal.print")}
                  </Button>
                </div>
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

      {invoicePrintJob && invoicePrintFixedT && (
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
              <div>
                {invoicePrintFixedT("printHeader.phone")}{" "}
                {settings.owner_phone.trim()}
              </div>
            )}
            {settings?.gstin?.trim() && (
              <div>
                {invoicePrintFixedT("printHeader.gstin")}{" "}
                {settings.gstin.trim()}
              </div>
            )}
          </div>
          <ViewInvoiceContent
            invoice={invoicePrintJob.invoice}
            isPrint
            printLocale={invoicePrintJob.printLocale}
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
  invoicePrintLocale,
  onInvoicePrintLocaleChange,
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
  invoicePrintLocale: SupportedLocale;
  onInvoicePrintLocaleChange: (l: SupportedLocale) => void;
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
  const { t } = useTranslation("invoices");
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
          bogo_discount_percent:
            line.bogo_buy_qty && line.bogo_get_qty
              ? (line.bogo_discount_percent ?? 100)
              : (line.bogo_discount_percent ?? undefined),
        };
      });
    }
    return [{ ...DEFAULT_LINE_ROW }];
  });

  const inv = invoice as
    | {
        order_discount_amount?: number;
        round_to_whole?: number;
        coupon_code?: string;
      }
    | undefined;
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
        {
          min_order_amount: number;
          discount_percent: number;
          discount_flat: number;
          max_discount_amount: number | null;
        }[]
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
          ? (l.price ?? 0)
          : (l.totalInput && l.totalInput !== ""
              ? Number(l.totalInput)
              : (l.amount ?? 0)) / (l.quantity || 1);
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
        bogo_discount_percent:
          l.bogo_buy_qty && l.bogo_get_qty
            ? (l.bogo_discount_percent ?? 100)
            : (l.bogo_discount_percent ?? undefined),
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
          ? (l.price ?? 0)
          : (l.totalInput && l.totalInput !== ""
              ? Number(l.totalInput)
              : (l.amount ?? 0)) / (l.quantity || 1);
      if (l.priceMode === "per_unit") {
        const factor = getLineConvFactor(l);
        gross = (l.quantity || 0) * factor * (l.price || 0);
      } else {
        gross =
          l.totalInput !== undefined && l.totalInput !== ""
            ? Number(l.totalInput)
            : (l.amount ?? (l.quantity || 0) * (l.price || 0));
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
        const r = computeLineGst(discountedGross, l.gst_rate, l.gst_inclusive);
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
                  {t("formModal.footer.subtotalCgstSgst", {
                    taxable: formatDecimal(formTotals.taxable),
                    cgst: formatDecimal(formTotals.cgst),
                    sgst: formatDecimal(formTotals.sgst),
                  })}
                </span>
                {formTotals.orderDiscountTotal > 0 && (
                  <span className="text-sm text-[var(--color-warning-text)]">
                    {t("formModal.footer.orderDiscountBeforeRound", {
                      discount: formatDecimal(formTotals.orderDiscountTotal),
                      before: formatDecimal(
                        formTotals.grand - formTotals.orderDiscountTotal
                      ),
                    })}
                  </span>
                )}
                {roundToWhole && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {t("formModal.footer.roundedWhole")}
                  </span>
                )}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {t("formModal.footer.grandTotal", {
                    amount: formatDecimal(roundDecimal(formTotal, 2)),
                  })}
                </span>
              </>
            ) : (
              <>
                {formTotals.orderDiscountTotal > 0 && (
                  <span className="text-sm text-[var(--color-warning-text)]">
                    {t("formModal.footer.orderDiscountOnly", {
                      discount: formatDecimal(formTotals.orderDiscountTotal),
                    })}
                  </span>
                )}
                {roundToWhole && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {t("formModal.footer.roundedWhole")}
                  </span>
                )}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {t("formModal.footer.total", {
                    amount: formatDecimal(roundDecimal(formTotal, 2)),
                  })}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center justify-end">
            <Button
              type="submit"
              form="invoice-form-modal"
              variant="secondary"
              disabled={isPending}
              data-action="save"
            >
              <Check size={20} className="mr-1.5" aria-hidden="true" />
              {t("formModal.footer.save")}
            </Button>
            <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <select
                className="input-base py-1 text-sm min-w-[7.5rem]"
                value={invoicePrintLocale}
                onChange={(e) =>
                  onInvoicePrintLocaleChange(e.target.value as SupportedLocale)
                }
                aria-label={t("formModal.printLanguage")}
                disabled={isPending}
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {t(`printLanguageOption.${loc}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              form="invoice-form-modal"
              disabled={isPending}
              data-action="print"
            >
              <Printer size={20} className="mr-1.5" aria-hidden="true" />
              {t("formModal.footer.saveAndPrint")}
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
            <FormField label={t("formModal.fields.invoiceNumber")}>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="input-base w-full"
              />
            </FormField>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)] col-span-2">
              {t("formModal.autoNumberHint")}
            </p>
          )}
          <FormField label={t("formModal.fields.date")} required>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input-base w-full"
              required
            />
          </FormField>
        </div>
        <FormField label={t("formModal.fields.customerPhone")}>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            onBlur={handlePhoneBlur}
            className="input-base w-full"
            placeholder={t("formModal.placeholders.customerPhone")}
          />
        </FormField>
        <FormField label={t("formModal.fields.customerName")}>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input-base w-full"
          />
        </FormField>
        <FormField label={t("formModal.fields.customerAddress")}>
          <textarea
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            className="input-base w-full resize-y"
            rows={2}
          />
        </FormField>
        {customerGstinEnabled && (
          <FormField label={t("formModal.fields.customerGstin")}>
            <input
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value)}
              className="input-base w-full"
              placeholder={t("formModal.placeholders.customerGstin")}
            />
          </FormField>
        )}
        <FormField label={t("formModal.fields.notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base w-full resize-y"
            rows={2}
            placeholder={t("formModal.placeholders.notes")}
          />
        </FormField>

        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[36rem]">
              {lines.length > 0 && (
                <div
                  className={`grid gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1 ml-2 ${gstEnabled ? "grid-cols-[10rem_5rem_5rem_6rem_6rem_5rem_1fr_5rem_2.5rem]" : "grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem]"}`}
                >
                  <span>{t("formModal.lineHeaders.product")}</span>
                  <span>{t("formModal.lineHeaders.qty")}</span>
                  <span>{t("formModal.lineHeaders.unit")}</span>
                  {gstEnabled && (
                    <>
                      <span>{t("formModal.lineHeaders.gstPercent")}</span>
                      <span>{t("formModal.lineHeaders.mode")}</span>
                    </>
                  )}
                  <span>{t("formModal.lineHeaders.type")}</span>
                  <span>{t("formModal.lineHeaders.amount")}</span>
                  <span>{t("formModal.lineHeaders.lineTotal")}</span>
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
                      ? (line.price ?? 0)
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
                      bogo_discount_percent: line.bogo_discount_percent ?? 100,
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
                    <div
                      key={line.id ?? line._key ?? idx}
                      className="space-y-0"
                    >
                      <div
                        className={`grid gap-3 items-center p-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm ${gstEnabled ? "grid-cols-[10rem_5rem_5rem_6rem_6rem_5rem_1fr_5rem_2.5rem]" : "grid-cols-[10rem_6rem_6rem_7rem_1fr_6rem_2.5rem]"}`}
                      >
                        <select
                          value={line.product_id || ""}
                          onChange={(e) =>
                            handleProductChange(idx, Number(e.target.value))
                          }
                          className="input-base w-full min-w-0"
                          aria-label={t("formModal.lineHeaders.product")}
                        >
                          <option value="">
                            {t("formModal.line.selectProduct")}
                          </option>
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
                          placeholder={t("formModal.placeholders.numericZero")}
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
                          aria-label={t("formModal.lineHeaders.qty")}
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
                          aria-label={t("formModal.lineHeaders.unit")}
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
                                      ? {
                                          ...p,
                                          gst_rate: Number(e.target.value),
                                        }
                                      : p
                                  )
                                )
                              }
                              className="input-base w-full text-sm min-w-0"
                              aria-label={t("formModal.lineHeaders.gstPercent")}
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
                              aria-label={t("formModal.lineHeaders.mode")}
                            >
                              <option value="exclusive">
                                {t("formModal.line.gstModeExclusive")}
                              </option>
                              <option value="inclusive">
                                {t("formModal.line.gstModeInclusive")}
                              </option>
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
                                        lineAmt > 0
                                          ? formatDecimal(lineAmt)
                                          : "";
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
                              title={t("formModal.line.priceTypeTitle")}
                              aria-label={t("formModal.lineHeaders.type")}
                            >
                              {lineUnits.length > 0 ? (
                                lineUnits.map((u) => (
                                  <option key={u.id} value={u.name}>
                                    {t("formModal.line.perUnit", {
                                      unit: u?.symbol?.trim() || u.name,
                                    })}
                                  </option>
                                ))
                              ) : (
                                <option value={line.priceUnit || ""}>
                                  {t("formModal.line.perUnit", {
                                    unit:
                                      unitToShort(line.priceUnit, allUnits) ||
                                      t("formModal.line.unitFallbackWord"),
                                  })}
                                </option>
                              )}
                              <option value="total">
                                {t("formModal.line.totalMode")}
                              </option>
                            </select>
                          );
                        })()}
                        {line.priceMode === "per_unit" ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder={t(
                                "formModal.placeholders.numericZero"
                              )}
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
                              aria-label={t("formModal.lineHeaders.amount")}
                            />
                            <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                              ₹{formatDecimal(lineTotal)}
                              {lineGst && line.gst_rate > 0 && (
                                <span className="block text-[10px] text-[var(--color-text-tertiary)]">
                                  {t("formModal.line.taxParenthetical", {
                                    amount: formatDecimal(
                                      lineGst.cgst_amount + lineGst.sgst_amount
                                    ),
                                  })}
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
                              placeholder={t(
                                "formModal.placeholders.numericZero"
                              )}
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
                              title={t("formModal.line.lineTotalTitle")}
                              aria-label={t("formModal.lineHeaders.lineTotal")}
                            />
                            <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                              ₹{formatDecimal(lineTotal)}
                              {lineGst && line.gst_rate > 0 && (
                                <span className="block text-[10px] text-[var(--color-text-tertiary)]">
                                  {t("formModal.line.taxParenthetical", {
                                    amount: formatDecimal(
                                      lineGst.cgst_amount + lineGst.sgst_amount
                                    ),
                                  })}
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
                          aria-label={t("formModal.line.removeLineAria")}
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
                              <span className="text-[var(--color-text-secondary)]">
                                {t("formModal.discounts.percentOff")}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={(line.line_discount_percent ?? 0) || ""}
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
                              <span className="text-[var(--color-text-secondary)]">
                                {t("formModal.discounts.rsOff")}
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={(line.line_discount_flat ?? 0) || ""}
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
                                <span className="text-[var(--color-text-secondary)]">
                                  {t("formModal.discounts.bogoBuy")}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  placeholder="—"
                                  value={
                                    (line.bogo_buy_qty ?? "") === ""
                                      ? ""
                                      : (line.bogo_buy_qty ?? "")
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
                                <span className="text-[var(--color-text-secondary)]">
                                  {t("formModal.discounts.bogoGet")}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  placeholder="—"
                                  value={
                                    (line.bogo_get_qty ?? "") === ""
                                      ? ""
                                      : (line.bogo_get_qty ?? "")
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
                {t("formModal.addItem")}
              </Button>
            </div>
          </div>
        </div>

        {(discountPctEnabled ||
          discountFlatEnabled ||
          discountCouponEnabled ||
          discountTieredEnabled) && (
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-warning-subtle)]/50 p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("formModal.orderDiscountsTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {discountPctEnabled && (
                <FormField label={t("formModal.orderPercentOff")}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={orderDiscountPercent || ""}
                    onChange={(e) =>
                      setOrderDiscountPercent(Number(e.target.value) || 0)
                    }
                    className="input-base w-full"
                    placeholder={t("formModal.placeholders.orderDiscount")}
                  />
                </FormField>
              )}
              {discountFlatEnabled && (
                <FormField label={t("formModal.orderFlatOff")}>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={orderDiscountFlat || ""}
                    onChange={(e) =>
                      setOrderDiscountFlat(Number(e.target.value) || 0)
                    }
                    className="input-base w-full"
                    placeholder={t("formModal.placeholders.orderDiscount")}
                  />
                </FormField>
              )}
              {discountCouponEnabled && (
                <div className="col-span-2 flex gap-2 items-end">
                  <FormField
                    label={t("formModal.couponCode")}
                    extra={
                      appliedCoupon ? (
                        <span className="text-xs text-[var(--color-success)]">
                          {t("formModal.couponAppliedExtra", {
                            code: appliedCoupon.code,
                            discountText:
                              appliedCoupon.discount_type === "percent"
                                ? t("formModal.couponDiscountPercent", {
                                    value: appliedCoupon.discount_value,
                                  })
                                : t("formModal.couponDiscountFlat", {
                                    value: formatDecimal(
                                      appliedCoupon.discount_value
                                    ),
                                  }),
                          })}
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
                      placeholder={t("formModal.placeholders.couponCode")}
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
                            toast.error(t("toasts.invalidCoupon"));
                          }
                        })
                        .catch(() =>
                          toast.error(t("toasts.couponValidationFailed"))
                        );
                    }}
                    {...(appliedCoupon
                      ? {
                          "aria-label": t("formModal.footer.remove"),
                          title: t("formModal.footer.remove"),
                        }
                      : {})}
                  >
                    {appliedCoupon ? (
                      <Trash2 size={16} aria-hidden="true" />
                    ) : (
                      t("formModal.footer.apply")
                    )}
                  </Button>
                </div>
              )}
            </div>
            {discountTieredEnabled &&
              tieredRules.length > 0 &&
              formTotals.orderDiscBreakdown.tieredAmount > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("formModal.tieredDiscountHint")}
                </p>
              )}
          </div>
        )}
      </form>
    </FormModal>
  );
}
