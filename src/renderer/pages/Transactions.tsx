import { useState, useEffect, useMemo } from "react";
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
import EmptyState from "../components/EmptyState";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import TableLoader from "../components/TableLoader";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import TransactionTypeBadge, {
  type TransactionType,
} from "../components/TransactionTypeBadge";
import LedgerRowActions from "../components/LedgerRowActions";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import {
  exportTransactionsToCsv,
  exportTransactionsToPdf,
  getPrintTableBody,
  type TransactionExportRow,
} from "../lib/exportTransactions";
import type {
  Item,
  MahajanLend,
  MahajanDeposit,
  Purchase,
} from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

type LendLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  amount: number;
};
type PurchaseRow = Purchase & { product_name?: string };
type PurchaseLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  amount: number;
};

type LedgerRow = {
  type: string;
  id: number;
  mahajan_id: number | null;
  mahajan_name: string | null;
  product_id: number | null;
  transaction_date: string;
  product_name: string | null;
  quantity: number | null;
  amount: number;
  notes: string | null;
};

const emptyLine = (): LendLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
  amount: 0,
});
const emptyPurchaseLine = (): PurchaseLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
  amount: 0,
});

function amountColorClass(type: string): string {
  if (type === "lend") return "text-amber-600";
  if (type === "deposit") return "text-green-600";
  if (type === "cash_purchase") return "text-blue-600";
  return "text-gray-900";
}

