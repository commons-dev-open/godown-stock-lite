import { useState, useEffect, useMemo, useCallback, createElement } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
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
import { CashPurchaseEntryModals } from "../components/CashPurchaseEntryModals";
import AddDepositModal from "../components/AddDepositModal";
import { formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import {
  exportTransactionsToCsv,
  getPrintTableBody,
  type TransactionExportRow,
} from "../lib/exportTransactions";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import {
  useElectronHtmlPrintJob,
  type HtmlPrintJobBase,
} from "../hooks/useElectronHtmlPrintJob";
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
  Receipt,
  ExternalLink,
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

type PurchaseRow = Purchase & { product_name?: string };

type ItemWithUnitGraph = Item & {
  other_units?: { unit: string; sort_order: number }[];
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

function amountColorClass(type: string): string {
  if (type === "credit_purchase" || type === "lend")
    return "text-[var(--color-warning-text)]";
  if (type === "settlement" || type === "deposit")
    return "text-[var(--color-success)]";
  if (type === "lender_refund") return "text-[var(--color-accent)]";
  if (type === "cash_purchase") return "text-[var(--color-accent)]";
  return "text-[var(--color-text-primary)]";
}

function buildDeleteConfirmModalRows(p: {
  type: "credit_purchase" | "settlement" | "cash_purchase" | "lender_refund";
  row: LenderLedgerPageRow;
  t: (key: string) => string;
}): ModalKVRow[] {
  const rows: ModalKVRow[] = [
    {
      id: 1,
      fieldLabel: p.t("columns.type"),
      value: <TransactionTypeBadge type={p.type as TransactionType} />,
    },
    {
      id: 2,
      fieldLabel: p.t("columns.date"),
      value: formatDateForView(p.row.transaction_date),
    },
  ];
  let nextId = 3;
  if (p.type === "credit_purchase" || p.type === "cash_purchase") {
    if (p.type === "credit_purchase") {
      rows.push({
        id: nextId++,
        fieldLabel: p.t("columns.mahajan"),
        value: p.row.lender_name ?? p.row.mahajan_name ?? "—",
      });
    }
    rows.push(
      {
        id: nextId++,
        fieldLabel: p.t("columns.product"),
        value: p.row.product_name ?? "—",
      },
      {
        id: nextId++,
        fieldLabel: p.t("columns.qty"),
        value: p.row.quantity ?? "—",
      }
    );
  }
  rows.push(
    {
      id: nextId++,
      fieldLabel: p.t("columns.amount_inr"),
      value: formatDecimal(p.row.amount),
    },
    {
      id: nextId++,
      fieldLabel: p.t("columns.notes"),
      value: p.row.notes ?? "—",
    }
  );
  return rows;
}

function withLocalizedTransactionExportRows(
  rows: TransactionExportRow[],
  t: TFunction<"transactions">
): TransactionExportRow[] {
  return rows.map((row) => ({
    ...row,
    type: String(t(`types.${row.type}`, { defaultValue: row.type })),
    payment_method: row.payment_method
      ? String(
          t(`modals.shared.payment_methods.${row.payment_method}.label`, {
            defaultValue: row.payment_method,
          })
        )
      : null,
  }));
}

export default function Transactions() {
  const { t } = useTranslation("transactions");
  const { t: tPurchases } = useTranslation("purchases");
  const queryClient = useQueryClient();
  const api = getElectron();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const appName = getAppDisplayName(settings);
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const { formatAbbreviatedInteger } = useFormatters();
  const [lendOpen, setLendOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositModalMode, setDepositModalMode] = useState<
    "payment" | "refund"
  >("payment");
  const [editingLend, setEditingLend] = useState<MahajanLend | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<MahajanDeposit | null>(
    null
  );
  const [editingDepositIsRefund, setEditingDepositIsRefund] = useState(false);
  const [filterMahajanId, setFilterMahajanId] = useState<number | "">("");
  const [filterType, setFilterType] = useState<
    | "all"
    | "credit_purchase"
    | "settlement"
    | "cash_purchase"
    | "lender_refund"
  >("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [purchaseAddOpen, setPurchaseAddOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRow | null>(
    null
  );
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
    type: "credit_purchase" | "settlement" | "cash_purchase" | "lender_refund";
    row: LenderLedgerPageRow;
  } | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  type TransactionsPrintJob =
    | null
    | (HtmlPrintJobBase & {
        columns: string[];
        rows: string[][];
        filterDetails?: { label: string; value: string }[];
      });
  const [printJob, setPrintJob] = useState<TransactionsPrintJob>(null);

  useEffect(() => {
    const raw = searchParams.get("open");
    if (!raw) {
      return;
    }
    const open = raw.trim().toLowerCase();
    if (open === "cashpurchase" || open === "cash_purchase") {
      setPurchaseAddOpen(true);
    } else if (
      open === "creditpurchase" ||
      open === "credit_purchase" ||
      open === "lend"
    ) {
      setLendOpen(true);
    } else {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

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

  const [purchaseQvOpen, setPurchaseQvOpen] = useState(false);
  const [purchaseQvPurchaseId, setPurchaseQvPurchaseId] = useState<number | null>(
    null
  );
  const [purchaseQvSourceRowType, setPurchaseQvSourceRowType] = useState("");
  const {
    refs: purchaseQvRefs,
    floatingStyles: purchaseQvFloatingStyles,
    context: purchaseQvContext,
  } = useFloating({
    open: purchaseQvOpen,
    onOpenChange: (next) => {
      setPurchaseQvOpen(next);
      if (!next) {
        setPurchaseQvPurchaseId(null);
        setPurchaseQvSourceRowType("");
      }
    },
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const purchaseQvDismiss = useDismiss(purchaseQvContext, {
    escapeKey: true,
    outsidePress: true,
  });
  const { getFloatingProps: getPurchaseQvFloatingProps } = useInteractions([
    purchaseQvDismiss,
  ]);

  const {
    data: purchaseQvDetail,
    isFetching: purchaseQvFetching,
    isError: purchaseQvError,
  } = useQuery({
    queryKey: ["supplierPurchaseDetail", purchaseQvPurchaseId],
    queryFn: () => api.getSupplierPurchaseById(purchaseQvPurchaseId!),
    enabled: purchaseQvOpen && purchaseQvPurchaseId != null,
  });

  const [editLendDate, setEditLendDate] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");
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
      deleteConfirmPayload.type === "settlement" ||
      deleteConfirmPayload.type === "lender_refund")
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
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setEditingLend(null);
      toast.success(t("toasts.credit_purchase_updated"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("toasts.credit_purchase_update_failed")),
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
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchaseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setLedgerUpdatesAvailable(true);
      setEditingDeposit(null);
      toast.success(t("toasts.settlement_updated"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("toasts.settlement_update_failed")),
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
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      toast.success(t("toasts.credit_purchase_deleted"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("toasts.credit_purchase_delete_failed")),
  });

  const deleteDeposit = useMutation({
    mutationFn: (id: number) => api.deleteMahajanDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchaseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setLedgerUpdatesAvailable(true);
      toast.success(t("toasts.settlement_deleted"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("toasts.settlement_delete_failed")),
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
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setEditingPurchase(null);
    },
  });

  const deletePurchase = useMutation({
    mutationFn: (id: number) => api.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
    },
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const itemList = items as ItemWithUnitGraph[];

  const appliedFilters = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (filterMahajanId !== "") {
      const m = mahajanList.find((x) => x.id === filterMahajanId);
      list.push({
        label: t("filters.lender"),
        value: m?.name ?? String(filterMahajanId),
      });
    }
    if (filterType !== "all") {
      list.push({
        label: t("filters.type"),
        value: t(`types.${filterType}`),
      });
    }
    if (filterDateFrom)
      list.push({ label: t("filters.date_from"), value: filterDateFrom });
    if (filterDateTo)
      list.push({ label: t("filters.date_to"), value: filterDateTo });
    return list;
  }, [
    filterMahajanId,
    filterType,
    filterDateFrom,
    filterDateTo,
    mahajanList,
    t,
  ]);

  const transactionExportColumnLabels = useMemo(
    () => [
      t("columns.type"),
      t("columns.date"),
      t("columns.mahajan"),
      t("columns.product"),
      t("columns.qty"),
      t("columns.unit"),
      t("columns.amount_inr"),
      t("columns.notes"),
      t("columns.payment"),
    ],
    [t]
  );

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
      toast.error(t("toasts.no_data_to_export"));
      return;
    }
    const displayRows = withLocalizedTransactionExportRows(data, t);
    exportTransactionsToCsv(
      displayRows,
      appliedFilters,
      transactionExportColumnLabels,
      t("filters.applied")
    );
    toast.success(t("toasts.exported_csv"));
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error(t("toasts.no_data_to_export"));
      return;
    }
    const displayRows = withLocalizedTransactionExportRows(data, t);
    const body = getPrintTableBody(
      displayRows,
      appliedFilters,
      transactionExportColumnLabels
    );
    setPrintJob({
      mode: "pdf",
      documentTitle: `${t("hero.title")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `transactions-${formatDateForFile(new Date())}.pdf`,
      ...body,
    });
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error(t("toasts.no_data_to_export"));
      return;
    }
    const displayRows = withLocalizedTransactionExportRows(data, t);
    const body = getPrintTableBody(
      displayRows,
      appliedFilters,
      transactionExportColumnLabels
    );
    setPrintJob({
      mode: "browser",
      documentTitle: `${t("hero.title")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `transactions-${formatDateForFile(new Date())}.pdf`,
      ...body,
    });
  }

  useElectronHtmlPrintJob(printJob, setPrintJob, api, {
    onPdfFinished: ({ saved }) => {
      if (saved) {
        toast.success(t("toasts.exported_pdf"));
      }
    },
    onPdfError: () => {
      toast.error(t("toasts.export_pdf_failed"));
    },
  });

  const handleFilterChange = (updates: {
    mahajanId?: number | "";
    type?:
      | "all"
      | "credit_purchase"
      | "settlement"
      | "cash_purchase"
      | "lender_refund";
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
        label: t("columns.type"),
        render: (row: LenderLedgerPageRow) => (
          <TransactionTypeBadge type={row.type as TransactionType} />
        ),
      },
      {
        key: "transaction_date",
        label: t("columns.date"),
        render: (row: LenderLedgerPageRow) => (
          <Tooltip content={formatDateForForm(row.transaction_date)}>
            <span>{formatDateForView(row.transaction_date)}</span>
          </Tooltip>
        ),
      },
      {
        key: "lender",
        label: t("columns.mahajan"),
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
        label: t("columns.product"),
        render: (row: LenderLedgerPageRow) => (
          <span className="text-[var(--color-text-secondary)]">
            {row.type === "settlement" ||
            row.type === "deposit" ||
            row.type === "lender_refund"
              ? "—"
              : (row.product_name ?? "—")}
          </span>
        ),
      },
      {
        key: "quantity",
        label: t("columns.qty"),
        align: "right" as const,
        render: (row: LenderLedgerPageRow) => (
          <span className="block text-right text-[var(--color-text-primary)]">
            {row.type === "settlement" ||
            row.type === "deposit" ||
            row.type === "lender_refund"
              ? "—"
              : row.quantity != null
                ? String(row.quantity)
                : "—"}
          </span>
        ),
      },
      {
        key: "unit",
        label: t("columns.unit"),
        render: (row: LenderLedgerPageRow) => {
          if (
            row.type === "settlement" ||
            row.type === "deposit" ||
            row.type === "lender_refund"
          ) {
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
        label: t("columns.amount_inr"),
        align: "right" as const,
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
        label: t("columns.notes"),
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
                      {t("actions.view_invoice")}
                    </button>
                  )}
                </span>
              )}
            {(row.type === "settlement" ||
              row.type === "deposit" ||
              row.type === "lender_refund") &&
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
      {
        key: "purchase_quickview",
        label: t("columns.purchase"),
        render: (row: LenderLedgerPageRow) => {
          const pid = row.purchase_id;
          if (pid == null || !Number.isFinite(pid) || pid <= 0) {
            return (
              <span className="text-[var(--color-text-tertiary)]">—</span>
            );
          }
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                purchaseQvRefs.setReference(e.currentTarget);
                setPurchaseQvPurchaseId(pid);
                setPurchaseQvSourceRowType(row.type);
                setPurchaseQvOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors min-w-[32px] min-h-[32px]"
              title={t("purchase_quickview.button_title")}
              aria-label={t("purchase_quickview.button_aria")}
            >
              <Receipt size={18} aria-hidden="true" />
            </button>
          );
        },
      },
    ],
    [items, api, t, purchaseQvRefs]
  );

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <SalesListHero
        title={t("hero.title")}
        metrics={[]}
        actions={
          <>
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <Button variant="secondary" type="button">
                <Download size={20} className="mr-1.5" aria-hidden="true" />
                {t("actions.export")}
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
                    {t("actions.export_csv")}
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
                    onClick={handleExportPdf}
                  >
                    <FileDown size={16} className="shrink-0" />
                    {t("actions.export_pdf")}
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
                    onClick={handleExportPrint}
                  >
                    <Printer size={16} className="shrink-0" />
                    {t("actions.print")}
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
              {t("actions.cash_purchase")}
            </Button>
            <Button variant="amber" onClick={() => setLendOpen(true)}>
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              {t("actions.add_credit_purchase")}
            </Button>
            <Button
              variant="green"
              onClick={() => {
                setDepositModalMode("payment");
                setDepositOpen(true);
              }}
            >
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              {t("actions.add_settlement")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDepositModalMode("refund");
                setDepositOpen(true);
              }}
            >
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              {t("actions.add_refund")}
            </Button>
          </>
        }
      />
      <FloatingPortal>
        {purchaseQvOpen && (
          <div
            ref={purchaseQvRefs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
            style={purchaseQvFloatingStyles}
            {...getPurchaseQvFloatingProps()}
            className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border-default)] pb-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  {t("purchase_quickview.title")}
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {purchaseQvPurchaseId != null
                    ? t("purchase_quickview.bill_id", {
                        id: purchaseQvPurchaseId,
                      })
                    : "—"}
                </p>
              </div>
            </div>
            {purchaseQvFetching && (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                {t("purchase_quickview.loading")}
              </p>
            )}
            {!purchaseQvFetching && purchaseQvError && (
              <p className="mt-3 text-sm text-[var(--color-danger)]">
                {t("purchase_quickview.error")}
              </p>
            )}
            {!purchaseQvFetching &&
              !purchaseQvError &&
              purchaseQvDetail && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                    <span className="rounded-md bg-[var(--color-bg-surface-raised)] px-2 py-0.5 font-medium">
                      {tPurchases(
                        `kind_labels.${purchaseQvDetail.header.kind}`
                      )}
                    </span>
                    <span>
                      {formatDateForView(
                        purchaseQvDetail.header.document_date
                      )}
                    </span>
                  </div>
                  {purchaseQvDetail.header.kind === "credit" &&
                    purchaseQvDetail.header.lender_id != null && (
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {mahajanList.find(
                          (m) => m.id === purchaseQvDetail.header.lender_id
                        )?.name ?? t("columns.mahajan")}
                      </p>
                    )}
                  {purchaseQvDetail.header.lender_invoice_number && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t("purchase_quickview.invoice")}: #
                      {purchaseQvDetail.header.lender_invoice_number}
                    </p>
                  )}
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {t("purchase_quickview.lines_heading")}
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {purchaseQvDetail.lines.map((ln) => {
                      const item = (items as Item[]).find(
                        (i) => i.id === ln.product_id
                      );
                      return (
                        <div
                          key={ln.id}
                          className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border-subtle)] py-1 text-xs last:border-b-0"
                        >
                          <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
                            {item?.name ?? `#${ln.product_id}`}
                          </span>
                          <span className="shrink-0 tabular-nums text-[var(--color-text-secondary)]">
                            {formatDecimal(ln.quantity)} {ln.unit}
                          </span>
                          <span className="shrink-0 tabular-nums font-medium text-[var(--color-text-primary)]">
                            ₹{formatDecimal(ln.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-right text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("purchase_quickview.total")}{" "}
                    <span className="tabular-nums">
                      ₹
                      {formatDecimal(purchaseQvDetail.header.total_amount)}
                    </span>
                  </p>
                  {(purchaseQvSourceRowType === "settlement" ||
                    purchaseQvSourceRowType === "deposit" ||
                    purchaseQvSourceRowType === "lender_refund") && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t("purchase_quickview.settlement_hint")}
                    </p>
                  )}
                  <Link
                    to={`/purchases?purchaseId=${purchaseQvDetail.header.id}`}
                    onClick={() => setPurchaseQvOpen(false)}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    {t("purchase_quickview.open_in_purchases")}
                  </Link>
                </div>
              )}
          </div>
        )}
      </FloatingPortal>
      <DashboardSectionBoundary
        sectionTitle={t("ledger.section_title")}
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
          title={t("ledger.title")}
          description={t("ledger.description")}
          badge={ledgerCountBadge}
        >
          <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)]">
            <select
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] shrink-0 min-w-0"
              value={filterType}
              onChange={(e) =>
                handleFilterChange({
                  type: e.target.value as
                    | "all"
                    | "credit_purchase"
                    | "settlement"
                    | "cash_purchase"
                    | "lender_refund",
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
              <option value="cash_purchase">
                {t("filters.cash_purchase_only")}
              </option>
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
              <option value="">{t("filters.all_lenders")}</option>
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
              {t("filters.more_filters")}
              {(filterDateFrom || filterDateTo) && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent)] rounded">
                  1
                </span>
              )}
            </button>
            {ledgerHasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  clearLedgerFilters();
                  setMoreFiltersOpen(false);
                }}
                className="shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
              >
                {t("filters.clear")}
              </button>
            ) : null}
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
                  <h2 className="text-lg font-semibold">
                    {t("filters.more_filters")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMoreFiltersOpen(false)}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] rounded transition-colors"
                    aria-label={t("actions.close")}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <label
                    htmlFor="more-filters-date-from"
                    className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
                  >
                    {t("filters.from_date")}
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
                    {t("filters.to_date")}
                    <DateInput
                      id="more-filters-date-to"
                      value={filterDateTo}
                      onChange={(v) => handleFilterChange({ dateTo: v })}
                      className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                    />
                  </label>
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
                  ? t("empty.no_matching_title")
                  : t("empty.title")
              }
              emptyDescription={
                ledgerHasActiveFilters
                  ? t("empty.no_matching_message")
                  : t("empty.message")
              }
              emptyActionLabel={
                ledgerHasActiveFilters
                  ? t("filters.clear")
                  : t("actions.cash_purchase")
              }
              onEmptyAction={
                ledgerHasActiveFilters
                  ? clearLedgerFilters
                  : () => setPurchaseAddOpen(true)
              }
              emptySecondaryLabel={
                ledgerHasActiveFilters
                  ? t("actions.cash_purchase")
                  : t("actions.credit_purchase")
              }
              onEmptySecondary={
                ledgerHasActiveFilters
                  ? () => setPurchaseAddOpen(true)
                  : () => setLendOpen(true)
              }
              loaderColumns={10}
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
                          row.type === "deposit" ||
                          row.type === "lender_refund"
                        ) {
                          setEditingDepositIsRefund(
                            row.type === "lender_refund"
                          );
                          setEditingDeposit(toDepositRecord(row));
                        } else if (row.type === "cash_purchase") {
                          setEditingPurchase(toPurchaseRecord(row));
                        }
                      }}
                      className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                      title={t("actions.edit")}
                      aria-label={t("actions.edit")}
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rt = row.type;
                        const delType:
                          | "credit_purchase"
                          | "settlement"
                          | "cash_purchase"
                          | "lender_refund" =
                          rt === "lender_refund"
                            ? "lender_refund"
                            : rt === "settlement" || rt === "deposit"
                              ? "settlement"
                              : rt === "credit_purchase" || rt === "lend"
                                ? "credit_purchase"
                                : "cash_purchase";
                        setDeleteConfirmPayload({
                          type: delType,
                          row,
                        });
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                      title={t("actions.delete")}
                      aria-label={t("actions.delete")}
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
        onClose={() => {
          setDepositOpen(false);
          setDepositModalMode("payment");
        }}
        mode={depositModalMode === "refund" ? "refund" : "payment"}
      />

      <FormModal
        title={t("modals.edit_credit_purchase.title")}
        open={!!editingLend && !confirmEditLendOpen}
        onClose={() => {
          setEditingLend(null);
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-4xl"
        footer={
          editingLend ? (
            <>
              <Button
                type="submit"
                form="transactions-edit-lend-form"
                variant="amber"
              >
                {t("modals.shared.actions.review_update")}
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
                {t("modals.shared.fields.lender_required")}
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
                <option value="">
                  {t("modals.shared.placeholders.select")}
                </option>
                {mahajanList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.shared.fields.date_required")}
              </label>
              <DateInput
                value={editLendDate}
                onChange={setEditLendDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("columns.product")}
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
                {t("columns.qty")}
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
                {t("modals.shared.fields.amount_required")}
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
                {t("columns.notes")}
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
        title={t("modals.edit_credit_purchase.review_title")}
        open={confirmEditLendOpen}
        onClose={() => {
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-4xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmEditLendOpen(false);
                setConfirmEditLendPayload(null);
              }}
            >
              {t("modals.shared.actions.back")}
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
              {updateLend.isPending
                ? t("modals.shared.actions.updating")
                : t("modals.shared.actions.confirm_update")}
            </Button>
          </>
        }
      >
        {confirmEditLendPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t("modals.shared.messages.summary_of_changes")}
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
                    fieldLabel: t("columns.date"),
                    current: formatDateForView(
                      confirmEditLendPayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditLendPayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: t("columns.mahajan"),
                    current:
                      mahajanList.find(
                        (m) => m.id === confirmEditLendPayload.record.lender_id
                      )?.name ?? "—",
                    after: confirmEditLendPayload.newValues.mahajanName,
                  },
                  {
                    id: 3,
                    fieldLabel: t("columns.product"),
                    current: confirmEditLendPayload.record.product_name ?? "—",
                    after: confirmEditLendPayload.newValues.product_name ?? "—",
                  },
                  {
                    id: 4,
                    fieldLabel: t("columns.qty"),
                    current: confirmEditLendPayload.record.quantity ?? 0,
                    after: confirmEditLendPayload.newValues.quantity,
                  },
                  {
                    id: 5,
                    fieldLabel: t("columns.amount_inr"),
                    current: formatDecimal(
                      confirmEditLendPayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditLendPayload.newValues.amount
                    ),
                  },
                  {
                    id: 6,
                    fieldLabel: t("columns.notes"),
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
                {t("modals.shared.messages.impact_after_update")}
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
                    <strong>{t("modals.shared.labels.stock")}</strong>{" "}
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
                              {t("modals.shared.messages.current_stock", {
                                stock: oldStock,
                              })}{" "}
                              {qtyDelta >= 0 ? "+" : ""}
                              {qtyDelta} → <strong>{newStock}</strong>{" "}
                              {t("modals.shared.messages.after_update")}
                            </>
                          );
                        })()
                      : t(
                          "modals.edit_credit_purchase.messages.product_changed"
                        )}
                  </p>
                );
              })()}
              {editReviewBalanceLoading ? (
                <p className="text-[var(--color-text-tertiary)]">
                  {t("modals.shared.messages.loading_balance")}
                </p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>{t("modals.shared.labels.lender_balance")}</strong>{" "}
                    {t("modals.shared.messages.total_credit_purchase")} ₹
                    {formatDecimal(editReviewBalance.totalLends)},{" "}
                    {t("modals.shared.messages.total")}
                    {t("modals.shared.messages.total_deposits")} ₹
                    {formatDecimal(editReviewBalance.totalDeposits)} →{" "}
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
                          ({t("modals.shared.balance.payable")})
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          ({t("modals.shared.balance.receivable")})
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
                          {t(
                            "modals.edit_credit_purchase.messages.after_update_prefix"
                          )}{" "}
                          {t("modals.shared.messages.total_credit_purchase")}{" "}
                          {t("modals.shared.messages.will_change_by")} ₹
                          {formatDecimal(
                            confirmEditLendPayload.newValues.amount -
                              confirmEditLendPayload.record.amount
                          )}{" "}
                          → {t("modals.shared.messages.balance_will_be")} ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              ({t("modals.shared.balance.payable")})
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              ({t("modals.shared.balance.receivable")})
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
        title={
          editingDepositIsRefund
            ? t("modals.edit_refund.title")
            : t("modals.edit_settlement.title")
        }
        open={!!editingDeposit && !confirmEditDepositOpen}
        onClose={() => {
          setEditingDeposit(null);
          setEditingDepositIsRefund(false);
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
                {t("modals.shared.actions.review_update")}
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
                {t("modals.shared.fields.date_required")}
              </label>
              <DateInput
                value={editDepositDate}
                onChange={setEditDepositDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.shared.fields.amount_required")}
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
                {t("columns.notes")}
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
        title={
          editingDepositIsRefund
            ? t("modals.edit_refund.review_title")
            : t("modals.edit_settlement.review_title")
        }
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
              {t("modals.shared.actions.back")}
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
                setEditingDepositIsRefund(false);
              }}
              disabled={updateDeposit.isPending}
            >
              {updateDeposit.isPending
                ? t("modals.shared.actions.updating")
                : t("modals.shared.actions.confirm_update")}
            </Button>
          </>
        }
      >
        {confirmEditDepositPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t("modals.shared.messages.summary_of_changes")}
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
                    fieldLabel: t("columns.date"),
                    current: formatDateForView(
                      confirmEditDepositPayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditDepositPayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: t("columns.amount_inr"),
                    current: formatDecimal(
                      confirmEditDepositPayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditDepositPayload.newValues.amount
                    ),
                  },
                  {
                    id: 3,
                    fieldLabel: t("columns.notes"),
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
                {t("modals.shared.messages.impact_after_update")}
              </p>
              {editReviewBalanceLoading ? (
                <p className="text-[var(--color-text-tertiary)]">
                  {t("modals.shared.messages.loading_balance")}
                </p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>{t("modals.shared.labels.lender_balance")}</strong>{" "}
                    {t("modals.shared.messages.total_credit_purchase")} ₹
                    {formatDecimal(editReviewBalance.totalLends)},{" "}
                    {t("modals.shared.messages.total")}
                    {t("modals.shared.messages.total_deposits")} ₹
                    {formatDecimal(editReviewBalance.totalDeposits)} →{" "}
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
                          ({t("modals.shared.balance.payable")})
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          ({t("modals.shared.balance.receivable")})
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
                          {t(
                            editingDepositIsRefund
                              ? "modals.edit_refund.messages.after_update_prefix"
                              : "modals.edit_settlement.messages.after_update_prefix"
                          )}{" "}
                          {editingDepositIsRefund
                            ? t(
                                "modals.shared.messages.total_refunds_recorded"
                              )
                            : t("modals.shared.messages.total_settlements")}{" "}
                          {t("modals.shared.messages.will_change_by")} ₹
                          {formatDecimal(
                            confirmEditDepositPayload.newValues.amount -
                              confirmEditDepositPayload.record.amount
                          )}{" "}
                          → {t("modals.shared.messages.balance_will_be")} ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              ({t("modals.shared.balance.payable")})
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              ({t("modals.shared.balance.receivable")})
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

      <CashPurchaseEntryModals
        open={purchaseAddOpen}
        onClose={() => setPurchaseAddOpen(false)}
      />

      <FormModal
        title={t("modals.edit_cash_purchase.title")}
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
              {t("modals.shared.actions.review_update")}
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
                {t("modals.shared.fields.date_required")}
              </label>
              <DateInput
                value={editPurchaseDate}
                onChange={setEditPurchaseDate}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("columns.product")}
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
                {t("modals.shared.fields.quantity_required")}
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
                {t("modals.shared.fields.amount_required")}
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
                {t("columns.notes")}
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
        title={t("modals.edit_cash_purchase.review_title")}
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
                {t("modals.shared.actions.back")}
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
                {updatePurchase.isPending
                  ? t("modals.shared.actions.updating")
                  : t("modals.shared.actions.confirm_update")}
              </Button>
            </>
          ) : null
        }
      >
        {confirmEditPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t("modals.shared.messages.summary_of_changes")}
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
                    fieldLabel: t("columns.date"),
                    current: formatDateForView(
                      confirmEditPurchasePayload.record.transaction_date
                    ),
                    after: formatDateForView(
                      confirmEditPurchasePayload.newValues.transaction_date
                    ),
                  },
                  {
                    id: 2,
                    fieldLabel: t("columns.product"),
                    current:
                      confirmEditPurchasePayload.record.product_name ?? "—",
                    after:
                      confirmEditPurchasePayload.record.product_name ?? "—",
                  },
                  {
                    id: 3,
                    fieldLabel: t("columns.qty"),
                    current: confirmEditPurchasePayload.record.quantity,
                    after: confirmEditPurchasePayload.newValues.quantity,
                  },
                  {
                    id: 4,
                    fieldLabel: t("columns.amount_inr"),
                    current: formatDecimal(
                      confirmEditPurchasePayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditPurchasePayload.newValues.amount
                    ),
                  },
                  {
                    id: 5,
                    fieldLabel: t("columns.notes"),
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
                {t("modals.shared.messages.impact_after_update")}
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
                    <strong>{t("modals.shared.labels.stock")}</strong>{" "}
                    {t("modals.shared.messages.current_stock", {
                      stock: oldStock,
                    })}{" "}
                    {qtyDelta >= 0 ? "+" : ""}
                    {qtyDelta} → <strong>{newStock}</strong>{" "}
                    {t("modals.shared.messages.after_update")}
                  </p>
                );
              })()}
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title={t("modals.delete_transaction.title")}
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
                {t("modals.shared.actions.back")}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!deleteConfirmPayload) return;
                  if (deleteConfirmPayload.type === "credit_purchase")
                    deleteLend.mutate(deleteConfirmPayload.row.id);
                  else if (
                    deleteConfirmPayload.type === "settlement" ||
                    deleteConfirmPayload.type === "lender_refund"
                  )
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
                  ? t("modals.shared.actions.deleting")
                  : t("modals.shared.actions.confirm_delete")}
              </Button>
            </>
          ) : null
        }
      >
        {deleteConfirmPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t("modals.delete_transaction.messages.summary")}
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <DataTable<ModalKVRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_KV_COLUMNS}
                data={buildDeleteConfirmModalRows({
                  ...deleteConfirmPayload,
                  t: (key) => t(key as never),
                })}
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
                    : deleteConfirmPayload.type === "lender_refund"
                      ? "border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]"
                      : "border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]"
              }`}
            >
              <p
                className={`font-medium ${
                  deleteConfirmPayload.type === "credit_purchase"
                    ? "text-[var(--color-warning-text)]"
                    : deleteConfirmPayload.type === "settlement"
                      ? "text-[var(--color-success)]"
                      : deleteConfirmPayload.type === "lender_refund"
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-accent)]"
                }`}
              >
                {t("modals.shared.messages.impact_after_delete")}
              </p>
              {(deleteConfirmPayload.type === "credit_purchase" ||
                deleteConfirmPayload.type === "cash_purchase") &&
                deleteConfirmPayload.row.product_id != null && (
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>{t("modals.shared.labels.stock")}</strong>{" "}
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
                          {t("modals.shared.messages.current_stock", {
                            stock: oldStock,
                          })}{" "}
                          → -{qty} → <strong>{newStock}</strong>{" "}
                          {t("modals.shared.messages.after_delete")}
                        </>
                      );
                    })()}
                  </p>
                )}
              {(deleteConfirmPayload.type === "credit_purchase" ||
                deleteConfirmPayload.type === "settlement" ||
                deleteConfirmPayload.type === "lender_refund") && (
                <>
                  {deleteReviewBalanceLoading ? (
                    <p className="text-[var(--color-text-tertiary)]">
                      {t("modals.shared.messages.loading_balance")}
                    </p>
                  ) : deleteReviewBalance != null ? (
                    <div className="space-y-1 text-[var(--color-text-secondary)]">
                      <p>
                        <strong>
                          {t("modals.shared.labels.lender_balance")}
                        </strong>{" "}
                        {t("modals.shared.messages.total_credit_purchase")} ₹
                        {formatDecimal(deleteReviewBalance.totalLends)},{" "}
                        {t("modals.shared.messages.total")}
                        {t("modals.shared.messages.total_deposits")} ₹
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
                              ({t("modals.shared.balance.payable")})
                            </span>
                          )}
                          {deleteReviewBalance.balance < 0 && (
                            <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                              ({t("modals.shared.balance.receivable")})
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
                            {t(
                              "modals.delete_transaction.messages.after_delete_prefix"
                            )}{" "}
                            {deleteConfirmPayload.type === "credit_purchase"
                              ? t(
                                  "modals.shared.messages.total_credit_purchase"
                                )
                              : deleteConfirmPayload.type === "lender_refund"
                                ? t(
                                    "modals.shared.messages.total_refunds_recorded"
                                  )
                                : t(
                                    "modals.shared.messages.total_settlements"
                                  )}{" "}
                            {t("modals.shared.messages.will_decrease_by")} ₹
                            {formatDecimal(deleteConfirmPayload.row.amount)} →
                            {t("modals.shared.messages.balance_will_be")} ₹
                            {formatDecimal(Math.abs(balanceAfter))}
                            {balanceAfter > 0 && (
                              <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                                ({t("modals.shared.balance.payable")})
                              </span>
                            )}
                            {balanceAfter < 0 && (
                              <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                                ({t("modals.shared.balance.receivable")})
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

      {printJob && (
        <div
          className="app-print-container daily-sales-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-[var(--color-bg-surface)] p-6 print:block"
          aria-hidden
        >
          <header className="mb-4 border-b border-[var(--color-border-default)] pb-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {appName}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("hero.title")}
            </p>
            {printJob.filterDetails != null &&
              printJob.filterDetails.length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium text-[var(--color-text-secondary)]">
                    {t("filters.applied")}
                  </p>
                  {printJob.filterDetails.map((f) => (
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
          {createElement(
            "table",
            { className: "w-full border-collapse text-xs" },
            <thead>
              <tr>
                {printJob.columns.map((col) => (
                  <th
                    key={col}
                    className="border border-[var(--color-border-strong)] px-2 py-1.5 text-left font-medium text-white bg-[var(--color-text-secondary)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>,
            <tbody>
              {printJob.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, ci) => (
                    <td
                      key={`${row[0]}-${printJob.columns[ci]}`}
                      className="border border-[var(--color-border-strong)] px-2 py-1.5 text-[var(--color-text-primary)]"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </div>
      )}
    </div>
  );
}
