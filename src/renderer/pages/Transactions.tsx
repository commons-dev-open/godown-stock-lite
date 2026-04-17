import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
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
import FormModal from "../components/FormModal";
import { PAGE_SIZE } from "../../shared/constants";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import TransactionTypeBadge, {
  type TransactionType,
} from "../components/TransactionTypeBadge";
import DataTable from "../components/DataTable";
import AddLendModal from "../components/AddLendModal";
import AddDepositModal from "../components/AddDepositModal";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import {
  exportTransactionsToCsv,
  exportTransactionsToPdf,
  getPrintTableBody,
  type TransactionExportRow,
} from "../lib/exportTransactions";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import {
  type LenderLedgerPageRow,
  toLendRecord,
  toDepositRecord,
  toPurchaseRecord,
} from "../lib/lenderLedgerRow";
import {
  type ModalFieldDiffRow,
  MODAL_FIELD_DIFF_COLUMNS,
  type ModalKVRow,
  MODAL_KV_COLUMNS,
} from "../lib/modalTableColumns";
import {
  Download,
  Banknote,
  FileDown,
  Filter,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import Button from "../components/Button";
import type {
  Item,
  MahajanLend,
  MahajanDeposit,
  CreditPurchase,
  Settlement,
  Purchase,
} from "../../shared/types";
import {
  formatDecimal,
  formatAbbreviatedInteger,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  SalesListHero,
  SalesListSectionPanel,
  SalesListAsyncPanel,
} from "../components/sales-list-page";

type PurchaseRow = Purchase & { product_name?: string };
type PurchaseLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  amount: number;
};

const emptyPurchaseLine = (): PurchaseLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
  amount: 0,
});

function amountColorClass(type: string): string {
  if (type === "credit_purchase" || type === "lend")
    return "text-[var(--color-warning-text)]";
  if (type === "settlement" || type === "deposit")
    return "text-[var(--color-success)]";
  if (type === "cash_purchase") return "text-[var(--color-accent)]";
  return "text-[var(--color-text-primary)]";
}

function buildDeleteConfirmModalRows(p: {
  type: "credit_purchase" | "settlement" | "cash_purchase";
  row: LenderLedgerPageRow;
}): ModalKVRow[] {
  const rows: ModalKVRow[] = [
    {
      id: 1,
      fieldLabel: "Type",
      value: <TransactionTypeBadge type={p.type as TransactionType} />,
    },
    {
      id: 2,
      fieldLabel: "Date",
      value: formatDateForView(p.row.transaction_date),
    },
  ];
  let nextId = 3;
  if (p.type === "credit_purchase" || p.type === "cash_purchase") {
    if (p.type === "credit_purchase") {
      rows.push({
        id: nextId++,
        fieldLabel: "Lender",
        value: p.row.lender_name ?? p.row.mahajan_name ?? "—",
      });
    }
    rows.push(
      {
        id: nextId++,
        fieldLabel: "Product",
        value: p.row.product_name ?? "—",
      },
      {
        id: nextId++,
        fieldLabel: "Quantity",
        value: p.row.quantity ?? "—",
      }
    );
  }
  rows.push(
    {
      id: nextId++,
      fieldLabel: "Amount (₹)",
      value: formatDecimal(p.row.amount),
    },
    {
      id: nextId++,
      fieldLabel: "Notes",
      value: p.row.notes ?? "—",
    }
  );
  return rows;
}

interface CashPurchasePreviewRow {
  id: number;
  product: string;
  oldStock: number;
  qty: number;
  totalAfter: number;
  amountDisplay: string;
}

const CASH_PURCHASE_PREVIEW_COLUMNS = [
  { key: "product", label: "Product" },
  {
    key: "oldStock",
    label: "Old stock",
    render: (r: CashPurchasePreviewRow) => (
      <span className="block text-right tabular-nums">{r.oldStock}</span>
    ),
  },
  {
    key: "qty",
    label: "Qty",
    render: (r: CashPurchasePreviewRow) => (
      <span className="block text-right tabular-nums">{r.qty}</span>
    ),
  },
  {
    key: "totalAfter",
    label: "Total after",
    render: (r: CashPurchasePreviewRow) => (
      <span className="block text-right tabular-nums">{r.totalAfter}</span>
    ),
  },
  {
    key: "amountDisplay",
    label: "Amount (₹)",
    render: (r: CashPurchasePreviewRow) => (
      <span className="block text-right tabular-nums">{r.amountDisplay}</span>
    ),
  },
];

