import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, Printer } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  formatAbbreviatedInteger,
  formatAbbreviatedRupee,
  formatDecimal,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import type { Lender, Mahajan } from "../../shared/types";
import { getElectron } from "../api/client";
import Button from "../components/Button";
import ConfirmModal from "../components/ConfirmModal";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import FormModal from "../components/FormModal";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import AppleToggle from "../components/AppleToggle";
import {
  buildMahajanTableColumns,
  MahajansAsyncPanel,
  MahajansHero,
  MahajansSectionPanel,
} from "../components/mahajans-page";
import { PAGE_SIZE } from "../../shared/constants";
import SearchFilterBar from "../components/SearchFilterBar";
import { useAuth } from "../context/AuthContext";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import { getAppDisplayName } from "../lib/displayName";
import {
  exportMahajansToCsv,
  getPrintTableBody,
  type MahajanSummaryForExport,
  type MahajansExportText,
} from "../lib/exportMahajans";
import { formatDateForFile } from "../lib/exportUtils";
import {
  useElectronHtmlPrintJob,
  type HtmlPrintJobBase,
} from "../hooks/useElectronHtmlPrintJob";
import {
  getLedgerUpdatesAvailable,
  setLedgerUpdatesAvailable,
} from "../lib/ledgerUpdatesFlag";

