import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import TableLoader from "../components/TableLoader";
import FormModal from "../components/FormModal";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import TransactionTypeBadge from "../components/TransactionTypeBadge";
import LedgerRowActions from "../components/LedgerRowActions";
import AddLendModal from "../components/AddLendModal";
import AddDepositModal from "../components/AddDepositModal";
import MahajanBalanceCard from "../components/MahajanBalanceCard";
import EmptyState from "../components/EmptyState";
import { formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import {
  exportMahajanLedgerToCsv,
  exportMahajanLedgerToPdf,
  getPrintTableBody,
  type MahajanBalanceForExport,
} from "../lib/exportMahajanLedger";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import {
  Download,
  ArrowLeft,
  FileDown,
  Filter,
  Plus,
  Printer,
  X,
} from "lucide-react";
import Button from "../components/Button";
import type {
  LedgerRow,
  MahajanLend,
  MahajanDeposit,
  Item,
} from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

export default function MahajanLedger() {
  const { mahajanId } = useParams<{ mahajanId: string }>();
  const navigate = useNavigate();
  const api = getElectron();
  const queryClient = useQueryClient();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
  const appName = getAppDisplayName(settings);
  const id = Number(mahajanId);
  const [editingLend, setEditingLend] = useState<MahajanLend | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<MahajanDeposit | null>(
    null
  );
  const [filterType, setFilterType] = useState<
    "all" | "credit_purchase" | "settlement"
  >("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [editLendDate, setEditLendDate] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");
  const [confirmEditLendOpen, setConfirmEditLendOpen] = useState(false);
  const [confirmEditLendPayload, setConfirmEditLendPayload] = useState<{
    record: MahajanLend;
    newValues: {
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPayload, setDeleteConfirmPayload] = useState<{
    type: "credit_purchase" | "settlement";
    row: LedgerRow;
    record: MahajanLend | MahajanDeposit;
  } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    columns: string[];
    rows: string[][];
    mahajanName: string;
    balance: MahajanBalanceForExport | null;
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
    if (editingLend)
      queueMicrotask(() => setEditLendDate(editingLend.transaction_date));
  }, [editingLend]);
  const [editLendProductId, setEditLendProductId] = useState<number | null>(
    null
  );
  const [editLendQuantity, setEditLendQuantity] = useState<number>(0);
  const [editLendAmount, setEditLendAmount] = useState<number>(0);
  const [editLendNotes, setEditLendNotes] = useState("");
  useEffect(() => {
    if (editingLend) {
      const e = editingLend;
      queueMicrotask(() => {
        setEditLendProductId(e.product_id ?? null);
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

  const { data: mahajans = [] } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
  });

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ["mahajanLedger", id],
    queryFn: () => api.getMahajanLedger(id) as Promise<LedgerRow[]>,
    enabled: !!id,
  });

  const { data: lends = [] } = useQuery<MahajanLend[]>({
    queryKey: ["mahajanLends", id],
    queryFn: () => api.getMahajanLends(id) as Promise<MahajanLend[]>,
    enabled: !!id,
  });

  const { data: deposits = [] } = useQuery<MahajanDeposit[]>({
    queryKey: ["mahajanDeposits", id],
    queryFn: () => api.getMahajanDeposits(id) as Promise<MahajanDeposit[]>,
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["mahajanBalance", id],
    queryFn: () =>
      api.getMahajanBalance(id) as Promise<{
        totalLends: number;
        totalDeposits: number;
        balance: number;
      }>,
    enabled: !!id,
  });

  const mahajan = (mahajans as { id: number; name: string }[]).find(
    (m) => m.id === id
  );
  const itemList = items as Item[];

  const updateLend = useMutation({
    mutationFn: ({
      id: lendId,
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
    }) => api.updateMahajanLend(lendId, l),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends", id] });
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
      id: depositId,
      d,
    }: {
      id: number;
      d: { transaction_date?: string; amount?: number; notes?: string };
    }) => api.updateMahajanDeposit(depositId, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits", id] });
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
    mutationFn: (lendId: number) => api.deleteMahajanLend(lendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends", id] });
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
    mutationFn: (depositId: number) => api.deleteMahajanDeposit(depositId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      toast.success("Settlement deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete settlement"),
  });

  const getLendRecord = (row: LedgerRow): MahajanLend | undefined =>
    lends.find((l) => l.id === row.id);
  const getDepositRecord = (row: LedgerRow): MahajanDeposit | undefined =>
    deposits.find((d) => d.id === row.id);

  const filteredLedger = useMemo(() => {
    return ledger.filter((row) => {
      if (filterType !== "all" && row.type !== filterType) return false;
      if (filterDateFrom && row.transaction_date < filterDateFrom) return false;
      if (filterDateTo && row.transaction_date > filterDateTo) return false;
      return true;
    });
  }, [ledger, filterType, filterDateFrom, filterDateTo]);

  const handleFilterChange = (updates: {
    type?: "all" | "credit_purchase" | "settlement";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (updates.type !== undefined) setFilterType(updates.type);
    if (updates.dateFrom !== undefined) setFilterDateFrom(updates.dateFrom);
    if (updates.dateTo !== undefined) setFilterDateTo(updates.dateTo);
  };

  const mahajanLabel = mahajan?.name ?? `ID ${id}`;

  const appliedFilters = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (filterType !== "all") list.push({ label: "Type", value: filterType });
    if (filterDateFrom)
      list.push({ label: "Date From", value: filterDateFrom });
    if (filterDateTo) list.push({ label: "Date To", value: filterDateTo });
    return list;
  }, [filterType, filterDateFrom, filterDateTo]);

  function handleExportCsv() {
    setExportOpen(false);
    if (filteredLedger.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportMahajanLedgerToCsv(filteredLedger, mahajanLabel, appliedFilters);
    toast.success("Exported as CSV.");
  }

  function handleExportPdf() {
    setExportOpen(false);
    if (filteredLedger.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportMahajanLedgerToPdf(
      filteredLedger,
      mahajanLabel,
      balance ?? null,
      appliedFilters,
      appName
    );
    toast.success("Exported as PDF.");
  }

  function handleExportPrint() {
    setExportOpen(false);
    if (filteredLedger.length === 0) {
      toast.error("No data to export.");
      return;
    }
    setPrintData({
      ...getPrintTableBody(filteredLedger, appliedFilters),
      mahajanName: mahajanLabel,
      balance: balance ?? null,
    });
  }

  useEffect(() => {
    if (!printData) return;
    const previousTitle = document.title;
    const name = (printData.mahajanName ?? "")
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "_");
    const base = name ? `Lender_Ledger_${name}` : "Lender_Ledger";
    document.title = `${base}_${formatDateForFile(new Date())}`;
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

  if (!id) return <div className="text-[var(--color-text-tertiary)]">Invalid Lender</div>;

  return (
    <div>
      <div className="sticky top-0 z-20 bg-[var(--color-bg-app)] pt-6 pb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Back
          </button>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            Ledger: {mahajan?.name ?? `ID ${id}`}
          </h1>
        </div>
        <div className="flex gap-2">
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
          <Button variant="amber" onClick={() => setLendModalOpen(true)}>
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
            Add Credit Purchase
          </Button>
          <Button variant="green" onClick={() => setDepositModalOpen(true)}>
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
            Add Settlement
          </Button>
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] overflow-hidden mb-4">
        <select
          className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] shrink-0 min-w-0"
          value={filterType}
          onChange={(e) =>
            handleFilterChange({
              type: e.target.value as "all" | "credit_purchase" | "settlement",
            })
          }
        >
          <option value="all">All (Credit Purchase + Settlement)</option>
          <option value="credit_purchase">Credit Purchase only</option>
          <option value="settlement">Settlement only</option>
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
                htmlFor="mahajan-ledger-date-from"
                className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
              >
                From date
                <DateInput
                  id="mahajan-ledger-date-from"
                  value={filterDateFrom}
                  onChange={(v) => handleFilterChange({ dateFrom: v })}
                  className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                />
              </label>
              <label
                htmlFor="mahajan-ledger-date-to"
                className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
              >
                To date
                <DateInput
                  id="mahajan-ledger-date-to"
                  value={filterDateTo}
                  onChange={(v) => handleFilterChange({ dateTo: v })}
                  className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                />
              </label>
              {(filterType !== "all" || filterDateFrom || filterDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    handleFilterChange({
                      type: "all",
                      dateFrom: "",
                      dateTo: "",
                    });
                    setMoreFiltersOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] self-start"
                >
                  <X size={16} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <MahajanBalanceCard
        balance={balance}
        loading={balanceLoading}
        variant="row"
      />
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="table-scroll-wrap overflow-x-auto">
          {isLoading ? (
            <TableLoader />
          ) : filteredLedger.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="min-w-full divide-y divide-[var(--color-border-default)]">
              <thead className="bg-[var(--color-bg-surface-raised)]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                {filteredLedger.map((row) => {
                  const amountColorClass =
                    row.type === "credit_purchase" ? "text-[var(--color-warning-text)]" : "text-[var(--color-success)]";
                  return (
                    <tr
                      key={`${row.type}-${row.id}`}
                      className="hover:bg-[var(--color-bg-surface-raised)]"
                    >
                      <td className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
                        <Tooltip
                          content={formatDateForForm(row.transaction_date)}
                        >
                          <span>{formatDateForView(row.transaction_date)}</span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <TransactionTypeBadge type={row.type} />
                      </td>
                      <td className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
                        <span className="block">{row.description}</span>
                        {row.type === "credit_purchase" && (() => {
                          const rec = getLendRecord(row) as
                            | (MahajanLend & {
                                lender_invoice_number?: string | null;
                                invoice_file_path?: string | null;
                              })
                            | undefined;
                          if (!rec) return null;
                          const invNum = rec.lender_invoice_number;
                          const invPath = rec.invoice_file_path;
                          return (
                            (invNum || invPath) && (
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[var(--color-text-tertiary)]">
                                {invNum && (
                                  <span title="Lender invoice">
                                    #{invNum}
                                  </span>
                                )}
                                {invPath && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      api.openCreditPurchaseInvoice(invPath)
                                    }
                                    className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline"
                                  >
                                    View invoice
                                  </button>
                                )}
                              </span>
                            )
                          );
                        })()}
                        {row.type === "settlement" && (() => {
                          const rec = getDepositRecord(row) as
                            | (MahajanDeposit & {
                                payment_method?: string | null;
                                reference_number?: string | null;
                              })
                            | undefined;
                          if (!rec) return null;
                          const pm = rec.payment_method;
                          const ref = rec.reference_number;
                          return (
                            (pm || ref) && (
                              <span className="block mt-1 text-xs text-[var(--color-text-tertiary)]">
                                {pm && (
                                  <span className="capitalize">{pm}</span>
                                )}
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
                        className={`px-4 py-2 text-sm text-right font-medium ${amountColorClass}`}
                      >
                        {formatDecimal(row.amount)}
                      </td>
                      <LedgerRowActions
                        type={row.type}
                        onEdit={() => {
                          if (row.type === "credit_purchase") {
                            const rec = getLendRecord(row);
                            if (rec) setEditingLend(rec);
                            else toast.error("Credit purchase record not found");
                          } else {
                            const rec = getDepositRecord(row);
                            if (rec) setEditingDeposit(rec);
                            else toast.error("Settlement record not found");
                          }
                        }}
                        onDelete={() => {
                          if (row.type === "credit_purchase") {
                            const rec = getLendRecord(row);
                            if (rec) {
                              setDeleteConfirmPayload({
                                type: "credit_purchase",
                                row,
                                record: rec,
                              });
                              setDeleteConfirmOpen(true);
                            } else toast.error("Credit purchase record not found");
                          } else {
                            const rec = getDepositRecord(row);
                            if (rec) {
                              setDeleteConfirmPayload({
                                type: "settlement",
                                row,
                                record: rec,
                              });
                              setDeleteConfirmOpen(true);
                            } else toast.error("Settlement record not found");
                          }
                        }}
                      />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <FormModal
        title="Edit Lend"
        open={!!editingLend && !confirmEditLendOpen}
        onClose={() => {
          setEditingLend(null);
          setConfirmEditLendOpen(false);
          setConfirmEditLendPayload(null);
        }}
        maxWidth="max-w-3xl"
        footer={
          editingLend ? (
            <button
              type="submit"
              form="edit-lend-form"
              className="px-3 py-1.5 bg-[var(--color-warning-text)] text-white rounded"
            >
              Review &amp; Update
            </button>
          ) : null
        }
      >
        {editingLend && (
          <form
            id="edit-lend-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const productId = editLendProductId;
              const item = productId
                ? itemList.find((i) => i.id === productId)
                : undefined;
              if (!editLendDate) return;
              setConfirmEditLendPayload({
                record: editingLend,
                newValues: {
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
                  const it = itemList.find((i) => i.id === editLendProductId);
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
          confirmEditLendPayload ? (
            <>
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
                      mahajan_id: id,
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
                className="px-3 py-1.5 bg-[var(--color-warning-text)] text-white rounded disabled:opacity-50"
              >
                {updateLend.isPending ? "Updating…" : "Confirm Update"}
              </button>
            </>
          ) : null
        }
      >
        {confirmEditLendPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Summary of changes
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-surface-raised)] border-b">
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
            <div className="rounded border border-[var(--color-warning-subtle)] bg-[var(--color-warning-subtle)] p-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--color-warning-text)]">Impact after update</p>
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
              {balanceLoading || balance == null ? (
                <p className="text-[var(--color-text-tertiary)]">Loading balance…</p>
              ) : (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>Mahajan balance:</strong> Total Lends ₹
                    {formatDecimal(balance.totalLends)}, Total Deposits ₹
                    {formatDecimal(balance.totalDeposits)} →{" "}
                    <span
                      className={
                        balance.balance >= 0
                          ? "font-medium text-[var(--color-warning-text)]"
                          : "font-medium text-[var(--color-success)]"
                      }
                    >
                      ₹{formatDecimal(Math.abs(balance.balance))}
                      {balance.balance > 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (payable)
                        </span>
                      )}
                      {balance.balance < 0 && (
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
                        balance.balance -
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
                          After this update: Total Lends will change by ₹
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
              )}
            </div>
          </div>
        )}
      </FormModal>

      <AddLendModal
        open={lendModalOpen}
        onClose={() => setLendModalOpen(false)}
        fixedMahajanId={id}
        fixedMahajanName={mahajan?.name}
      />
      <AddDepositModal
        open={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        fixedMahajanId={id}
      />

      <FormModal
        title="Edit Deposit"
        open={!!editingDeposit && !confirmEditDepositOpen}
        onClose={() => {
          setEditingDeposit(null);
          setConfirmEditDepositOpen(false);
          setConfirmEditDepositPayload(null);
        }}
        footer={
          editingDeposit ? (
            <button
              type="submit"
              form="edit-deposit-form"
              className="px-3 py-1.5 bg-[var(--color-success)] text-white rounded"
            >
              Review &amp; Update
            </button>
          ) : null
        }
      >
        {editingDeposit && (
          <form
            id="edit-deposit-form"
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
          confirmEditDepositPayload ? (
            <>
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
                className="px-3 py-1.5 bg-[var(--color-success)] text-white rounded disabled:opacity-50"
              >
                {updateDeposit.isPending ? "Updating…" : "Confirm Update"}
              </button>
            </>
          ) : null
        }
      >
        {confirmEditDepositPayload && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Summary of changes
            </p>
            <div className="rounded border border-[var(--color-border-default)] overflow-hidden text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-surface-raised)] border-b">
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
            <div className="rounded border border-[var(--color-success-subtle)] bg-[var(--color-success-subtle)] p-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--color-success)]">Impact after update</p>
              {balanceLoading || balance == null ? (
                <p className="text-[var(--color-text-tertiary)]">Loading balance…</p>
              ) : (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>Mahajan balance:</strong> Total Lends ₹
                    {formatDecimal(balance.totalLends)}, Total Deposits ₹
                    {formatDecimal(balance.totalDeposits)} →{" "}
                    <span
                      className={
                        balance.balance >= 0
                          ? "font-medium text-[var(--color-warning-text)]"
                          : "font-medium text-[var(--color-success)]"
                      }
                    >
                      ₹{formatDecimal(Math.abs(balance.balance))}
                      {balance.balance > 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (payable)
                        </span>
                      )}
                      {balance.balance < 0 && (
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
                        balance.balance +
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
                          After this update: Total Deposits will change by ₹
                          {confirmEditDepositPayload.newValues.amount -
                            confirmEditDepositPayload.record.amount}{" "}
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
              )}
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
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmPayload(null);
                }}
                className="px-3 py-1.5 border rounded"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleteConfirmPayload) return;
                  if (deleteConfirmPayload.type === "credit_purchase")
                    deleteLend.mutate(deleteConfirmPayload.row.id);
                  else deleteDeposit.mutate(deleteConfirmPayload.row.id);
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmPayload(null);
                }}
                disabled={deleteLend.isPending || deleteDeposit.isPending}
                className="px-3 py-1.5 bg-[var(--color-danger)] text-white rounded disabled:opacity-50"
              >
                {deleteLend.isPending || deleteDeposit.isPending
                  ? "Deleting…"
                  : "Confirm Delete"}
              </button>
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
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-surface-raised)] border-b">
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
                  {deleteConfirmPayload.type === "credit_purchase" && (
                    <>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Product</td>
                        <td className="p-2">
                          {(deleteConfirmPayload.record as MahajanLend)
                            .product_name ?? "—"}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Quantity</td>
                        <td className="p-2">
                          {(deleteConfirmPayload.record as MahajanLend)
                            .quantity ?? "—"}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b">
                    <td className="p-2 font-medium">Amount (₹)</td>
                    <td className="p-2">
                      {formatDecimal(deleteConfirmPayload.record.amount)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Notes</td>
                    <td className="p-2">
                      {deleteConfirmPayload.record.notes ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              className={`rounded border p-3 space-y-2 text-sm ${
                deleteConfirmPayload.type === "credit_purchase"
                  ? "border-[var(--color-warning-subtle)] bg-[var(--color-warning-subtle)]"
                  : "border-[var(--color-success-subtle)] bg-[var(--color-success-subtle)]"
              }`}
            >
              <p
                className={`font-medium ${
                  deleteConfirmPayload.type === "credit_purchase"
                    ? "text-[var(--color-warning-text)]"
                    : "text-[var(--color-success)]"
                }`}
              >
                Impact after delete
              </p>
              {deleteConfirmPayload.type === "credit_purchase" &&
                (deleteConfirmPayload.record as MahajanLend).product_id !=
                  null && (
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>Stock:</strong>{" "}
                    {(() => {
                      const lendRecord =
                        deleteConfirmPayload.record as MahajanLend;
                      const item = (
                        items as { id: number; current_stock: number }[]
                      ).find((i) => i.id === lendRecord.product_id!);
                      const oldStock = item?.current_stock ?? 0;
                      const qty = lendRecord.quantity ?? 0;
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
              {balanceLoading || balance == null ? (
                <p className="text-[var(--color-text-tertiary)]">Loading balance…</p>
              ) : (
                <div className="space-y-1 text-[var(--color-text-secondary)]">
                  <p>
                    <strong>Mahajan balance:</strong> Total Lends ₹
                    {formatDecimal(balance.totalLends)}, Total Deposits ₹
                    {formatDecimal(balance.totalDeposits)} →{" "}
                    <span
                      className={
                        balance.balance >= 0
                          ? "font-medium text-[var(--color-warning-text)]"
                          : "font-medium text-[var(--color-success)]"
                      }
                    >
                      ₹{formatDecimal(Math.abs(balance.balance))}
                      {balance.balance > 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (payable)
                        </span>
                      )}
                      {balance.balance < 0 && (
                        <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">
                          (receivable)
                        </span>
                      )}
                    </span>
                  </p>
                  {(() => {
                    const balanceAfter =
                      deleteConfirmPayload.type === "credit_purchase"
                        ? balance.balance - deleteConfirmPayload.record.amount
                        : balance.balance + deleteConfirmPayload.record.amount;
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
                          ? "Total Lends"
                          : "Total Deposits"}{" "}
                        will decrease by ₹
                        {formatDecimal(deleteConfirmPayload.record.amount)} →
                        Balance will be ₹{formatDecimal(Math.abs(balanceAfter))}
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
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{appName}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Mahajan Ledger</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Mahajan: {printData.mahajanName}
            </p>
            {printData.filterDetails != null &&
              printData.filterDetails.length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium text-[var(--color-text-secondary)]">Applied filters</p>
                  {printData.filterDetails.map((f) => (
                    <p key={f.label} className="text-[var(--color-text-secondary)]">
                      {f.label}: {f.value}
                    </p>
                  ))}
                </div>
              )}
            {printData.balance != null && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">Total Lends</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.balance.totalLends)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">Total Deposits</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.balance.totalDeposits)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">Balance (Lend - Deposit)</span>
                  <span className="ml-2">
                    ₹{formatDecimal(Math.abs(printData.balance.balance))}
                    {printData.balance.balance > 0 && " (payable)"}
                    {printData.balance.balance < 0 && " (receivable)"}
                  </span>
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
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
