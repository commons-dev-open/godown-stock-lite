import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import DateInput from "../components/DateInput";
import TransactionTypeBadge, {
  type TransactionType,
} from "../components/TransactionTypeBadge";
import DataTable from "../components/DataTable";
import AddLendModal from "../components/AddLendModal";
import AddDepositModal from "../components/AddDepositModal";
import { PAGE_SIZE } from "../../shared/constants";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  MahajansSectionPanel,
} from "../components/mahajans-page";
import {
  MahajanLedgerHero,
  MahajanLedgerFiltersBar,
  MahajanLedgerTable,
  MahajanLedgerAsyncPanel,
} from "../components/mahajan-ledger-page";
import { mahajanNetBalanceTextClass } from "../components/mahajans-page/mahajanBalanceTextClass";
import { formatDateForView } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import {
  exportMahajanLedgerToCsv,
  getPrintTableBody,
  type MahajanBalanceForExport,
} from "../lib/exportMahajanLedger";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile, sanitizeForFilename } from "../lib/exportUtils";
import {
  useElectronHtmlPrintJob,
  type HtmlPrintJobBase,
} from "../hooks/useElectronHtmlPrintJob";
import { Download, FileDown, Printer } from "lucide-react";
import Button from "../components/Button";
import type { MahajanLend, MahajanDeposit, Item } from "../../shared/types";
import {
  formatDecimal,
  formatAbbreviatedRupee,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import {
  pageRowToLedgerRow,
  toLendRecord,
  toDepositRecord,
  type LenderLedgerPageRow,
} from "../lib/lenderLedgerRow";
import {
  type ModalFieldDiffRow,
  MODAL_FIELD_DIFF_COLUMNS,
  type ModalKVRow,
  MODAL_KV_COLUMNS,
} from "../lib/modalTableColumns";

function buildMahajanLedgerDeleteRows(p: {
  type: "credit_purchase" | "settlement";
  row: LenderLedgerPageRow;
  record: MahajanLend | MahajanDeposit;
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
  if (p.type === "credit_purchase") {
    const lend = p.record as MahajanLend;
    rows.push(
      {
        id: nextId++,
        fieldLabel: "Product",
        value: lend.product_name ?? "—",
      },
      {
        id: nextId++,
        fieldLabel: "Quantity",
        value: lend.quantity ?? "—",
      }
    );
  }
  rows.push(
    {
      id: nextId++,
      fieldLabel: "Amount (₹)",
      value: formatDecimal(p.record.amount),
    },
    {
      id: nextId++,
      fieldLabel: "Notes",
      value: p.record.notes ?? "—",
    }
  );
  return rows;
}

export default function MahajanLedger() {
  const { t } = useTranslation("mahajans");
  const { t: tTx } = useTranslation("transactions");
  const { mahajanId } = useParams<{ mahajanId: string }>();
  const navigate = useNavigate();
  const api = getElectron();
  const queryClient = useQueryClient();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
  });
  const appName = getAppDisplayName(settings);
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );

  const ledgerDescriptionLabels = useMemo(
    () => ({
      settlement: t("ledger.descriptions.settlement"),
      cashPurchase: t("ledger.descriptions.cashPurchase"),
      creditPurchase: t("ledger.descriptions.creditPurchase"),
    }),
    [t]
  );

  const ledgerExportColumnLabels = useMemo(
    () => [
      t("ledger.columns.date"),
      t("ledger.columns.type"),
      t("ledger.columns.description"),
      t("ledger.columns.amount"),
    ],
    [t]
  );

  const translateLedgerType = useCallback(
    (ty: string) => String(tTx(`types.${ty}`, { defaultValue: ty })),
    [tTx]
  );

  const [page, setPage] = useState(1);
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
    row: LenderLedgerPageRow;
    record: MahajanLend | MahajanDeposit;
  } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  type MahajanLedgerPrintJob = null | (HtmlPrintJobBase & {
    columns: string[];
    rows: string[][];
    mahajanName: string;
    balance: MahajanBalanceForExport | null;
    filterDetails?: { label: string; value: string }[];
  });
  const [printJob, setPrintJob] = useState<MahajanLedgerPrintJob>(null);

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

  const { data: mahajans = [], isSuccess: mahajansLoaded } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
  });

  const {
    data: ledgerPage,
    isLoading: ledgerLoading,
    isError: ledgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: [
      "mahajanLedger",
      id,
      filterType,
      filterDateFrom,
      filterDateTo,
      page,
    ],
    queryFn: () =>
      api.getMahajanLedgerPage({
        mahajanId: id,
        transactionType: filterType,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: LenderLedgerPageRow[]; total: number }>,
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 15_000,
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
    enabled: Number.isFinite(id) && id > 0,
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
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setEditingLend(null);
      toast.success(t("ledger.toasts.creditPurchaseUpdated"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("ledger.toasts.creditPurchaseUpdateFailed")),
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
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      setEditingDeposit(null);
      toast.success(t("ledger.toasts.settlementUpdated"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("ledger.toasts.settlementUpdateFailed")),
  });

  const deleteLend = useMutation({
    mutationFn: (lendId: number) => api.deleteMahajanLend(lendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      toast.success(t("ledger.toasts.creditPurchaseDeleted"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("ledger.toasts.creditPurchaseDeleteFailed")),
  });

  const deleteDeposit = useMutation({
    mutationFn: (depositId: number) => api.deleteMahajanDeposit(depositId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      toast.success(t("ledger.toasts.settlementDeleted"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("ledger.toasts.settlementDeleteFailed")),
  });

  const handleFilterChange = (updates: {
    type?: "all" | "credit_purchase" | "settlement";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (updates.type !== undefined) setFilterType(updates.type);
    if (updates.dateFrom !== undefined) setFilterDateFrom(updates.dateFrom);
    if (updates.dateTo !== undefined) setFilterDateTo(updates.dateTo);
    setPage(1);
  };

  const clearLedgerFilters = useCallback(() => {
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  }, []);

  const mahajanLabel = mahajan?.name ?? `ID ${id}`;

  const unifiedRows = ledgerPage?.data ?? [];
  const totalLedger = ledgerPage?.total ?? 0;

  const filterTypeDisplay =
    filterType === "credit_purchase"
      ? t("hero.creditPurchase")
      : filterType === "settlement"
        ? t("hero.settlements")
        : filterType;

  const appliedFilters = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (filterType !== "all") {
      list.push({ label: t("ledger.filters.type"), value: filterTypeDisplay });
    }
    if (filterDateFrom) {
      list.push({ label: t("ledger.filters.dateFrom"), value: filterDateFrom });
    }
    if (filterDateTo) {
      list.push({ label: t("ledger.filters.dateTo"), value: filterDateTo });
    }
    return list;
  }, [filterType, filterTypeDisplay, filterDateFrom, filterDateTo, t]);

  const fetchLedgerRowsForExport = useCallback(async () => {
    const result = (await api.getMahajanLedgerPage({
      mahajanId: id,
      transactionType: filterType,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      page: 1,
      limit: 999_999,
    })) as { data: LenderLedgerPageRow[]; total: number };
    return (result.data ?? []).map((row) =>
      pageRowToLedgerRow(row, ledgerDescriptionLabels)
    );
  }, [
    api,
    id,
    filterType,
    filterDateFrom,
    filterDateTo,
    ledgerDescriptionLabels,
  ]);

  const ledgerHasActiveFilters =
    filterType !== "all" || Boolean(filterDateFrom) || Boolean(filterDateTo);
  const isLedgerEmpty =
    !ledgerLoading &&
    !ledgerError &&
    totalLedger === 0 &&
    !ledgerPage?.data?.length;

  const totalCreditDisplay = useMemo(() => {
    if (balanceLoading && balance == null) {
      return "…";
    }
    if (balance != null) {
      return formatAbbreviatedRupee(balance.totalLends, abbreviationStyle);
    }
    return "—";
  }, [abbreviationStyle, balanceLoading, balance]);

  const totalSettlementDisplay = useMemo(() => {
    if (balanceLoading && balance == null) {
      return "…";
    }
    if (balance != null) {
      return formatAbbreviatedRupee(balance.totalDeposits, abbreviationStyle);
    }
    return "—";
  }, [abbreviationStyle, balanceLoading, balance]);

  const balanceDisplay = useMemo(() => {
    if (balanceLoading && balance == null) {
      return "…";
    }
    if (balance != null) {
      return formatAbbreviatedRupee(
        Math.abs(balance.balance),
        abbreviationStyle
      );
    }
    return "—";
  }, [abbreviationStyle, balanceLoading, balance]);

  const balanceSuffix = useMemo(() => {
    if (balance == null) {
      return "";
    }
    if (balance.balance > 0) {
      return t("labels.payable");
    }
    if (balance.balance < 0) {
      return t("labels.receivable");
    }
    return "";
  }, [balance]);

  const balanceValueClassName = useMemo(() => {
    if (balance == null) {
      return "text-[var(--color-text-primary)]";
    }
    return mahajanNetBalanceTextClass(balance.balance);
  }, [balance]);

  async function handleExportCsv() {
    setExportOpen(false);
    const rows = await fetchLedgerRowsForExport();
    if (rows.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    exportMahajanLedgerToCsv(rows, mahajanLabel, appliedFilters, {
      columnLabels: ledgerExportColumnLabels,
      filterSectionTitle: t("print.appliedFilters"),
      translateType: translateLedgerType,
    });
    toast.success(t("export.csvSuccess"));
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const rows = await fetchLedgerRowsForExport();
    if (rows.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const safeName = sanitizeForFilename(mahajanLabel);
    const table = getPrintTableBody(
      rows,
      appliedFilters,
      ledgerExportColumnLabels,
      translateLedgerType
    );
    const name = (mahajanLabel ?? "")
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "_");
    const base = name
      ? `${t("print.ledgerFileNamePrefix")}_${name}`
      : t("print.ledgerFileNamePrefix");
    setPrintJob({
      mode: "pdf",
      documentTitle: `${base}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `lender-ledger-${safeName}-${formatDateForFile(new Date())}.pdf`,
      ...table,
      mahajanName: mahajanLabel,
      balance: balance ?? null,
    });
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const rows = await fetchLedgerRowsForExport();
    if (rows.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const table = getPrintTableBody(
      rows,
      appliedFilters,
      ledgerExportColumnLabels,
      translateLedgerType
    );
    const name = (mahajanLabel ?? "")
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "_");
    const base = name
      ? `${t("print.ledgerFileNamePrefix")}_${name}`
      : t("print.ledgerFileNamePrefix");
    setPrintJob({
      mode: "browser",
      documentTitle: `${base}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `lender-ledger-${sanitizeForFilename(mahajanLabel)}-${formatDateForFile(new Date())}.pdf`,
      ...table,
      mahajanName: mahajanLabel,
      balance: balance ?? null,
    });
  }

  useElectronHtmlPrintJob(printJob, setPrintJob, api, {
    onPdfFinished: ({ saved }) => {
      if (saved) {
        toast.success(t("export.pdfSuccess"));
      }
    },
    onPdfError: () => {
      toast.error(t("export.pdfFailed"));
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
        {t("ledger.invalidLender")}
      </div>
    );
  }

  const lenderNotInDirectory =
    mahajansLoaded &&
    !(mahajans as { id: number }[]).some((m) => m.id === id);

  const countBadge = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
        {totalLedger}
      </span>
    </span>
  );

  const heroToolbar = (
    <>
      <div ref={exportRefs.setReference} {...getExportRefProps()}>
        <Button variant="secondary" type="button" className="shrink-0 whitespace-nowrap">
          <Download size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
          {t("actions.export")}
        </Button>
      </div>
      <FloatingPortal>
        {exportOpen && (
          <div
            ref={exportRefs.setFloating}
            style={exportFloatingStyles}
            {...getExportFloatingProps()}
            className="z-50 min-w-[160px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-1 shadow-lg"
          >
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={() => {
                void handleExportCsv();
              }}
            >
              <FileDown size={16} className="shrink-0" />
              {t("actions.exportAsCsv")}
            </button>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={() => {
                void handleExportPdf();
              }}
            >
              <FileDown size={16} className="shrink-0" />
              {t("actions.exportAsPdf")}
            </button>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={() => {
                void handleExportPrint();
              }}
            >
              <Printer size={16} className="shrink-0" />
              {t("actions.print")}
            </button>
          </div>
        )}
      </FloatingPortal>
    </>
  );

  return (
    <div className="home-dashboard space-y-4 pb-3">
      <MahajanLedgerHero
        lenderTitle={mahajanLabel}
        totalCreditDisplay={totalCreditDisplay}
        totalSettlementDisplay={totalSettlementDisplay}
        balanceDisplay={balanceDisplay}
        balanceSuffix={balanceSuffix}
        balanceValueClassName={balanceValueClassName}
        toolbar={heroToolbar}
        onBack={() => {
          navigate("/mahajans");
        }}
        onAddCreditPurchase={() => {
          setLendModalOpen(true);
        }}
        onAddSettlement={() => {
          setDepositModalOpen(true);
        }}
      />

      {lenderNotInDirectory ? (
        <p
          className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
          role="status"
        >
          This lender is not in your directory (they may have been removed). You
          can still view entries that remain in the database for this id.
        </p>
      ) : null}

      <DashboardSectionBoundary
        sectionTitle={t("ledger.sectionTitle")}
        containerClassName="dashboard-panel"
        resetKeys={[
          id,
          filterType,
          filterDateFrom,
          filterDateTo,
          page,
          ledgerLoading,
          ledgerError,
          unifiedRows.length,
        ]}
      >
        <MahajansSectionPanel
          title={t("ledger.entriesTitle")}
          description={t("ledger.entriesDescription")}
          badge={countBadge}
        >
          <MahajanLedgerFiltersBar
            filterType={filterType}
            filterDateFrom={filterDateFrom}
            filterDateTo={filterDateTo}
            moreFiltersOpen={moreFiltersOpen}
            onMoreFiltersOpenChange={setMoreFiltersOpen}
            onFilterChange={handleFilterChange}
          />

          <div className="mt-4">
            <MahajanLedgerAsyncPanel
              isLoading={ledgerLoading}
              isError={ledgerError}
              onRetry={() => {
                void refetchLedger();
              }}
              isEmpty={isLedgerEmpty}
              emptyTitle={
                ledgerHasActiveFilters
                  ? t("ledger.empty.matchingEntriesTitle")
                  : t("ledger.empty.noEntriesTitle")
              }
              emptyDescription={
                ledgerHasActiveFilters
                  ? t("ledger.empty.matchingEntriesDescription")
                  : t("ledger.empty.noEntriesDescription")
              }
              emptyActionLabel={
                ledgerHasActiveFilters
                  ? t("ledger.actions.clearFilters")
                  : t("hero.creditPurchase")
              }
              onEmptyAction={
                ledgerHasActiveFilters
                  ? clearLedgerFilters
                  : () => {
                      setLendModalOpen(true);
                    }
              }
              emptySecondaryLabel={
                ledgerHasActiveFilters
                  ? t("hero.creditPurchase")
                  : t("hero.settlements")
              }
              onEmptySecondary={
                ledgerHasActiveFilters
                  ? () => {
                      setLendModalOpen(true);
                    }
                  : () => {
                      setDepositModalOpen(true);
                    }
              }
            >
              <MahajanLedgerTable
                rows={unifiedRows}
                onOpenInvoice={(path) => {
                  void api.openCreditPurchaseInvoice(path);
                }}
                onEditRow={(row) => {
                  if (row.type === "credit_purchase") {
                    setEditingLend(toLendRecord(row));
                  } else {
                    setEditingDeposit(toDepositRecord(row));
                  }
                }}
                onDeleteRow={(row) => {
                  if (row.type === "credit_purchase") {
                    setDeleteConfirmPayload({
                      type: "credit_purchase",
                      row,
                      record: toLendRecord(row),
                    });
                    setDeleteConfirmOpen(true);
                  } else {
                    setDeleteConfirmPayload({
                      type: "settlement",
                      row,
                      record: toDepositRecord(row),
                    });
                    setDeleteConfirmOpen(true);
                  }
                }}
                pagination={{
                  type: "controlled",
                  page,
                  total: totalLedger,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </MahajanLedgerAsyncPanel>
          </div>
        </MahajansSectionPanel>
      </DashboardSectionBoundary>

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
                    fieldLabel: "Product",
                    current:
                      confirmEditLendPayload.record.product_name ?? "—",
                    after:
                      confirmEditLendPayload.newValues.product_name ?? "—",
                  },
                  {
                    id: 3,
                    fieldLabel: "Quantity",
                    current: confirmEditLendPayload.record.quantity ?? 0,
                    after: confirmEditLendPayload.newValues.quantity,
                  },
                  {
                    id: 4,
                    fieldLabel: "Amount (₹)",
                    current: formatDecimal(
                      confirmEditLendPayload.record.amount
                    ),
                    after: formatDecimal(
                      confirmEditLendPayload.newValues.amount
                    ),
                  },
                  {
                    id: 5,
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
        fixedMahajanName={mahajanLabel}
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
              <DataTable<ModalKVRow>
                scrollMaxHeight="none"
                tableClassName="w-full text-sm border-collapse"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                columns={MODAL_KV_COLUMNS}
                data={buildMahajanLedgerDeleteRows(deleteConfirmPayload)}
                pagination={{ type: "client" }}
                tableFrame={false}
              />
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

      {printJob && (
        <div
          className="app-print-container daily-sales-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-[var(--color-bg-surface)] p-6 print:block"
          aria-hidden
        >
          <header className="mb-4 border-b border-[var(--color-border-default)] pb-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{appName}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("print.mahajanLedger")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("print.mahajanLabel")}: {printJob.mahajanName}
            </p>
            {printJob.filterDetails != null &&
              printJob.filterDetails.length > 0 && (
                <div className="mt-2 space-y-0.5 text-xs">
                  <p className="font-medium text-[var(--color-text-secondary)]">
                    {t("print.appliedFilters")}
                  </p>
                  {printJob.filterDetails.map((f) => (
                    <p key={f.label} className="text-[var(--color-text-secondary)]">
                      {f.label}: {f.value}
                    </p>
                  ))}
                </div>
              )}
            {printJob.balance != null && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t("print.totalLends")}</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printJob.balance.totalLends)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t("print.totalDeposits")}</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printJob.balance.totalDeposits)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t("print.balanceLendDeposit")}</span>
                  <span className="ml-2">
                    ₹{formatDecimal(Math.abs(printJob.balance.balance))}
                    {printJob.balance.balance > 0 && ` ${t("labels.payable")}`}
                    {printJob.balance.balance < 0 && ` ${t("labels.receivable")}`}
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
                {printJob.columns.map((col) => (
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
          </table>
        </div>
      )}
    </div>
  );
}