export default function Transactions() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const appName = getAppDisplayName(settings);
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const [lendOpen, setLendOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [editingLend, setEditingLend] = useState<MahajanLend | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<MahajanDeposit | null>(
    null
  );
  const [filterMahajanId, setFilterMahajanId] = useState<number | "">("");
  const [filterType, setFilterType] = useState<
    "all" | "credit_purchase" | "settlement" | "cash_purchase"
  >("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [purchaseAddOpen, setPurchaseAddOpen] = useState(false);
  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [confirmPurchasePayload, setConfirmPurchasePayload] = useState<{
    transaction_date: string;
    notes: string;
    lines: PurchaseLine[];
  } | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRow | null>(
    null
  );
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    emptyPurchaseLine(),
  ]);
  const [confirmEditLendOpen, setConfirmEditLendOpen] = useState(false);
  const [confirmEditLendPayload, setConfirmEditLendPayload] = useState<{
    record: MahajanLend;
    newValues: {
      mahajan_id: number;
      mahajanName: string;
      transaction_date: string;
      product_id: number | null;
      product_name: string | null;
      quantity: number;
      amount: number;
      notes: string | null;
    };
  } | null>(null);
  const [confirmEditDepositOpen, setConfirmEditDepositOpen] = useState(false);
  const [confirmEditDepositPayload, setConfirmEditDepositPayload] = useState<{
    record: MahajanDeposit;
    newValues: {
      transaction_date: string;
      amount: number;
      notes: string | null;
    };
  } | null>(null);
  const [confirmEditPurchaseOpen, setConfirmEditPurchaseOpen] = useState(false);
  const [confirmEditPurchasePayload, setConfirmEditPurchasePayload] = useState<{
    record: PurchaseRow;
    newValues: {
      transaction_date: string;
      quantity: number;
      amount: number;
      notes: string | null;
    };
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPayload, setDeleteConfirmPayload] = useState<{
    type: "credit_purchase" | "settlement" | "cash_purchase";
    row: LenderLedgerPageRow;
  } | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
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

  const [editLendDate, setEditLendDate] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");
  const [purchaseFormDate, setPurchaseFormDate] = useState(todayISO());
  const [editPurchaseDate, setEditPurchaseDate] = useState("");

  useEffect(() => {
    if (editingLend)
      queueMicrotask(() => setEditLendDate(editingLend.transaction_date));
  }, [editingLend]);
  const [editLendProductId, setEditLendProductId] = useState<number | null>(
    null
  );
  const [editLendMahajanId, setEditLendMahajanId] = useState<number | "">("");
  const [editLendQuantity, setEditLendQuantity] = useState<number>(0);
  const [editLendAmount, setEditLendAmount] = useState<number>(0);
  const [editLendNotes, setEditLendNotes] = useState("");
  useEffect(() => {
    if (editingLend) {
      const e = editingLend;
      queueMicrotask(() => {
        setEditLendProductId(e.product_id ?? null);
        setEditLendMahajanId(e.lender_id);
        setEditLendQuantity(e.quantity ?? 0);
        setEditLendAmount(e.amount);
        setEditLendNotes(e.notes ?? "");
      });
    }
  }, [editingLend]);
  useEffect(() => {
    if (editingDeposit)
      queueMicrotask(() => setEditDepositDate(editingDeposit.transaction_date));
  }, [editingDeposit]);
  const [editDepositAmount, setEditDepositAmount] = useState<number>(0);
  const [editDepositNotes, setEditDepositNotes] = useState("");
  useEffect(() => {
    if (editingDeposit) {
      const e = editingDeposit;
      queueMicrotask(() => {
        setEditDepositAmount(e.amount);
        setEditDepositNotes(e.notes ?? "");
      });
    }
  }, [editingDeposit]);
  useEffect(() => {
    if (purchaseAddOpen) queueMicrotask(() => setPurchaseFormDate(todayISO()));
  }, [purchaseAddOpen]);
  useEffect(() => {
    if (editingPurchase)
      queueMicrotask(() =>
        setEditPurchaseDate(editingPurchase.transaction_date)
      );
  }, [editingPurchase]);
  const [editPurchaseQuantity, setEditPurchaseQuantity] = useState<number>(0);
  const [editPurchaseAmount, setEditPurchaseAmount] = useState<number>(0);
  const [editPurchaseNotes, setEditPurchaseNotes] = useState("");
  useEffect(() => {
    if (editingPurchase) {
      const e = editingPurchase;
      queueMicrotask(() => {
        setEditPurchaseQuantity(e.quantity);
        setEditPurchaseAmount(e.amount);
        setEditPurchaseNotes(e.notes ?? "");
      });
    }
  }, [editingPurchase]);

  const { data: mahajans = [] } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const {
    data: ledgerPage,
    isLoading: ledgerLoading,
    isError: ledgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: [
      "mahajanLedger",
      filterMahajanId || null,
      filterType,
      filterDateFrom,
      filterDateTo,
      page,
    ],
    queryFn: () =>
      api.getMahajanLedgerPage({
        mahajanId:
          filterType === "cash_purchase"
            ? null
            : filterMahajanId === ""
              ? null
              : filterMahajanId,
        transactionType: filterType,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: LenderLedgerPageRow[]; total: number }>,
  });
  const unifiedRows = ledgerPage?.data ?? [];
  const totalLedger = ledgerPage?.total ?? 0;

  const editReviewLenderId =
    confirmEditLendOpen && confirmEditLendPayload
      ? (confirmEditLendPayload.newValues.mahajan_id ??
        (confirmEditLendPayload.record as CreditPurchase).lender_id)
      : confirmEditDepositOpen && confirmEditDepositPayload
        ? (confirmEditDepositPayload.record as Settlement).lender_id
        : null;
  const { data: editReviewBalance, isFetching: editReviewBalanceLoading } =
    useQuery({
      queryKey: ["mahajanBalance", editReviewLenderId],
      queryFn: () => api.getMahajanBalance(editReviewLenderId!),
      enabled:
        !!editReviewLenderId && (confirmEditLendOpen || confirmEditDepositOpen),
    });

  const deleteReviewMahajanId =
    deleteConfirmOpen &&
    deleteConfirmPayload &&
    (deleteConfirmPayload.type === "credit_purchase" ||
      deleteConfirmPayload.type === "settlement")
      ? (deleteConfirmPayload.row.lender_id ??
        deleteConfirmPayload.row.mahajan_id)
      : null;
  const { data: deleteReviewBalance, isFetching: deleteReviewBalanceLoading } =
    useQuery({
      queryKey: ["mahajanBalance", deleteReviewMahajanId],
      queryFn: () => api.getMahajanBalance(deleteReviewMahajanId!),
      enabled:
        !!deleteReviewMahajanId &&
        deleteConfirmOpen &&
        deleteConfirmPayload != null,
    });

  const updateLend = useMutation({
    mutationFn: ({
      id,
      l,
    }: {
      id: number;
      l: {
        mahajan_id?: number;
        product_id?: number | null;
        product_name?: string;
        quantity?: number;
        transaction_date?: string;
        amount?: number;
        notes?: string;
      };
    }) => api.updateMahajanLend(id, l),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setEditingLend(null);
      toast.success("Credit purchase updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update credit purchase"),
  });

  const updateDeposit = useMutation({
    mutationFn: ({
      id,
      d,
    }: {
      id: number;
      d: { transaction_date?: string; amount?: number; notes?: string };
    }) => api.updateMahajanDeposit(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      setEditingDeposit(null);
      toast.success("Settlement updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update settlement"),
  });

  const deleteLend = useMutation({
    mutationFn: (id: number) => api.deleteMahajanLend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      toast.success("Credit purchase deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete credit purchase"),
  });

  const deleteDeposit = useMutation({
    mutationFn: (id: number) => api.deleteMahajanDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      toast.success("Settlement deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete settlement"),
  });

  const createPurchaseBatch = useMutation({
    mutationFn: (payload: {
      transaction_date: string;
      notes?: string;
      lines: { product_id: number; quantity: number; amount: number }[];
    }) => api.createPurchaseBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      setPurchaseAddOpen(false);
      setConfirmPurchaseOpen(false);
      setConfirmPurchasePayload(null);
      setPurchaseLines([emptyPurchaseLine()]);
      toast.success("Cash purchases saved");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to save cash purchases"),
  });

  const updatePurchase = useMutation({
    mutationFn: ({
      id,
      p,
    }: {
      id: number;
      p: {
        transaction_date?: string;
        quantity?: number;
        amount?: number;
        notes?: string;
      };
    }) => api.updatePurchase(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      setEditingPurchase(null);
    },
  });

  const deletePurchase = useMutation({
    mutationFn: (id: number) => api.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
    },
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const itemList = items as Item[];

  const appliedFilters = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (filterMahajanId !== "") {
      const m = mahajanList.find((x) => x.id === filterMahajanId);
      list.push({
        label: "Lender",
        value: m?.name ?? String(filterMahajanId),
      });
    }
    if (filterType !== "all") list.push({ label: "Type", value: filterType });
    if (filterDateFrom)
      list.push({ label: "Date From", value: filterDateFrom });
    if (filterDateTo) list.push({ label: "Date To", value: filterDateTo });
    return list;
  }, [filterMahajanId, filterType, filterDateFrom, filterDateTo, mahajanList]);

  async function getExportData(): Promise<TransactionExportRow[]> {
    const result = (await api.getMahajanLedgerPage({
      mahajanId:
        filterType === "cash_purchase"
          ? null
          : filterMahajanId === ""
            ? null
            : filterMahajanId,
      transactionType: filterType,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      page: 1,
      limit: 999999,
    })) as { data: LenderLedgerPageRow[]; total: number };
    const rows = result?.data ?? [];
    return rows.map((row) => {
      const item =
        row.product_id != null
          ? itemList.find((i) => i.id === row.product_id)
          : undefined;
      return {
        type: row.type,
        transaction_date: row.transaction_date,
        mahajan_name: row.lender_name ?? row.mahajan_name ?? null,
        product_name: row.product_name,
        quantity: row.quantity,
        unit: item?.unit ?? "—",
        amount: row.amount,
        notes: row.notes,
        payment_method: row.payment_method ?? null,
        reference_number: row.reference_number ?? null,
      };
    });
  }

  async function handleExportCsv() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportTransactionsToCsv(data, appliedFilters);
    toast.success("Exported as CSV.");
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportTransactionsToPdf(data, appliedFilters, appName);
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
    document.title = `Transactions_${formatDateForFile(new Date())}`;
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

  const handleFilterChange = (updates: {
    mahajanId?: number | "";
    type?: "all" | "credit_purchase" | "settlement" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (updates.mahajanId !== undefined) setFilterMahajanId(updates.mahajanId);
    if (updates.type !== undefined) setFilterType(updates.type);
    if (updates.dateFrom !== undefined) setFilterDateFrom(updates.dateFrom);
    if (updates.dateTo !== undefined) setFilterDateTo(updates.dateTo);
    setPage(1);
  };

  const clearLedgerFilters = useCallback(() => {
    setFilterMahajanId("");
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  }, []);

  const ledgerHasActiveFilters = appliedFilters.length > 0;
  const isLedgerEmpty =
    !ledgerLoading && !ledgerError && unifiedRows.length === 0;

  const ledgerCountBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {formatAbbreviatedInteger(totalLedger, abbreviationStyle)}
    </span>
  );

  const ledgerColumns = useMemo(
    () => [
      {
        key: "type",
        label: "Type",
        render: (row: LenderLedgerPageRow) => (
          <TransactionTypeBadge type={row.type as TransactionType} />
        ),
      },
      {
        key: "transaction_date",
        label: "Date",
        render: (row: LenderLedgerPageRow) => (
          <Tooltip content={formatDateForForm(row.transaction_date)}>
            <span>{formatDateForView(row.transaction_date)}</span>
          </Tooltip>
        ),
      },
      {
        key: "lender",
        label: "Lender",
        render: (row: LenderLedgerPageRow) =>
          (row.lender_id ?? row.mahajan_id) == null ? (
            <span className="font-medium text-[var(--color-text-primary)]">
              {row.lender_name ?? row.mahajan_name ?? "—"}
            </span>
          ) : (
            <Link
              to={`/mahajans/ledger/${row.lender_id ?? row.mahajan_id}`}
              className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
            >
              {row.lender_name ?? row.mahajan_name ?? "—"}
            </Link>
          ),
      },
      {
        key: "product_name",
        label: "Product",
        render: (row: LenderLedgerPageRow) => (
          <span className="text-[var(--color-text-secondary)]">
            {row.type === "settlement" || row.type === "deposit"
              ? "—"
              : (row.product_name ?? "—")}
          </span>
        ),
      },
      {
        key: "quantity",
        label: "Qty",
        render: (row: LenderLedgerPageRow) => (
          <span className="block text-right text-[var(--color-text-primary)]">
            {row.type === "settlement" || row.type === "deposit"
              ? "—"
              : row.quantity != null
                ? String(row.quantity)
                : "—"}
          </span>
        ),
      },
      {
        key: "unit",
        label: "Unit",
        render: (row: LenderLedgerPageRow) => {
          if (row.type === "settlement" || row.type === "deposit") {
            return (
              <span className="text-[var(--color-text-secondary)]">—</span>
            );
          }
          if (row.product_id != null) {
            const item = (items as Item[]).find((i) => i.id === row.product_id);
            return (
              <span className="text-[var(--color-text-secondary)]">
                {item?.unit ?? "—"}
              </span>
            );
          }
          return <span className="text-[var(--color-text-secondary)]">—</span>;
        },
      },
      {
        key: "amount",
        label: "Amount (₹)",
        render: (row: LenderLedgerPageRow) => (
          <span
            className={`block text-right text-sm font-medium ${amountColorClass(row.type)}`}
          >
            ₹{formatDecimal(row.amount)}
          </span>
        ),
      },
      {
        key: "notes",
        label: "Notes",
        render: (row: LenderLedgerPageRow) => (
          <div
            className="max-w-[12rem] text-sm text-[var(--color-text-secondary)]"
            title={row.notes ?? ""}
          >
            <span className="block truncate">{row.notes ?? "—"}</span>
            {row.type === "credit_purchase" &&
              (row.lender_invoice_number || row.invoice_file_path) && (
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {row.lender_invoice_number && (
                    <span>#{row.lender_invoice_number}</span>
                  )}
                  {row.invoice_file_path && (
                    <button
                      type="button"
                      onClick={() =>
                        api.openCreditPurchaseInvoice(row.invoice_file_path!)
                      }
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      View invoice
                    </button>
                  )}
                </span>
              )}
            {(row.type === "settlement" || row.type === "deposit") &&
              (row.payment_method || row.reference_number) && (
                <span className="mt-1 block text-xs text-[var(--color-text-tertiary)]">
                  {row.payment_method && (
                    <span className="capitalize">{row.payment_method}</span>
                  )}
                  {row.payment_method && row.reference_number && " · "}
                  {row.reference_number && (
                    <span title={row.reference_number}>
                      {row.reference_number.length > 12
                        ? `${row.reference_number.slice(0, 10)}…`
                        : row.reference_number}
                    </span>
                  )}
                </span>
              )}
          </div>
        ),
      },
    ],
    [items, api]
  );

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <SalesListHero
        title="Transactions"
        metrics={[]}
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
            <Button
              variant="primary"
              onClick={() => setPurchaseAddOpen(true)}
              className="!bg-[var(--color-accent)] hover:!bg-[var(--color-accent-hover)]"
            >
              <Banknote size={20} className="mr-1.5" aria-hidden="true" />
              Cash Purchase
            </Button>
            <Button variant="amber" onClick={() => setLendOpen(true)}>
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              Add Credit Purchase
            </Button>
            <Button variant="green" onClick={() => setDepositOpen(true)}>
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              Add Settlement
            </Button>
          </>
        }
      />
      <DashboardSectionBoundary
        sectionTitle="Transaction ledger"
        containerClassName="dashboard-panel"
        resetKeys={[
          filterMahajanId,
          filterType,
          filterDateFrom,
          filterDateTo,
          page,
          ledgerLoading,
          ledgerError,
          unifiedRows.length,
        ]}
      >
        <SalesListSectionPanel
          title="Ledger"
          description="Credit purchases, settlements, and cash purchases appear here with the latest first within your filters."
          badge={ledgerCountBadge}
        >
          <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] overflow-hidden">
            <select
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] shrink-0 min-w-0"
              value={filterType}
              onChange={(e) =>
                handleFilterChange({
                  type: e.target.value as
                    | "all"
                    | "credit_purchase"
                    | "settlement"
                    | "cash_purchase",
                })
              }
            >
              <option value="all">
                All (Credit Purchase + Settlement + Cash purchase)
              </option>
              <option value="credit_purchase">Credit Purchase only</option>
              <option value="settlement">Settlement only</option>
              <option value="cash_purchase">Cash purchase only</option>
            </select>
            <select
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] shrink-0 min-w-0"
              value={filterMahajanId}
              onChange={(e) =>
                handleFilterChange({
                  mahajanId: e.target.value ? Number(e.target.value) : "",
                })
              }
              disabled={filterType === "cash_purchase"}
            >
              <option value="">All Lenders</option>
              {mahajanList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMoreFiltersOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-surface-raised)]"
            >
              <Filter size={16} aria-hidden="true" />
              More filters
              {(filterDateFrom || filterDateTo) && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent)] rounded">
                  1
                </span>
              )}
            </button>
          </div>

          {moreFiltersOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMoreFiltersOpen(false)}
                aria-hidden
              />
              <div className="relative bg-[var(--color-bg-surface)] rounded-lg shadow-xl w-full mx-4 max-w-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">More filters</h2>
                  <button
                    type="button"
                    onClick={() => setMoreFiltersOpen(false)}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] rounded transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <label
                    htmlFor="more-filters-date-from"
                    className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
                  >
                    From date
                    <DateInput
                      id="more-filters-date-from"
                      value={filterDateFrom}
                      onChange={(v) => handleFilterChange({ dateFrom: v })}
                      className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                    />
                  </label>
                  <label
                    htmlFor="more-filters-date-to"
                    className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
                  >
                    To date
                    <DateInput
                      id="more-filters-date-to"
                      value={filterDateTo}
                      onChange={(v) => handleFilterChange({ dateTo: v })}
                      className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                    />
                  </label>
                  {(filterMahajanId !== "" ||
                    filterType !== "all" ||
                    filterDateFrom ||
                    filterDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange({
                          mahajanId: "",
                          type: "all",
                          dateFrom: "",
                          dateTo: "",
                        });
                        setMoreFiltersOpen(false);
                      }}
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline self-start"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <SalesListAsyncPanel
              isLoading={ledgerLoading}
              isError={ledgerError}
              onRetry={() => {
                void refetchLedger();
              }}
              isEmpty={isLedgerEmpty}
              emptyTitle={
                ledgerHasActiveFilters
                  ? "No matching transactions"
                  : "No transactions yet"
              }
              emptyDescription={
                ledgerHasActiveFilters
                  ? "Try clearing filters or widening the date range."
                  : "Record cash purchases, credit purchases from lenders, or settlement payments. Use the buttons in the header to add an entry."
              }
              emptyActionLabel={
                ledgerHasActiveFilters ? "Clear filters" : "Cash purchase"
              }
              onEmptyAction={
                ledgerHasActiveFilters
                  ? clearLedgerFilters
                  : () => setPurchaseAddOpen(true)
              }
              emptySecondaryLabel={
                ledgerHasActiveFilters ? "Cash purchase" : "Credit purchase"
              }
              onEmptySecondary={
                ledgerHasActiveFilters
                  ? () => setPurchaseAddOpen(true)
                  : () => setLendOpen(true)
              }
              loaderColumns={9}
            >
              <DataTable<LenderLedgerPageRow>
                scrollMaxHeight={`calc(100vh - 20.5rem)`}
                columns={ledgerColumns}
                data={unifiedRows}
                getRowKey={(r) => `${r.type}-${r.id}`}
                tableClassName="min-w-full divide-y divide-[var(--color-border-default)]"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                alwaysShowRowActions
                extraActions={(row) => (
                  <span className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          row.type === "credit_purchase" ||
                          row.type === "lend"
                        ) {
                          setEditingLend(toLendRecord(row));
                        } else if (
                          row.type === "settlement" ||
                          row.type === "deposit"
                        ) {
                          setEditingDeposit(toDepositRecord(row));
                        } else {
                          setEditingPurchase(toPurchaseRecord(row));
                        }
                      }}
                      className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmPayload({
                          type: row.type as
                            | "credit_purchase"
                            | "settlement"
                            | "cash_purchase",
                          row,
                        });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </span>
                )}
                pagination={{
                  type: "controlled",
                  page,
                  total: totalLedger,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </SalesListAsyncPanel>
          </div>
        </SalesListSectionPanel>
      </DashboardSectionBoundary>

      <AddLendModal open={lendOpen} onClose={() => setLendOpen(false)} />

      <AddDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
      />

      <FormModal
        title="Edit Credit Purchase"
        open={!!editingLend && !confirmEditLendOpen}
        onClose={() => {
          setEditingLend(null);
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-3xl"
        footer={
          editingLend ? (
            <>
              <Button
                type="submit"
                form="transactions-edit-lend-form"
                variant="amber"
              >
                Review &amp; Update
              </Button>
            </>
          ) : undefined
        }
      >
        {editingLend && (
          <form
            id="transactions-edit-lend-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const mahajanId =
                editLendMahajanId === "" ? 0 : Number(editLendMahajanId);
              const productId = editLendProductId;
              const item = productId
                ? itemList.find((i) => i.id === productId)
                : undefined;
              if (!editLendDate || !mahajanId) return;
              const mahajan = mahajanList.find((m) => m.id === mahajanId);
              setConfirmEditLendPayload({
                record: editingLend,
                newValues: {
                  mahajan_id: mahajanId,
                  mahajanName: mahajan?.name ?? "",
                  transaction_date: editLendDate,
                  product_id: productId || null,
                  product_name: item?.name ?? editingLend.product_name ?? null,
                  quantity: editLendQuantity,
                  amount: editLendAmount,
                  notes: editLendNotes.trim() || null,
                },
              });
              setConfirmEditLendOpen(true);
            }}
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Lender *
              </label>
              <select
                name="mahajan_id"
                required
                className="w-full border rounded px-3 py-2"
                value={editLendMahajanId}
                onChange={(e) =>
                  setEditLendMahajanId(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
              >
                <option value="">Select</option>
                {mahajanList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editLendDate}
                onChange={setEditLendDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Product
              </label>
              <select
                name="product_id"
                className="w-full border rounded px-3 py-2"
                value={editLendProductId ?? ""}
                onChange={(e) =>
                  setEditLendProductId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">—</option>
                {itemList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Quantity
                {((): string => {
                  const it = (itemList as Item[]).find(
                    (i) => i.id === editLendProductId
                  );
                  return it?.unit ? ` (${it.unit})` : "";
                })()}
              </label>
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={editLendQuantity}
                onChange={(e) =>
                  setEditLendQuantity(Number(e.target.value) || 0)
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Amount *
              </label>
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={editLendAmount}
                onChange={(e) => setEditLendAmount(Number(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editLendNotes}
                onChange={(e) => setEditLendNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </form>
        )}
      </FormModal>

      <FormModal
        title="Review & Update Lend"
        open={confirmEditLendOpen}
        onClose={() => {
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmEditLendOpen(false);
                setConfirmEditLendPayload(null);
              }}
            >
              Back
            </Button>
            <Button
              variant="amber"
              onClick={() => {
                if (!confirmEditLendPayload) return;
                updateLend.mutate({
                  id: confirmEditLendPayload.record.id,
                  l: {
                    mahajan_id: confirmEditLendPayload.newValues.mahajan_id,
                    transaction_date:
                      confirmEditLendPayload.newValues.transaction_date,
                    product_id: confirmEditLendPayload.newValues.product_id,
                    product_name:
                      confirmEditLendPayload.newValues.product_name ??
                      undefined,
                    quantity: confirmEditLendPayload.newValues.quantity,
                    amount: confirmEditLendPayload.newValues.amount,
                    notes: confirmEditLendPayload.newValues.notes ?? undefined,
                  },
                });
                setConfirmEditLendOpen(false);
                setConfirmEditLendPayload(null);
                setEditingLend(null);
              }}
              disabled={updateLend.isPending}
            >
              {updateLend.isPending ? "Updating…" : "Confirm Update"}
            </Button>
          </>
        }
      >
        {confirmEditLendPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Summary of changes
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <DataTable<ModalFieldDiffRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_FIELD_DIFF_COLUMNS}
                data={[
                  {
                    id: 1,
                    fieldLabel: "Date",
                    current: formatDateForView(
                      confirmEditLendPayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditLendPayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: "Lender",
                    current:
                      mahajanList.find(
                        (m) => m.id === confirmEditLendPayload.record.lender_id
                      )?.name ?? "—",
                    after: confirmEditLendPayload.newValues.mahajanName,
                  },
                  {
                    id: 3,
                    fieldLabel: "Product",
                    current: confirmEditLendPayload.record.product_name ?? "—",
                    after: confirmEditLendPayload.newValues.product_name ?? "—",
                  },
                  {
                    id: 4,
                    fieldLabel: "Quantity",
                    current: confirmEditLendPayload.record.quantity ?? 0,
                    after: confirmEditLendPayload.newValues.quantity,
                  },
                  {
                    id: 5,
                    fieldLabel: "Amount (₹)",
                    current: formatDecimal(
                      confirmEditLendPayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditLendPayload.newValues.amount
                    ),
                  },
                  {
                    id: 6,
                    fieldLabel: "Notes",
                    current: confirmEditLendPayload.record.notes ?? "—",
                    after: confirmEditLendPayload.newValues.notes ?? "—",
                  },
                ]}
                pagination={{ type: "client" }}
                tableFrame={false}
              />
            </div>
            <div className="rounded border border-[var(--color-warning-subtle)] bg-[var(--color-warning-subtle)] p-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--color-warning-text)]">
                Impact after update
              </p>
              {(() => {
                const qtyDelta =
                  confirmEditLendPayload.newValues.quantity -
                  (confirmEditLendPayload.record.quantity ?? 0);
                if (
                  confirmEditLendPayload.record.product_id != null &&
                  qtyDelta === 0
                )
                  return null;
                return (
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>Stock:</strong>{" "}
                    {confirmEditLendPayload.record.product_id != null
                      ? (() => {
                          const item = (
                            items as { id: number; current_stock: number }[]
                          ).find(
                            (i) =>
                              i.id ===
                              confirmEditLendPayload!.record.product_id!
                          );
                          const oldStock = item?.current_stock ?? 0;
                          const newStock = oldStock + qtyDelta;
                          return (
                            <>
                              Current stock {oldStock} →{" "}
                              {qtyDelta >= 0 ? "+" : ""}
                              {qtyDelta} → <strong>{newStock}</strong> after
                              update
                            </>
                          );
                        })()
                      : "Product changed; stock impact applies to new product."}
                  </p>
                );
              })()}
              {editReviewBalanceLoading ? (
                <p className="text-[var(--color-text-tertiary)]">
                  Loading balance…
                </p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>Lender balance:</strong> Total Credit Purchase ₹
                    {formatDecimal(editReviewBalance.totalLends)}, Total
                    Deposits ₹{formatDecimal(editReviewBalance.totalDeposits)} →{" "}
                    <span
                      className={
                        editReviewBalance.balance >= 0
                          ? "font-medium text-[var(--color-warning-text)]"
                          : "font-medium text-[var(--color-success)]"
                      }
                    >
                      ₹{formatDecimal(Math.abs(editReviewBalance.balance))}
                      {editReviewBalance.balance > 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (payable)
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (receivable)
                        </span>
                      )}
                    </span>
                  </p>
                  {confirmEditLendPayload.newValues.amount -
                    confirmEditLendPayload.record.amount !==
                    0 &&
                    (() => {
                      const balanceAfter =
                        editReviewBalance.balance -
                        confirmEditLendPayload.record.amount +
                        confirmEditLendPayload.newValues.amount;
                      return (
                        <p
                          className={
                            balanceAfter >= 0
                              ? "font-medium text-[var(--color-warning-text)]"
                              : "font-medium text-[var(--color-success)]"
                          }
                        >
                          After this update: Total Credit Purchase will change
                          by ₹
                          {formatDecimal(
                            confirmEditLendPayload.newValues.amount -
                              confirmEditLendPayload.record.amount
                          )}{" "}
                          → Balance will be ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (payable)
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (receivable)
                            </span>
                          )}
                        </p>
                      );
                    })()}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Edit Settlement"
        open={!!editingDeposit && !confirmEditDepositOpen}
        onClose={() => {
          setEditingDeposit(null);
          setConfirmEditDepositOpen(false);
          setConfirmEditDepositPayload(null);
        }}
        footer={
          editingDeposit ? (
            <>
              <Button
                type="submit"
                form="transactions-edit-deposit-form"
                variant="green"
              >
                Review &amp; Update
              </Button>
            </>
          ) : undefined
        }
      >
        {editingDeposit && (
          <form
            id="transactions-edit-deposit-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editDepositDate) return;
              setConfirmEditDepositPayload({
                record: editingDeposit,
                newValues: {
                  transaction_date: editDepositDate,
                  amount: editDepositAmount,
                  notes: editDepositNotes.trim() || null,
                },
              });
              setConfirmEditDepositOpen(true);
            }}
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editDepositDate}
                onChange={setEditDepositDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Amount *
              </label>
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={editDepositAmount}
                onChange={(e) =>
                  setEditDepositAmount(Number(e.target.value) || 0)
                }
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editDepositNotes}
                onChange={(e) => setEditDepositNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </form>
        )}
      </FormModal>

      <FormModal
        title="Review & Update Deposit"
        open={confirmEditDepositOpen}
        onClose={() => {
          setConfirmEditDepositOpen(false);
          setConfirmEditDepositPayload(null);
        }}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmEditDepositOpen(false);
                setConfirmEditDepositPayload(null);
              }}
            >
              Back
            </Button>
            <Button
              variant="green"
              onClick={() => {
                if (!confirmEditDepositPayload) return;
                updateDeposit.mutate({
                  id: confirmEditDepositPayload.record.id,
                  d: {
                    transaction_date:
                      confirmEditDepositPayload.newValues.transaction_date,
                    amount: confirmEditDepositPayload.newValues.amount,
                    notes:
                      confirmEditDepositPayload.newValues.notes ?? undefined,
                  },
                });
                setConfirmEditDepositOpen(false);
                setConfirmEditDepositPayload(null);
                setEditingDeposit(null);
              }}
              disabled={updateDeposit.isPending}
            >
              {updateDeposit.isPending ? "Updating…" : "Confirm Update"}
            </Button>
          </>
        }
      >
        {confirmEditDepositPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Summary of changes
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <DataTable<ModalFieldDiffRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_FIELD_DIFF_COLUMNS}
                data={[
                  {
                    id: 1,
                    fieldLabel: "Date",
                    current: formatDateForView(
                      confirmEditDepositPayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditDepositPayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: "Amount (₹)",
                    current: formatDecimal(
                      confirmEditDepositPayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditDepositPayload.newValues.amount
                    ),
                  },
                  {
                    id: 3,
                    fieldLabel: "Notes",
                    current: confirmEditDepositPayload.record.notes ?? "—",
                    after: confirmEditDepositPayload.newValues.notes ?? "—",
                  },
                ]}
                pagination={{ type: "client" }}
                tableFrame={false}
              />
            </div>
            <div className="rounded border border-[var(--color-success-subtle)] bg-[var(--color-success-subtle)] p-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--color-success)]">
                Impact after update
              </p>
              {editReviewBalanceLoading ? (
                <p className="text-[var(--color-text-tertiary)]">
                  Loading balance…
                </p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>Lender balance:</strong> Total Credit Purchase ₹
                    {formatDecimal(editReviewBalance.totalLends)}, Total
                    Deposits ₹{formatDecimal(editReviewBalance.totalDeposits)} →{" "}
                    <span
                      className={
                        editReviewBalance.balance >= 0
                          ? "font-medium text-[var(--color-warning-text)]"
                          : "font-medium text-[var(--color-success)]"
                      }
                    >
                      ₹{formatDecimal(Math.abs(editReviewBalance.balance))}
                      {editReviewBalance.balance > 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (payable)
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (receivable)
                        </span>
                      )}
                    </span>
                  </p>
                  {confirmEditDepositPayload.newValues.amount -
                    confirmEditDepositPayload.record.amount !==
                    0 &&
                    (() => {
                      const balanceAfter =
                        editReviewBalance.balance +
                        confirmEditDepositPayload.record.amount -
                        confirmEditDepositPayload.newValues.amount;
                      return (
                        <p
                          className={
                            balanceAfter >= 0
                              ? "font-medium text-[var(--color-warning-text)]"
                              : "font-medium text-[var(--color-success)]"
                          }
                        >
                          After this update: Total Settlements will change by ₹
                          {formatDecimal(
                            confirmEditDepositPayload.newValues.amount -
                              confirmEditDepositPayload.record.amount
                          )}{" "}
                          → Balance will be ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (payable)
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (receivable)
                            </span>
                          )}
                        </p>
                      );
                    })()}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Cash Purchase"
        open={purchaseAddOpen}
        onClose={() => {
          setPurchaseAddOpen(false);
          setPurchaseLines([emptyPurchaseLine()]);
        }}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button
              type="submit"
              form="transactions-cash-purchase-form"
              variant="primary"
            >
              Review &amp; confirm
            </Button>
          </>
        }
      >
        <form
          id="transactions-cash-purchase-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            if (!purchaseFormDate) return;
            const notes = (form.notes as HTMLInputElement).value?.trim() || "";
            const lines: PurchaseLine[] = purchaseLines
              .map((_, idx) => {
                const productId = Number(
                  (form[`product_id_${idx}`] as HTMLSelectElement)?.value
                );
                const quantity = Number(
                  (form[`quantity_${idx}`] as HTMLInputElement)?.value
                );
                const amountRaw = (form[`amount_${idx}`] as HTMLInputElement)
                  ?.value;
                const amount =
                  amountRaw !== "" && amountRaw != null
                    ? Math.floor(Number(amountRaw))
                    : Number.NaN;
                const item = itemList.find((i) => i.id === productId);
                return productId &&
                  quantity > 0 &&
                  Number.isFinite(amount) &&
                  amount >= 0
                  ? {
                      product_id: productId,
                      product_name: item?.name ?? "",
                      quantity,
                      amount,
                    }
                  : null;
              })
              .filter((l): l is PurchaseLine => l != null);
            if (!lines.length) {
              toast.error(
                "Add at least one product with Qty and amount (integer)."
              );
              return;
            }
            setConfirmPurchasePayload({
              transaction_date: purchaseFormDate,
              notes,
              lines,
            });
            setConfirmPurchaseOpen(true);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={purchaseFormDate}
              onChange={setPurchaseFormDate}
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[32rem]">
                {purchaseLines.length > 0 && (
                  <div className="grid grid-cols-[12rem_6rem_4rem_8rem_2.5rem] gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Amount</span>
                    <span aria-hidden="true" />
                  </div>
                )}
                <div className="space-y-3">
                  {purchaseLines.map((line, idx) => {
                    const selectedItem = line.product_id
                      ? itemList.find((i) => i.id === line.product_id)
                      : undefined;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[12rem_6rem_4rem_8rem_2.5rem] gap-3 items-center p-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm"
                      >
                        <select
                          name={`product_id_${idx}`}
                          required={idx === 0}
                          value={line.product_id || ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            const item = itemList.find((i) => i.id === id);
                            setPurchaseLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                product_id: id,
                                product_name: item?.name ?? "",
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full min-w-0"
                          aria-label="Product"
                        >
                          <option value="">Select product</option>
                          {itemList.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name={`quantity_${idx}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={line.quantity === 0 ? "" : line.quantity}
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              n[idx] = {
                                ...n[idx],
                                quantity: Number(e.target.value) || 0,
                              };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label={
                            selectedItem?.unit
                              ? `Quantity (${selectedItem.unit})`
                              : "Quantity"
                          }
                        />
                        <span className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                          {selectedItem?.unit ?? "—"}
                        </span>
                        <input
                          name={`amount_${idx}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          required={idx === 0}
                          placeholder="0"
                          value={line.amount === 0 ? "" : line.amount}
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              const val =
                                Math.floor(Number(e.target.value)) || 0;
                              n[idx] = { ...n[idx], amount: val };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label="Amount"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseLines((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] text-xs font-medium py-1.5 px-2 rounded transition-colors inline-flex items-center gap-1 disabled:invisible"
                          aria-label="Remove line"
                          disabled={purchaseLines.length <= 1}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPurchaseLines((prev) => [...prev, emptyPurchaseLine()])
                  }
                  className="mt-3 !text-[var(--color-accent)] hover:!text-[var(--color-accent)] hover:!bg-transparent focus:outline-none focus:ring-0"
                >
                  <Plus size={20} className="mr-1.5" aria-hidden="true" />
                  Add item
                </Button>
              </div>
            </div>
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
        title="Confirm Cash Purchase"
        open={confirmPurchaseOpen}
        onClose={() => {
          setConfirmPurchaseOpen(false);
          setConfirmPurchasePayload(null);
        }}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmPurchaseOpen(false);
                setConfirmPurchasePayload(null);
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!confirmPurchasePayload) return;
                createPurchaseBatch.mutate({
                  transaction_date: confirmPurchasePayload.transaction_date,
                  notes: confirmPurchasePayload.notes || undefined,
                  lines: confirmPurchasePayload.lines.map((l) => ({
                    product_id: l.product_id,
                    quantity: l.quantity,
                    amount: l.amount,
                  })),
                });
              }}
              disabled={
                createPurchaseBatch.isPending || !confirmPurchasePayload
              }
            >
              {createPurchaseBatch.isPending ? "Saving…" : "Confirm"}
            </Button>
          </>
        }
      >
        {confirmPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Cash purchase on{" "}
              <Tooltip
                content={formatDateForForm(
                  confirmPurchasePayload.transaction_date
                )}
              >
                <strong>
                  {formatDateForView(confirmPurchasePayload.transaction_date)}
                </strong>
              </Tooltip>
              {confirmPurchasePayload.notes
                ? ` — ${confirmPurchasePayload.notes}`
                : ""}
            </p>
            <DataTable<CashPurchasePreviewRow>
              scrollMaxHeight="15rem"
              tableClassName="min-w-full text-sm border-collapse"
              rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
              columns={CASH_PURCHASE_PREVIEW_COLUMNS}
              data={confirmPurchasePayload.lines.map((line, idx) => {
                const item = (
                  items as {
                    id: number;
                    name: string;
                    current_stock: number;
                  }[]
                ).find((i) => i.id === line.product_id);
                const oldStock = item?.current_stock ?? 0;
                return {
                  id: idx + 1,
                  product: line.product_name || item?.name || "—",
                  oldStock,
                  qty: line.quantity,
                  totalAfter: oldStock + line.quantity,
                  amountDisplay: `₹${formatDecimal(line.amount)}`,
                };
              })}
              pagination={{ type: "client" }}
              tableFrame={false}
            />
            <p className="text-sm font-medium">
              Total amount: ₹
              {formatDecimal(
                confirmPurchasePayload.lines.reduce((s, l) => s + l.amount, 0)
              )}
            </p>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Edit Cash purchase"
        open={!!editingPurchase && !confirmEditPurchaseOpen}
        onClose={() => {
          setEditingPurchase(null);
          setConfirmEditPurchaseOpen(false);
          setConfirmEditPurchasePayload(null);
        }}
        footer={
          editingPurchase ? (
            <Button
              type="submit"
              form="transactions-edit-purchase-form"
              variant="primary"
            >
              Review &amp; Update
            </Button>
          ) : null
        }
      >
        {editingPurchase && (
          <form
            id="transactions-edit-purchase-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editPurchaseDate) return;
              setConfirmEditPurchasePayload({
                record: editingPurchase,
                newValues: {
                  transaction_date: editPurchaseDate,
                  quantity: editPurchaseQuantity,
                  amount: editPurchaseAmount,
                  notes: editPurchaseNotes.trim() || null,
                },
              });
              setConfirmEditPurchaseOpen(true);
            }}
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editPurchaseDate}
                onChange={setEditPurchaseDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Product
              </label>
              <input
                type="text"
                value={editingPurchase.product_name ?? ""}
                readOnly
                className="w-full border rounded px-3 py-2 bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Quantity *
                {((): string => {
                  const it = (itemList as Item[]).find(
                    (i) => i.id === editingPurchase.product_id
                  );
                  return it?.unit ? ` (${it.unit})` : "";
                })()}
              </label>
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={editPurchaseQuantity}
                onChange={(e) =>
                  setEditPurchaseQuantity(Number(e.target.value) || 0)
                }
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Amount *
              </label>
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={editPurchaseAmount}
                onChange={(e) =>
                  setEditPurchaseAmount(Number(e.target.value) || 0)
                }
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editPurchaseNotes}
                onChange={(e) => setEditPurchaseNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </form>
        )}
      </FormModal>

      <FormModal
        title="Review & Update Cash purchase"
        open={confirmEditPurchaseOpen}
        onClose={() => {
          setConfirmEditPurchaseOpen(false);
          setConfirmEditPurchasePayload(null);
        }}
        maxWidth="max-w-lg"
        footer={
          confirmEditPurchasePayload ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmEditPurchaseOpen(false);
                  setConfirmEditPurchasePayload(null);
                }}
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!confirmEditPurchasePayload) return;
                  updatePurchase.mutate({
                    id: confirmEditPurchasePayload.record.id,
                    p: {
                      transaction_date:
                        confirmEditPurchasePayload.newValues.transaction_date,
                      quantity: confirmEditPurchasePayload.newValues.quantity,
                      amount: confirmEditPurchasePayload.newValues.amount,
                      notes:
                        confirmEditPurchasePayload.newValues.notes ?? undefined,
                    },
                  });
                  setConfirmEditPurchaseOpen(false);
                  setConfirmEditPurchasePayload(null);
                  setEditingPurchase(null);
                }}
                disabled={updatePurchase.isPending}
              >
                {updatePurchase.isPending ? "Updating…" : "Confirm Update"}
              </Button>
            </>
          ) : null
        }
      >
        {confirmEditPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Summary of changes
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <DataTable<ModalFieldDiffRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_FIELD_DIFF_COLUMNS}
                data={[
                  {
                    id: 1,
                    fieldLabel: "Date",
                    current: formatDateForView(
                      confirmEditPurchasePayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditPurchasePayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: "Product",
                    current:
                      confirmEditPurchasePayload.record.product_name ?? "—",
                    after:
                      confirmEditPurchasePayload.record.product_name ?? "—",
                  },
                  {
                    id: 3,
                    fieldLabel: "Quantity",
                    current: confirmEditPurchasePayload.record.quantity,
                    after: confirmEditPurchasePayload.newValues.quantity,
                  },
                  {
                    id: 4,
                    fieldLabel: "Amount (₹)",
                    current: formatDecimal(
                      confirmEditPurchasePayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditPurchasePayload.newValues.amount
                    ),
                  },
                  {
                    id: 5,
                    fieldLabel: "Notes",
                    current: confirmEditPurchasePayload.record.notes ?? "—",
                    after: confirmEditPurchasePayload.newValues.notes ?? "—",
                  },
                ]}
                pagination={{ type: "client" }}
                tableFrame={false}
              />
            </div>
            <div className="rounded border border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)] p-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--color-accent)]">
                Impact after update
              </p>
              {(() => {
                const qtyDelta =
                  confirmEditPurchasePayload.newValues.quantity -
                  confirmEditPurchasePayload.record.quantity;
                if (qtyDelta === 0) return null;
                const item = (
                  items as { id: number; current_stock: number }[]
                ).find(
                  (i) => i.id === confirmEditPurchasePayload!.record.product_id!
                );
                const oldStock = item?.current_stock ?? 0;
                const newStock = oldStock + qtyDelta;
                return (
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>Stock:</strong> Current stock {oldStock} →{" "}
                    {qtyDelta >= 0 ? "+" : ""}
                    {qtyDelta} → <strong>{newStock}</strong> after update
                  </p>
                );
              })()}
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Review & Delete"
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteConfirmPayload(null);
        }}
        maxWidth="max-w-2xl"
        footer={
          deleteConfirmPayload ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmPayload(null);
                }}
              >
                Back
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!deleteConfirmPayload) return;
                  if (deleteConfirmPayload.type === "credit_purchase")
                    deleteLend.mutate(deleteConfirmPayload.row.id);
                  else if (deleteConfirmPayload.type === "settlement")
                    deleteDeposit.mutate(deleteConfirmPayload.row.id);
                  else deletePurchase.mutate(deleteConfirmPayload.row.id);
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmPayload(null);
                }}
                disabled={
                  deleteLend.isPending ||
                  deleteDeposit.isPending ||
                  deletePurchase.isPending
                }
              >
                {deleteLend.isPending ||
                deleteDeposit.isPending ||
                deletePurchase.isPending
                  ? "Deleting…"
                  : "Confirm Delete"}
              </Button>
            </>
          ) : null
        }
      >
        {deleteConfirmPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              You are about to delete this transaction. Summary:
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <DataTable<ModalKVRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_KV_COLUMNS}
                data={buildDeleteConfirmModalRows(deleteConfirmPayload)}
                pagination={{ type: "client" }}
                tableFrame={false}
              />
            </div>
            <div
              className={`rounded border p-3 space-y-2 text-sm ${
                deleteConfirmPayload.type === "credit_purchase"
                  ? "border-[var(--color-warning-subtle)] bg-[var(--color-warning-subtle)]"
                  : deleteConfirmPayload.type === "settlement"
                    ? "border-[var(--color-success-subtle)] bg-[var(--color-success-subtle)]"
                    : "border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]"
              }`}
            >
              <p
                className={`font-medium ${
                  deleteConfirmPayload.type === "credit_purchase"
                    ? "text-[var(--color-warning-text)]"
                    : deleteConfirmPayload.type === "settlement"
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-accent)]"
                }`}
              >
                Impact after delete
              </p>
              {(deleteConfirmPayload.type === "credit_purchase" ||
                deleteConfirmPayload.type === "cash_purchase") &&
                deleteConfirmPayload.row.product_id != null && (
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>Stock:</strong>{" "}
                    {(() => {
                      const item = (
                        items as { id: number; current_stock: number }[]
                      ).find(
                        (i) => i.id === deleteConfirmPayload!.row.product_id!
                      );
                      const oldStock = item?.current_stock ?? 0;
                      const qty = deleteConfirmPayload.row.quantity ?? 0;
                      const newStock = oldStock - qty;
                      return (
                        <>
                          Current stock {oldStock} → -{qty} →{" "}
                          <strong>{newStock}</strong> after delete
                        </>
                      );
                    })()}
                  </p>
                )}
              {(deleteConfirmPayload.type === "credit_purchase" ||
                deleteConfirmPayload.type === "settlement") && (
                <>
                  {deleteReviewBalanceLoading ? (
                    <p className="text-[var(--color-text-tertiary)]">
                      Loading balance…
                    </p>
                  ) : deleteReviewBalance != null ? (
                    <div className="space-y-1 text-[var(--color-text-secondary)]">
                      <p>
                        <strong>Lender balance:</strong> Total Credit Purchase ₹
                        {formatDecimal(deleteReviewBalance.totalLends)}, Total
                        Deposits ₹
                        {formatDecimal(deleteReviewBalance.totalDeposits)} →{" "}
                        <span
                          className={
                            deleteReviewBalance.balance >= 0
                              ? "font-medium text-[var(--color-warning-text)]"
                              : "font-medium text-[var(--color-success)]"
                          }
                        >
                          ₹
                          {formatDecimal(Math.abs(deleteReviewBalance.balance))}
                          {deleteReviewBalance.balance > 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (payable)
                            </span>
                          )}
                          {deleteReviewBalance.balance < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              (receivable)
                            </span>
                          )}
                        </span>
                      </p>
                      {(() => {
                        const balanceAfter =
                          deleteConfirmPayload.type === "credit_purchase"
                            ? deleteReviewBalance.balance -
                              deleteConfirmPayload.row.amount
                            : deleteReviewBalance.balance +
                              deleteConfirmPayload.row.amount;
                        return (
                          <p
                            className={
                              balanceAfter >= 0
                                ? "font-medium text-[var(--color-warning-text)]"
                                : "font-medium text-[var(--color-success)]"
                            }
                          >
                            After this delete:{" "}
                            {deleteConfirmPayload.type === "credit_purchase"
                              ? "Total Credit Purchase"
                              : "Total Settlements"}{" "}
                            will decrease by ₹
                            {formatDecimal(deleteConfirmPayload.row.amount)} →
                            Balance will be ₹
                            {formatDecimal(Math.abs(balanceAfter))}
                            {balanceAfter > 0 && (
                              <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                                (payable)
                              </span>
                            )}
                            {balanceAfter < 0 && (
                              <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                                (receivable)
                              </span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
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
              Transactions
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