export default function Transactions() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [lendOpen, setLendOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [editingLend, setEditingLend] = useState<MahajanLend | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<MahajanDeposit | null>(
    null
  );
  const [filterMahajanId, setFilterMahajanId] = useState<number | "">("");
  const [filterType, setFilterType] = useState<
    "all" | "lend" | "deposit" | "cash_purchase"
  >("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [lendLines, setLendLines] = useState<LendLine[]>([emptyLine()]);
  const [confirmLendOpen, setConfirmLendOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    mahajan_id: number;
    mahajanName: string;
    transaction_date: string;
    notes: string;
    lines: LendLine[];
  } | null>(null);
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
    type: "lend" | "deposit" | "cash_purchase";
    row: LedgerRow;
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

  const [lendFormDate, setLendFormDate] = useState(todayISO());
  const [depositFormDate, setDepositFormDate] = useState(todayISO());
  const [editLendDate, setEditLendDate] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");
  const [purchaseFormDate, setPurchaseFormDate] = useState(todayISO());
  const [editPurchaseDate, setEditPurchaseDate] = useState("");

  useEffect(() => {
    if (lendOpen) queueMicrotask(() => setLendFormDate(todayISO()));
  }, [lendOpen]);
  useEffect(() => {
    if (depositOpen) queueMicrotask(() => setDepositFormDate(todayISO()));
  }, [depositOpen]);
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
        setEditLendMahajanId(e.mahajan_id);
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

  const { data: ledgerPage, isLoading: ledgerLoading } = useQuery({
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
      }) as Promise<{ data: LedgerRow[]; total: number }>,
  });
  const unifiedRows = ledgerPage?.data ?? [];
  const totalLedger = ledgerPage?.total ?? 0;

  const { data: mahajanBalance, isFetching: balanceLoading } = useQuery({
    queryKey: ["mahajanBalance", confirmPayload?.mahajan_id],
    queryFn: () => api.getMahajanBalance(confirmPayload!.mahajan_id),
    enabled: confirmLendOpen && !!confirmPayload?.mahajan_id,
  });

  const editReviewMahajanId =
    confirmEditLendOpen && confirmEditLendPayload
      ? confirmEditLendPayload.newValues.mahajan_id
      : confirmEditDepositOpen && confirmEditDepositPayload
        ? confirmEditDepositPayload.record.mahajan_id
        : null;
  const { data: editReviewBalance, isFetching: editReviewBalanceLoading } =
    useQuery({
      queryKey: ["mahajanBalance", editReviewMahajanId],
      queryFn: () => api.getMahajanBalance(editReviewMahajanId!),
      enabled:
        !!editReviewMahajanId &&
        (confirmEditLendOpen || confirmEditDepositOpen),
    });

  const deleteReviewMahajanId =
    deleteConfirmOpen &&
    deleteConfirmPayload &&
    (deleteConfirmPayload.type === "lend" ||
      deleteConfirmPayload.type === "deposit")
      ? deleteConfirmPayload.row.mahajan_id
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

  const createLendBatch = useMutation({
    mutationFn: (payload: {
      mahajan_id: number;
      transaction_date: string;
      notes?: string;
      lines: {
        product_id: number;
        product_name?: string;
        quantity: number;
        amount: number;
      }[];
    }) => api.createMahajanLendBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setLendOpen(false);
      setConfirmLendOpen(false);
      setConfirmPayload(null);
      setLendLines([emptyLine()]);
      toast.success("Lend saved");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save lend");
    },
  });

  const createDeposit = useMutation({
    mutationFn: (d: {
      mahajan_id: number;
      transaction_date: string;
      amount: number;
      notes?: string;
    }) => api.createMahajanDeposit(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      setDepositOpen(false);
      toast.success("Deposit saved");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to save deposit"),
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
      setEditingLend(null);
      toast.success("Lend updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update lend"),
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
      toast.success("Deposit updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update deposit"),
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
      toast.success("Lend deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete lend"),
  });

  const deleteDeposit = useMutation({
    mutationFn: (id: number) => api.deleteMahajanDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      toast.success("Deposit deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete deposit"),
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
      list.push({ label: "Mahajan", value: m?.name ?? String(filterMahajanId) });
    }
    if (filterType !== "all")
      list.push({ label: "Type", value: filterType });
    if (filterDateFrom) list.push({ label: "Date From", value: filterDateFrom });
    if (filterDateTo) list.push({ label: "Date To", value: filterDateTo });
    return list;
  }, [
    filterMahajanId,
    filterType,
    filterDateFrom,
    filterDateTo,
    mahajanList,
  ]);

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
    })) as { data: LedgerRow[]; total: number };
    const rows = result?.data ?? [];
    return rows.map((row) => {
      const item =
        row.product_id != null
          ? itemList.find((i) => i.id === row.product_id)
          : undefined;
      return {
        type: row.type,
        transaction_date: row.transaction_date,
        mahajan_name: row.mahajan_name,
        product_name: row.product_name,
        quantity: row.quantity,
        unit: item?.unit ?? "—",
        amount: row.amount,
        notes: row.notes,
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
    exportTransactionsToPdf(data, appliedFilters);
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
    const onAfterPrint = () => setPrintData(null);
    globalThis.addEventListener("afterprint", onAfterPrint);
    const timeoutId = setTimeout(() => globalThis.print(), 100);
    return () => {
      clearTimeout(timeoutId);
      globalThis.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printData]);

  const handleFilterChange = (updates: {
    mahajanId?: number | "";
    type?: "all" | "lend" | "deposit" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (updates.mahajanId !== undefined) setFilterMahajanId(updates.mahajanId);
    if (updates.type !== undefined) setFilterType(updates.type);
    if (updates.dateFrom !== undefined) setFilterDateFrom(updates.dateFrom);
    if (updates.dateTo !== undefined) setFilterDateTo(updates.dateTo);
    setPage(1);
  };

  const toLendRecord = (row: LedgerRow): MahajanLend => ({
    id: row.id,
    mahajan_id: row.mahajan_id ?? 0,
    product_id: row.product_id,
    product_name: row.product_name,
    quantity: row.quantity ?? 0,
    transaction_date: row.transaction_date,
    amount: row.amount,
    notes: row.notes,
    created_at: "",
    updated_at: "",
  });
  const toDepositRecord = (row: LedgerRow): MahajanDeposit => ({
    id: row.id,
    mahajan_id: row.mahajan_id ?? 0,
    transaction_date: row.transaction_date,
    amount: row.amount,
    notes: row.notes,
    created_at: "",
    updated_at: "",
  });

  const toPurchaseRecord = (row: LedgerRow): PurchaseRow => ({
    id: row.id,
    product_id: row.product_id ?? 0,
    product_name: row.product_name ?? undefined,
    transaction_date: row.transaction_date,
    quantity: row.quantity ?? 0,
    amount: row.amount,
    notes: row.notes,
    created_at: "",
    updated_at: "",
  });

  return (
    <div>
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <div className="flex gap-2">
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <button
                type="button"
                className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md text-sm hover:bg-gray-200 border border-gray-300"
              >
                Export
              </button>
            </div>
            <FloatingPortal>
              {exportOpen && (
                <div
                  ref={exportRefs.setFloating}
                  style={exportFloatingStyles}
                  {...getExportFloatingProps()}
                  className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportCsv}
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportPdf}
                  >
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={handleExportPrint}
                  >
                    Print (A4)
                  </button>
                </div>
              )}
            </FloatingPortal>
            <button
              type="button"
              onClick={() => setPurchaseAddOpen(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Cash Purchase
            </button>
            <button
              type="button"
              onClick={() => setLendOpen(true)}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700"
            >
              Add Lend
            </button>
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
            >
              Add Deposit
            </button>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white shrink-0 min-w-0"
            value={filterType}
            onChange={(e) =>
              handleFilterChange({
                type: e.target.value as
                  | "all"
                  | "lend"
                  | "deposit"
                  | "cash_purchase",
              })
            }
          >
            <option value="all">All (Lend + Deposit + Cash purchase)</option>
            <option value="lend">Lend only</option>
            <option value="deposit">Deposit only</option>
            <option value="cash_purchase">Cash purchase only</option>
          </select>
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white shrink-0 min-w-0"
            value={filterMahajanId}
            onChange={(e) =>
              handleFilterChange({
                mahajanId: e.target.value ? Number(e.target.value) : "",
              })
            }
            disabled={filterType === "cash_purchase"}
          >
            <option value="">All Mahajans</option>
            {mahajanList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMoreFiltersOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            More filters
            {(filterDateFrom || filterDateTo) && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
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
            <div className="relative bg-white rounded-lg shadow-xl w-full mx-4 max-w-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">More filters</h2>
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen(false)}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <label
                  htmlFor="more-filters-date-from"
                  className="flex flex-col gap-1.5 text-sm text-gray-600"
                >
                  From date
                  <DateInput
                    id="more-filters-date-from"
                    value={filterDateFrom}
                    onChange={(v) => handleFilterChange({ dateFrom: v })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
                  />
                </label>
                <label
                  htmlFor="more-filters-date-to"
                  className="flex flex-col gap-1.5 text-sm text-gray-600"
                >
                  To date
                  <DateInput
                    id="more-filters-date-to"
                    value={filterDateTo}
                    onChange={(v) => handleFilterChange({ dateTo: v })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
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
                    className="text-sm text-gray-600 hover:text-gray-900 underline self-start"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white">
          {ledgerLoading ? (
            <TableLoader />
          ) : unifiedRows.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="table-scroll-wrap overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Mahajan
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Product
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Unit
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                        Amount (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase max-w-[12rem]">
                        Notes
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {unifiedRows.map((row: LedgerRow) => (
                      <tr
                        key={`${row.type}-${row.id}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-2 text-sm">
                          <TransactionTypeBadge
                            type={row.type as TransactionType}
                          />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          <Tooltip
                            content={formatDateForForm(row.transaction_date)}
                          >
                            <span>
                              {formatDateForView(row.transaction_date)}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {row.mahajan_id == null ? (
                            (row.mahajan_name ?? "—")
                          ) : (
                            <Link
                              to={`/mahajans/ledger/${row.mahajan_id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {row.mahajan_name ?? "—"}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {row.type === "deposit"
                            ? "—"
                            : (row.product_name ?? "—")}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">
                          {row.type === "deposit"
                            ? "—"
                            : row.quantity != null
                              ? String(row.quantity)
                              : "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {(() => {
                            if (row.type === "deposit") return "—";
                            if (row.product_id != null) {
                              const item = (items as Item[]).find(
                                (i) => i.id === row.product_id
                              );
                              return item?.unit ?? "—";
                            }
                            return "—";
                          })()}
                        </td>
                        <td
                          className={`px-4 py-2 text-sm text-right font-medium ${amountColorClass(row.type)}`}
                        >
                          ₹{formatDecimal(row.amount)}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-gray-600 truncate max-w-[12rem]"
                          title={row.notes ?? ""}
                        >
                          {row.notes ?? "—"}
                        </td>
                        <LedgerRowActions
                          type={
                            row.type as "lend" | "deposit" | "cash_purchase"
                          }
                          onEdit={() => {
                            if (row.type === "lend")
                              setEditingLend(toLendRecord(row));
                            else if (row.type === "deposit")
                              setEditingDeposit(toDepositRecord(row));
                            else setEditingPurchase(toPurchaseRecord(row));
                          }}
                          onDelete={() => {
                            setDeleteConfirmPayload({
                              type: row.type as
                                | "lend"
                                | "deposit"
                                | "cash_purchase",
                              row,
                            });
                            setDeleteConfirmOpen(true);
                          }}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                total={totalLedger}
                limit={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      <FormModal
        title="Add Lend"
        open={lendOpen}
        onClose={() => {
          setLendOpen(false);
          setLendLines([emptyLine()]);
        }}
        maxWidth="max-w-3xl"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const mahajanId = Number(
              (form.mahajan_id as HTMLSelectElement).value
            );
            if (!lendFormDate) return;
            const notes = (form.notes as HTMLInputElement).value?.trim() || "";
            const lines: LendLine[] = lendLines
              .map((_, idx) => {
                const productId = Number(
                  (form[`product_id_${idx}`] as HTMLSelectElement)?.value
                );
                const quantity = Number(
                  (form[`quantity_${idx}`] as HTMLInputElement)?.value
                );
                const amount = Number(
                  (form[`amount_${idx}`] as HTMLInputElement)?.value
                );
                const item = itemList.find((i) => i.id === productId);
                return productId && quantity > 0 && amount >= 0
                  ? {
                      product_id: productId,
                      product_name: item?.name ?? "",
                      quantity,
                      amount,
                    }
                  : null;
              })
              .filter((l): l is LendLine => l != null);
            if (!lines.length) {
              toast.error("Add at least one product with quantity and amount.");
              return;
            }
            const mahajan = mahajanList.find((m) => m.id === mahajanId);
            setConfirmPayload({
              mahajan_id: mahajanId,
              mahajanName: mahajan?.name ?? "",
              transaction_date: lendFormDate,
              notes,
              lines,
            });
            setConfirmLendOpen(true);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mahajan *
            </label>
            <select
              name="mahajan_id"
              required
              className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={lendFormDate}
              onChange={setLendFormDate}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="border rounded p-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Products
              </span>
              <button
                type="button"
                onClick={() => setLendLines((prev) => [...prev, emptyLine()])}
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                + Add product
              </button>
            </div>
            {lendLines.map((line, idx) => {
              const selectedItem = line.product_id
                ? (items as Item[]).find((i) => i.id === line.product_id)
                : undefined;
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Product
                    </label>
                    <select
                      name={`product_id_${idx}`}
                      required={idx === 0}
                      value={line.product_id || ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const item = itemList.find((i) => i.id === id);
                        setLendLines((prev) => {
                          const next = [...prev];
                          next[idx] = {
                            ...next[idx],
                            product_id: id,
                            product_name: item?.name ?? "",
                          };
                          return next;
                        });
                      }}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {itemList.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Qty{selectedItem?.unit ? ` (${selectedItem.unit})` : ""}
                    </label>
                    <input
                      name={`quantity_${idx}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={line.quantity || ""}
                      onChange={(e) =>
                        setLendLines((prev) => {
                          const n = [...prev];
                          n[idx] = {
                            ...n[idx],
                            quantity: Number(e.target.value) || 0,
                          };
                          return n;
                        })
                      }
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Amount
                    </label>
                    <input
                      name={`amount_${idx}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={line.amount || ""}
                      onChange={(e) =>
                        setLendLines((prev) => {
                          const n = [...prev];
                          n[idx] = {
                            ...n[idx],
                            amount: Number(e.target.value) || 0,
                          };
                          return n;
                        })
                      }
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex items-end">
                    {lendLines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLendLines((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-red-600 hover:text-red-700 text-sm py-1.5"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setLendOpen(false);
                setLendLines([emptyLine()]);
              }}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 text-white rounded"
            >
              Review &amp; confirm
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Confirm Lend"
        open={confirmLendOpen}
        onClose={() => {
          setConfirmLendOpen(false);
          setConfirmPayload(null);
        }}
        maxWidth="max-w-3xl"
      >
        {confirmPayload && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Receive lend from <strong>{confirmPayload.mahajanName}</strong> on{" "}
              <Tooltip
                content={formatDateForForm(confirmPayload.transaction_date)}
              >
                <span>
                  {formatDateForView(confirmPayload.transaction_date)}
                </span>
              </Tooltip>
            </p>
            <div className="table-scroll-wrap overflow-auto max-h-60">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Old stock</th>
                    <th className="text-right p-2">Received (lent to us)</th>
                    <th className="text-right p-2">Total after update</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmPayload.lines.map((line, idx) => {
                    const item = (
                      items as {
                        id: number;
                        name: string;
                        current_stock: number;
                      }[]
                    ).find((i) => i.id === line.product_id);
                    const oldStock = item?.current_stock ?? 0;
                    const after = oldStock + line.quantity;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="p-2">
                          {line.product_name || item?.name || "—"}
                        </td>
                        <td className="p-2 text-right">{oldStock}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2 text-right">{after}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-medium">
              Total lend amount (this transaction): ₹
              {formatDecimal(
                confirmPayload.lines.reduce((s, l) => s + l.amount, 0)
              )}
            </p>
            {balanceLoading ? (
              <p className="text-sm text-gray-500">Loading balance…</p>
            ) : mahajanBalance != null ? (
              <div className="text-sm rounded border p-3 bg-gray-50 space-y-1">
                <p>Total Lends: ₹{formatDecimal(mahajanBalance.totalLends)}</p>
                <p>
                  Total Deposits: ₹{formatDecimal(mahajanBalance.totalDeposits)}
                </p>
                <p className="font-medium">
                  Balance (Lend - Deposit):{" "}
                  <span
                    className={
                      mahajanBalance.balance >= 0
                        ? "text-amber-700"
                        : "text-green-700"
                    }
                  >
                    ₹{formatDecimal(Math.abs(mahajanBalance.balance))}
                    {mahajanBalance.balance > 0 && (
                      <span className="ml-1 text-gray-500 font-normal">
                        (payable)
                      </span>
                    )}
                    {mahajanBalance.balance < 0 && (
                      <span className="ml-1 text-gray-500 font-normal">
                        (receivable)
                      </span>
                    )}
                  </span>
                </p>
                <p className="font-medium">
                  After this lend:{" "}
                  {(() => {
                    const balanceAfter =
                      mahajanBalance.balance +
                      confirmPayload.lines.reduce((s, l) => s + l.amount, 0);
                    return (
                      <span
                        className={
                          balanceAfter >= 0
                            ? "text-amber-700"
                            : "text-green-700"
                        }
                      >
                        ₹{formatDecimal(Math.abs(balanceAfter))}
                        {balanceAfter > 0 && (
                          <span className="ml-1 text-gray-500 font-normal">
                            (payable)
                          </span>
                        )}
                        {balanceAfter < 0 && (
                          <span className="ml-1 text-gray-500 font-normal">
                            (receivable)
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </p>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmLendOpen(false);
                  setConfirmPayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  createLendBatch.mutate({
                    mahajan_id: confirmPayload.mahajan_id,
                    transaction_date: confirmPayload.transaction_date,
                    notes: confirmPayload.notes || undefined,
                    lines: confirmPayload.lines.map((l) => ({
                      product_id: l.product_id,
                      product_name: l.product_name,
                      quantity: l.quantity,
                      amount: l.amount,
                    })),
                  });
                }}
                disabled={createLendBatch.isPending}
                className="px-3 py-1.5 bg-amber-600 text-white rounded disabled:opacity-50"
              >
                {createLendBatch.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Add Deposit"
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            if (!depositFormDate) return;
            createDeposit.mutate({
              mahajan_id: Number((form.mahajan_id as HTMLSelectElement).value),
              transaction_date: depositFormDate,
              amount: Number((form.amount as HTMLInputElement).value),
              notes: (form.notes as HTMLInputElement).value || undefined,
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mahajan *
            </label>
            <select
              name="mahajan_id"
              required
              className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={depositFormDate}
              onChange={setDepositFormDate}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
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
            <button
              type="button"
              onClick={() => setDepositOpen(false)}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-green-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Lend"
        open={!!editingLend && !confirmEditLendOpen}
        onClose={() => {
          setEditingLend(null);
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-3xl"
      >
        {editingLend && (
          <form
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mahajan *
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editLendDate}
                onChange={setEditLendDate}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editLendNotes}
                onChange={(e) => setEditLendNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLend(null)}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-600 text-white rounded"
              >
                Review &amp; Update
              </button>
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
      >
        {confirmEditLendPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              Summary of changes
            </p>
            <div className="rounded border border-gray-200 overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Field</th>
                    <th className="text-left p-2">Current</th>
                    <th className="text-left p-2">After update</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Date</td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditLendPayload.record.transaction_date
                      )}
                    </td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditLendPayload.newValues.transaction_date
                      )}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Mahajan</td>
                    <td className="p-2">
                      {mahajanList.find(
                        (m) => m.id === confirmEditLendPayload.record.mahajan_id
                      )?.name ?? "—"}
                    </td>
                    <td className="p-2">
                      {confirmEditLendPayload.newValues.mahajanName}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Product</td>
                    <td className="p-2">
                      {confirmEditLendPayload.record.product_name ?? "—"}
                    </td>
                    <td className="p-2">
                      {confirmEditLendPayload.newValues.product_name ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Quantity</td>
                    <td className="p-2">
                      {confirmEditLendPayload.record.quantity ?? 0}
                    </td>
                    <td className="p-2">
                      {confirmEditLendPayload.newValues.quantity}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Amount (₹)</td>
                    <td className="p-2">
                      {formatDecimal(confirmEditLendPayload.record.amount)}
                    </td>
                    <td className="p-2">
                      {formatDecimal(confirmEditLendPayload.newValues.amount)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Notes</td>
                    <td className="p-2">
                      {confirmEditLendPayload.record.notes ?? "—"}
                    </td>
                    <td className="p-2">
                      {confirmEditLendPayload.newValues.notes ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded border border-amber-100 bg-amber-50 p-3 space-y-2 text-sm">
              <p className="font-medium text-amber-900">Impact after update</p>
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
                  <p className="text-gray-700">
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
                <p className="text-gray-500">Loading balance…</p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-gray-700">
                  <p>
                    <strong>Mahajan balance:</strong> Total Lends ₹
                    {formatDecimal(editReviewBalance.totalLends)}, Total
                    Deposits ₹{formatDecimal(editReviewBalance.totalDeposits)} →{" "}
                    <span
                      className={
                        editReviewBalance.balance >= 0
                          ? "font-medium text-amber-800"
                          : "font-medium text-green-800"
                      }
                    >
                      ₹{formatDecimal(Math.abs(editReviewBalance.balance))}
                      {editReviewBalance.balance > 0 && (
                        <span className="ml-1 text-gray-500 font-normal">
                          (payable)
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-gray-500 font-normal">
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
                              ? "font-medium text-amber-800"
                              : "font-medium text-green-800"
                          }
                        >
                          After this update: Total Lends will change by ₹
                          {formatDecimal(
                            confirmEditLendPayload.newValues.amount -
                              confirmEditLendPayload.record.amount
                          )}{" "}
                          → Balance will be ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (payable)
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (receivable)
                            </span>
                          )}
                        </p>
                      );
                    })()}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmEditLendOpen(false);
                  setConfirmEditLendPayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Back
              </button>
              <button
                type="button"
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
                      notes:
                        confirmEditLendPayload.newValues.notes ?? undefined,
                    },
                  });
                  setConfirmEditLendOpen(false);
                  setConfirmEditLendPayload(null);
                  setEditingLend(null);
                }}
                disabled={updateLend.isPending}
                className="px-3 py-1.5 bg-amber-600 text-white rounded disabled:opacity-50"
              >
                {updateLend.isPending ? "Updating…" : "Confirm Update"}
              </button>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal
        title="Edit Deposit"
        open={!!editingDeposit && !confirmEditDepositOpen}
        onClose={() => {
          setEditingDeposit(null);
          setConfirmEditDepositOpen(false);
          setConfirmEditDepositPayload(null);
        }}
      >
        {editingDeposit && (
          <form
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editDepositDate}
                onChange={setEditDepositDate}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editDepositNotes}
                onChange={(e) => setEditDepositNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDeposit(null)}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-green-600 text-white rounded"
              >
                Review &amp; Update
              </button>
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
      >
        {confirmEditDepositPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              Summary of changes
            </p>
            <div className="rounded border border-gray-200 overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Field</th>
                    <th className="text-left p-2">Current</th>
                    <th className="text-left p-2">After update</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Date</td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditDepositPayload.record.transaction_date
                      )}
                    </td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditDepositPayload.newValues.transaction_date
                      )}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Amount (₹)</td>
                    <td className="p-2">
                      {formatDecimal(confirmEditDepositPayload.record.amount)}
                    </td>
                    <td className="p-2">
                      {formatDecimal(
                        confirmEditDepositPayload.newValues.amount
                      )}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Notes</td>
                    <td className="p-2">
                      {confirmEditDepositPayload.record.notes ?? "—"}
                    </td>
                    <td className="p-2">
                      {confirmEditDepositPayload.newValues.notes ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded border border-green-100 bg-green-50 p-3 space-y-2 text-sm">
              <p className="font-medium text-green-900">Impact after update</p>
              {editReviewBalanceLoading ? (
                <p className="text-gray-500">Loading balance…</p>
              ) : editReviewBalance != null ? (
                <div className="space-y-1 text-gray-700">
                  <p>
                    <strong>Mahajan balance:</strong> Total Lends ₹
                    {formatDecimal(editReviewBalance.totalLends)}, Total
                    Deposits ₹{formatDecimal(editReviewBalance.totalDeposits)} →{" "}
                    <span
                      className={
                        editReviewBalance.balance >= 0
                          ? "font-medium text-amber-800"
                          : "font-medium text-green-800"
                      }
                    >
                      ₹{formatDecimal(Math.abs(editReviewBalance.balance))}
                      {editReviewBalance.balance > 0 && (
                        <span className="ml-1 text-gray-500 font-normal">
                          (payable)
                        </span>
                      )}
                      {editReviewBalance.balance < 0 && (
                        <span className="ml-1 text-gray-500 font-normal">
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
                              ? "font-medium text-amber-800"
                              : "font-medium text-green-800"
                          }
                        >
                          After this update: Total Deposits will change by ₹
                          {formatDecimal(
                            confirmEditDepositPayload.newValues.amount -
                              confirmEditDepositPayload.record.amount
                          )}{" "}
                          → Balance will be ₹
                          {formatDecimal(Math.abs(balanceAfter))}
                          {balanceAfter > 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (payable)
                            </span>
                          )}
                          {balanceAfter < 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (receivable)
                            </span>
                          )}
                        </p>
                      );
                    })()}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmEditDepositOpen(false);
                  setConfirmEditDepositPayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Back
              </button>
              <button
                type="button"
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
                className="px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {updateDeposit.isPending ? "Updating…" : "Confirm Update"}
              </button>
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
      >
        <form
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={purchaseFormDate}
              onChange={setPurchaseFormDate}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="border rounded p-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Products
              </span>
              <button
                type="button"
                onClick={() =>
                  setPurchaseLines((prev) => [...prev, emptyPurchaseLine()])
                }
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add product
              </button>
            </div>
            {purchaseLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Product
                  </label>
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
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {itemList.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Qty
                  </label>
                  <input
                    name={`quantity_${idx}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
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
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Amount (₹) *
                  </label>
                  <input
                    name={`amount_${idx}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    required={idx === 0}
                    value={line.amount === 0 ? "" : line.amount}
                    onChange={(e) =>
                      setPurchaseLines((prev) => {
                        const n = [...prev];
                        const val = Math.floor(Number(e.target.value)) || 0;
                        n[idx] = { ...n[idx], amount: val };
                        return n;
                      })
                    }
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  {purchaseLines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPurchaseLines((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-red-600 hover:text-red-700 text-sm py-1.5"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setPurchaseAddOpen(false);
                setPurchaseLines([emptyPurchaseLine()]);
              }}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
            >
              Review &amp; confirm
            </button>
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
      >
        {confirmPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
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
            <div className="table-scroll-wrap overflow-auto max-h-60">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Old stock</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Total after</th>
                    <th className="text-right p-2">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmPurchasePayload.lines.map((line, idx) => {
                    const item = (
                      items as {
                        id: number;
                        name: string;
                        current_stock: number;
                      }[]
                    ).find((i) => i.id === line.product_id);
                    const oldStock = item?.current_stock ?? 0;
                    const after = oldStock + line.quantity;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="p-2">
                          {line.product_name || item?.name || "—"}
                        </td>
                        <td className="p-2 text-right">{oldStock}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2 text-right">{after}</td>
                        <td className="p-2 text-right">
                          ₹{formatDecimal(line.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-medium">
              Total amount: ₹
              {formatDecimal(
                confirmPurchasePayload.lines.reduce((s, l) => s + l.amount, 0)
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmPurchaseOpen(false);
                  setConfirmPurchasePayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
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
                disabled={createPurchaseBatch.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {createPurchaseBatch.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
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
      >
        {editingPurchase && (
          <form
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date * (dd/mm/yyyy)
              </label>
              <DateInput
                value={editPurchaseDate}
                onChange={setEditPurchaseDate}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <input
                type="text"
                value={editingPurchase.product_name ?? ""}
                readOnly
                className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                name="notes"
                value={editPurchaseNotes}
                onChange={(e) => setEditPurchaseNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 text-white rounded"
              >
                Review &amp; Update
              </button>
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
      >
        {confirmEditPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              Summary of changes
            </p>
            <div className="rounded border border-gray-200 overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Field</th>
                    <th className="text-left p-2">Current</th>
                    <th className="text-left p-2">After update</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Date</td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditPurchasePayload.record.transaction_date
                      )}
                    </td>
                    <td className="p-2">
                      {formatDateForView(
                        confirmEditPurchasePayload.newValues.transaction_date
                      )}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Product</td>
                    <td className="p-2" colSpan={2}>
                      {confirmEditPurchasePayload.record.product_name ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Quantity</td>
                    <td className="p-2">
                      {confirmEditPurchasePayload.record.quantity}
                    </td>
                    <td className="p-2">
                      {confirmEditPurchasePayload.newValues.quantity}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Amount (₹)</td>
                    <td className="p-2">
                      {formatDecimal(confirmEditPurchasePayload.record.amount)}
                    </td>
                    <td className="p-2">
                      {formatDecimal(
                        confirmEditPurchasePayload.newValues.amount
                      )}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Notes</td>
                    <td className="p-2">
                      {confirmEditPurchasePayload.record.notes ?? "—"}
                    </td>
                    <td className="p-2">
                      {confirmEditPurchasePayload.newValues.notes ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50 p-3 space-y-2 text-sm">
              <p className="font-medium text-blue-900">Impact after update</p>
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
                  <p className="text-gray-700">
                    <strong>Stock:</strong> Current stock {oldStock} →{" "}
                    {qtyDelta >= 0 ? "+" : ""}
                    {qtyDelta} → <strong>{newStock}</strong> after update
                  </p>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmEditPurchaseOpen(false);
                  setConfirmEditPurchasePayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Back
              </button>
              <button
                type="button"
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
                className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {updatePurchase.isPending ? "Updating…" : "Confirm Update"}
              </button>
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
      >
        {deleteConfirmPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              You are about to delete this transaction. Summary:
            </p>
            <div className="rounded border border-gray-200 overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Field</th>
                    <th className="text-left p-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Type</td>
                    <td className="p-2">
                      <TransactionTypeBadge type={deleteConfirmPayload.type} />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Date</td>
                    <td className="p-2">
                      {formatDateForView(
                        deleteConfirmPayload.row.transaction_date
                      )}
                    </td>
                  </tr>
                  {(deleteConfirmPayload.type === "lend" ||
                    deleteConfirmPayload.type === "cash_purchase") && (
                    <>
                      {deleteConfirmPayload.type === "lend" && (
                        <tr className="border-b">
                          <td className="p-2 font-medium">Mahajan</td>
                          <td className="p-2">
                            {deleteConfirmPayload.row.mahajan_name ?? "—"}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b">
                        <td className="p-2 font-medium">Product</td>
                        <td className="p-2">
                          {deleteConfirmPayload.row.product_name ?? "—"}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Quantity</td>
                        <td className="p-2">
                          {deleteConfirmPayload.row.quantity ?? "—"}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b">
                    <td className="p-2 font-medium">Amount (₹)</td>
                    <td className="p-2">
                      {formatDecimal(deleteConfirmPayload.row.amount)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Notes</td>
                    <td className="p-2">
                      {deleteConfirmPayload.row.notes ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              className={`rounded border p-3 space-y-2 text-sm ${
                deleteConfirmPayload.type === "lend"
                  ? "border-amber-100 bg-amber-50"
                  : deleteConfirmPayload.type === "deposit"
                    ? "border-green-100 bg-green-50"
                    : "border-blue-100 bg-blue-50"
              }`}
            >
              <p
                className={`font-medium ${
                  deleteConfirmPayload.type === "lend"
                    ? "text-amber-900"
                    : deleteConfirmPayload.type === "deposit"
                      ? "text-green-900"
                      : "text-blue-900"
                }`}
              >
                Impact after delete
              </p>
              {(deleteConfirmPayload.type === "lend" ||
                deleteConfirmPayload.type === "cash_purchase") &&
                deleteConfirmPayload.row.product_id != null && (
                  <p className="text-gray-700">
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
              {(deleteConfirmPayload.type === "lend" ||
                deleteConfirmPayload.type === "deposit") && (
                <>
                  {deleteReviewBalanceLoading ? (
                    <p className="text-gray-500">Loading balance…</p>
                  ) : deleteReviewBalance != null ? (
                    <div className="space-y-1 text-gray-700">
                      <p>
                        <strong>Mahajan balance:</strong> Total Lends ₹
                        {formatDecimal(deleteReviewBalance.totalLends)}, Total
                        Deposits ₹
                        {formatDecimal(deleteReviewBalance.totalDeposits)} →{" "}
                        <span
                          className={
                            deleteReviewBalance.balance >= 0
                              ? "font-medium text-amber-800"
                              : "font-medium text-green-800"
                          }
                        >
                          ₹
                          {formatDecimal(Math.abs(deleteReviewBalance.balance))}
                          {deleteReviewBalance.balance > 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (payable)
                            </span>
                          )}
                          {deleteReviewBalance.balance < 0 && (
                            <span className="ml-1 text-gray-500 font-normal">
                              (receivable)
                            </span>
                          )}
                        </span>
                      </p>
                      {(() => {
                        const balanceAfter =
                          deleteConfirmPayload.type === "lend"
                            ? deleteReviewBalance.balance -
                              deleteConfirmPayload.row.amount
                            : deleteReviewBalance.balance +
                              deleteConfirmPayload.row.amount;
                        return (
                          <p
                            className={
                              balanceAfter >= 0
                                ? "font-medium text-amber-800"
                                : "font-medium text-green-800"
                            }
                          >
                            After this delete:{" "}
                            {deleteConfirmPayload.type === "lend"
                              ? "Total Lends"
                              : "Total Deposits"}{" "}
                            will decrease by ₹
                            {formatDecimal(deleteConfirmPayload.row.amount)} →
                            Balance will be ₹
                            {formatDecimal(Math.abs(balanceAfter))}
                            {balanceAfter > 0 && (
                              <span className="ml-1 text-gray-500 font-normal">
                                (payable)
                              </span>
                            )}
                            {balanceAfter < 0 && (
                              <span className="ml-1 text-gray-500 font-normal">
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmPayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleteConfirmPayload) return;
                  if (deleteConfirmPayload.type === "lend")
                    deleteLend.mutate(deleteConfirmPayload.row.id);
                  else if (deleteConfirmPayload.type === "deposit")
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
                className="px-3 py-1.5 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {deleteLend.isPending ||
                deleteDeposit.isPending ||
                deletePurchase.isPending
                  ? "Deleting…"
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {printData && (
        <div
          className="app-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-white p-6 print:block"
          aria-hidden
        >
          <header className="mb-4 border-b border-gray-200 pb-3">
            <p className="text-sm font-semibold text-gray-900">
              Godown Stock Lite
            </p>
            <p className="text-xs text-gray-600">Transactions</p>
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