export default function Mahajans() {
  const { t } = useTranslation("mahajans");
  const queryClient = useQueryClient();
  const api = getElectron();
  const { authState } = useAuth();
  const currentUser = authState.status === "unlocked" ? authState.user : null;
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

  const mahajansExportTexts = useMemo(
    (): MahajansExportText => ({
      columns: [
        t("export.columns.id"),
        t("form.name"),
        t("form.address"),
        t("form.phone"),
        t("form.gstin"),
        t("export.columns.createdAt"),
        t("export.columns.updatedAt"),
        t("columns.balance"),
      ],
      balanceHints: {
        payable: t("labels.payable"),
        receivable: t("labels.receivable"),
      },
      csvSummaryLabels: {
        totalCreditPurchase: t("print.totalCreditPurchase"),
        totalSettlements: t("print.totalSettlements"),
        balance: t("print.balanceFormula"),
      },
    }),
    [t]
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Mahajan | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [loadingBalanceId, setLoadingBalanceId] = useState<number | null>(null);
  const [showBalanceAll, setShowBalanceAll] = useState(false);
  const [updatesAvailable, setUpdatesAvailable] = useState(
    getLedgerUpdatesAvailable
  );
  const [exportOpen, setExportOpen] = useState(false);
  type MahajansPrintJob = null | (HtmlPrintJobBase & {
    columns: string[];
    rows: string[][];
    summary: MahajanSummaryForExport | null;
  });
  const [printJob, setPrintJob] = useState<MahajansPrintJob>(null);
  const [deleteConfirmMahajan, setDeleteConfirmMahajan] =
    useState<Mahajan | null>(null);

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

  const mahajansPageQuery = useQuery({
    queryKey: ["mahajansPage", search, page],
    queryFn: () =>
      api.getMahajansPage({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{
        data: Mahajan[];
        total: number;
      }>,
    staleTime: 15_000,
  });
  const {
    data: pageResult,
    isLoading: isLoadingPage,
    isError: isPageError,
    refetch: refetchMahajansPage,
  } = mahajansPageQuery;

  const {
    data: summaryResult,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
    isStale: isSummaryStale,
  } = useQuery({
    queryKey: ["mahajanSummary"],
    queryFn: () => api.getMahajanSummary(),
    staleTime: 30_000,
  });

  const {
    data: allBalancesResult,
    isLoading: isLoadingAllBalances,
    refetch: refetchAllBalances,
  } = useQuery({
    queryKey: ["allMahajanBalances"],
    queryFn: () => api.getAllMahajanBalances(),
    enabled: showBalanceAll,
  });

  const mahajansPage = pageResult?.data ?? [];
  const totalMahajans = pageResult?.total ?? 0;
  const summary = summaryResult ?? null;
  const allBalances: Record<number, number> = allBalancesResult?.balances ?? {};
  const showUpdatesIndicator =
    (summary != null && isSummaryStale) || updatesAvailable;

  const loadBalance = useCallback(
    async (mahajanId: number) => {
      setLoadingBalanceId(mahajanId);
      try {
        const result = (await api.getMahajanBalance(mahajanId)) as {
          balance: number;
        };
        setBalances((prev) => ({ ...prev, [mahajanId]: result.balance }));
      } finally {
        setLoadingBalanceId(null);
      }
    },
    [api]
  );

  const tableColumns = useMemo(
    () =>
      buildMahajanTableColumns({
        showBalanceAll,
        allBalances,
        balances,
        isLoadingAllBalances,
        loadingBalanceId,
        onLoadBalance: loadBalance,
        t,
      }),
    [
      showBalanceAll,
      allBalances,
      balances,
      isLoadingAllBalances,
      loadingBalanceId,
      loadBalance,
      t,
    ]
  );

  const createMahajan = useMutation({
    mutationFn: (m: {
      name: string;
      address?: string;
      phone?: string;
      gstin?: string;
    }) => api.createMahajan({ ...m, _userId: currentUser?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setAddOpen(false);
    },
  });

  const updateMahajan = useMutation({
    mutationFn: ({
      id,
      m,
    }: {
      id: number;
      m: { name?: string; address?: string; phone?: string; gstin?: string };
    }) => api.updateMahajan(id, { ...m, _userId: currentUser?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setEditing(null);
    },
  });

  const deleteMahajan = useMutationWithToast({
    mutationFn: (id: number) => api.deleteMahajan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajans"] });
      queryClient.invalidateQueries({ queryKey: ["mahajansPage"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
    },
  });

  async function getExportData(): Promise<Mahajan[]> {
    const data = (await api.getMahajans()) as Mahajan[];
    return data ?? [];
  }

  async function getSummaryForExport(): Promise<MahajanSummaryForExport | null> {
    try {
      return (await api.getMahajanSummary()) as MahajanSummaryForExport;
    } catch {
      return null;
    }
  }

  async function getBalancesForExport(): Promise<Record<number, number>> {
    try {
      const res = (await api.getAllMahajanBalances()) as {
        balances: Record<number, number>;
      };
      return res?.balances ?? {};
    } catch {
      return {};
    }
  }

  async function handleExportCsv() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    exportMahajansToCsv(data, summaryForExport, balances, mahajansExportTexts);
    toast.success(t("export.csvSuccess"));
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    const body = getPrintTableBody(
      data,
      summaryForExport,
      balances,
      mahajansExportTexts
    );
    setPrintJob({
      mode: "pdf",
      documentTitle: `${t("print.fileNamePrefix")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `lenders-${formatDateForFile(new Date())}.pdf`,
      ...body,
    });
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    const body = getPrintTableBody(
      data,
      summaryForExport,
      balances,
      mahajansExportTexts
    );
    setPrintJob({
      mode: "browser",
      documentTitle: `${t("print.fileNamePrefix")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `lenders-${formatDateForFile(new Date())}.pdf`,
      ...body,
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

  const totalLendersDisplay =
    isLoadingPage && pageResult == null
      ? "—"
      : formatAbbreviatedInteger(totalMahajans, abbreviationStyle);

  const totalLendDisplay = useMemo(() => {
    if (isLoadingSummary && summary == null) {
      return "…";
    }
    if (summary != null) {
      return formatAbbreviatedRupee(summary.totalLend, abbreviationStyle);
    }
    return "—";
  }, [abbreviationStyle, isLoadingSummary, summary]);

  const totalDepositDisplay = useMemo(() => {
    if (isLoadingSummary && summary == null) {
      return "…";
    }
    if (summary != null) {
      return formatAbbreviatedRupee(summary.totalDeposit, abbreviationStyle);
    }
    return "—";
  }, [abbreviationStyle, isLoadingSummary, summary]);

  const balanceDisplay = useMemo(() => {
    if (isLoadingSummary && summary == null) {
      return "…";
    }
    if (summary != null) {
      return formatAbbreviatedRupee(
        Math.abs(summary.balance),
        abbreviationStyle
      );
    }
    return "—";
  }, [abbreviationStyle, isLoadingSummary, summary]);

  const balanceSuffix = useMemo(() => {
    if (summary == null) {
      return "";
    }
    if (summary.balance > 0) {
      return t("labels.payable");
    }
    if (summary.balance < 0) {
      return t("labels.receivable");
    }
    return "";
  }, [summary]);

  const balanceValueClassName = useMemo(() => {
    if (summary == null) {
      return "text-[var(--color-text-primary)]";
    }
    if (summary.balance > 0) {
      return "text-[var(--color-danger)]";
    }
    if (summary.balance < 0) {
      return "text-[var(--color-success)]";
    }
    return "text-[var(--color-text-primary)]";
  }, [summary]);

  const isListEmpty =
    mahajansPageQuery.isSuccess && mahajansPage.length === 0 && !isPageError;
  const hasSearch = search.trim().length > 0;
  const emptyTitle = hasSearch
    ? t("empty.matchingLendersTitle")
    : t("empty.noLendersTitle");
  const emptyDescription = hasSearch
    ? t("empty.matchingLendersDescription")
    : t("empty.noLendersDescription");

  const receivableCountDisplay =
    isLoadingSummary && summary == null
      ? "…"
      : summary != null
        ? formatAbbreviatedInteger(summary.countOweMe, abbreviationStyle)
        : "—";
  const payableCountDisplay =
    isLoadingSummary && summary == null
      ? "…"
      : summary != null
        ? formatAbbreviatedInteger(summary.countIOwe, abbreviationStyle)
        : "—";

  const countBadge = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
        {totalMahajans}
      </span>
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium tabular-nums inline-flex items-center gap-1">
        <span className="text-[var(--color-text-tertiary)]">
          {t("labels.receivableShort")}
        </span>
        <span className="text-[var(--color-success)]">
          {receivableCountDisplay}
        </span>
      </span>
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium tabular-nums inline-flex items-center gap-1">
        <span className="text-[var(--color-text-tertiary)]">
          {t("labels.payableShort")}
        </span>
        <span className="text-[var(--color-danger)]">
          {payableCountDisplay}
        </span>
      </span>
    </span>
  );

  const heroToolbar = (
    <>
      <div ref={exportRefs.setReference} {...getExportRefProps()}>
        <Button variant="secondary" type="button" className="w-full sm:w-auto">
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
              onClick={handleExportCsv}
            >
              <FileDown size={16} className="shrink-0" />
              {t("actions.exportAsCsv")}
            </button>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={handleExportPdf}
            >
              <FileDown size={16} className="shrink-0" />
              {t("actions.exportAsPdf")}
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
    </>
  );

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <MahajansHero
        totalLendersDisplay={totalLendersDisplay}
        totalLendDisplay={totalLendDisplay}
        totalDepositDisplay={totalDepositDisplay}
        balanceDisplay={balanceDisplay}
        balanceSuffix={balanceSuffix}
        balanceValueClassName={balanceValueClassName}
        showUpdatesIndicator={showUpdatesIndicator}
        canFetchLatest={summary != null && !isSummaryError}
        onFetchLatest={() => {
          void refetchSummary().then(() => {
            setLedgerUpdatesAvailable(false);
            setUpdatesAvailable(false);
          });
        }}
        toolbar={heroToolbar}
        onAdd={() => setAddOpen(true)}
      />

      <DashboardSectionBoundary
        sectionTitle={t("directory.sectionTitle")}
        containerClassName="dashboard-panel"
        resetKeys={[
          search,
          page,
          isLoadingPage,
          isPageError,
          mahajansPage.length,
          showBalanceAll,
        ]}
      >
        <MahajansSectionPanel
          title={t("directory.title")}
          description={t("directory.description")}
          badge={countBadge}
        >
          <div className="mb-4">
            <SearchFilterBar
              searchValue={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              onClearFilters={
                search
                  ? () => {
                      setSearch("");
                      setPage(1);
                    }
                  : undefined
              }
              placeholder={t("search.placeholder")}
              rightContent={
                <label className="flex items-center gap-2 cursor-pointer">
                  <AppleToggle
                    checked={showBalanceAll}
                    onChange={(isChecked) => {
                      setShowBalanceAll(isChecked);
                      if (isChecked) {
                        void refetchAllBalances();
                      }
                    }}
                    aria-label={t("actions.showBalance")}
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {t("actions.showBalance")}
                  </span>
                </label>
              }
            />
          </div>

          <MahajansAsyncPanel
            isLoading={isLoadingPage}
            isError={isPageError}
            onRetry={() => {
              void refetchMahajansPage();
            }}
            isEmpty={isListEmpty}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyActionLabel={hasSearch ? undefined : t("actions.addMahajan")}
            onEmptyAction={hasSearch ? undefined : () => setAddOpen(true)}
            loaderColumns={5}
          >
            <DataTable<Lender>
              scrollMaxHeight={`calc(100vh - 20.5rem)`}
              columns={tableColumns}
              data={mahajansPage}
              onEdit={setEditing}
              onDelete={(row) => setDeleteConfirmMahajan(row)}
              emptyMessage={t("table.noLendersMessage")}
              pagination={{
                type: "controlled",
                page,
                total: totalMahajans,
                onPageChange: setPage,
                pageSize: PAGE_SIZE,
              }}
            />
          </MahajansAsyncPanel>
        </MahajansSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmMahajan != null}
        onClose={() => setDeleteConfirmMahajan(null)}
        title={t("modals.deleteLender.title")}
        message={t("modals.deleteLender.message")}
        confirmLabel={t("common.delete")}
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmMahajan) {
            deleteMahajan.mutate(deleteConfirmMahajan.id);
          }
        }}
      />

      <FormModal
        title={t("actions.addMahajan")}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <Button variant="primary" type="submit" form="add-mahajan-form">
            {t("common.save")}
          </Button>
        }
      >
        <form
          id="add-mahajan-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const get = (n: string) =>
              (form.elements.namedItem(n) as HTMLInputElement | null)?.value ??
              "";
            createMahajan.mutate({
              name: get("name"),
              address: get("address") || undefined,
              phone: get("phone") || undefined,
              gstin: get("gstin") || undefined,
            });
          }}
        >
          <FormField label={t("form.name")} required>
            <input
              name="name"
              required
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label={t("form.address")}>
            <input
              name="address"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label={t("form.phone")}>
            <input
              name="phone"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label={t("form.gstin")}>
            <input
              name="gstin"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
        </form>
      </FormModal>

      <FormModal
        title={t("actions.editMahajan")}
        open={!!editing}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <Button variant="primary" type="submit" form="edit-mahajan-form">
              {t("common.update")}
            </Button>
          ) : null
        }
      >
        {editing && (
          <form
            id="edit-mahajan-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const get = (n: string) =>
                (form.elements.namedItem(n) as HTMLInputElement | null)
                  ?.value ?? "";
              updateMahajan.mutate({
                id: editing.id,
                m: {
                  name: get("name"),
                  address: get("address") || undefined,
                  phone: get("phone") || undefined,
                  gstin: get("gstin") || undefined,
                },
              });
            }}
          >
            <FormField label={t("form.name")} required>
              <input
                name="name"
                defaultValue={editing.name}
                required
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label={t("form.address")}>
              <input
                name="address"
                defaultValue={editing.address ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label={t("form.phone")}>
              <input
                name="phone"
                defaultValue={editing.phone ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label={t("form.gstin")}>
              <input
                name="gstin"
                defaultValue={editing.gstin ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
          </form>
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
            {printJob.summary != null && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t("print.totalCreditPurchase")}</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printJob.summary.totalLend)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{t("print.totalSettlements")}</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printJob.summary.totalDeposit)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">
                    {t("print.balanceFormula")}
                  </span>
                  <span className="ml-2">
                    ₹{formatDecimal(Math.abs(printJob.summary.balance))}
                    {printJob.summary.balance > 0 && ` ${t("labels.payable")}`}
                    {printJob.summary.balance < 0 && ` ${t("labels.receivable")}`}
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
