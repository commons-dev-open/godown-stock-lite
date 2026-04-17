import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useAuth } from "../context/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import SearchFilterBar from "../components/SearchFilterBar";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import {
  getLedgerUpdatesAvailable,
  setLedgerUpdatesAvailable,
} from "../lib/ledgerUpdatesFlag";
import {
  exportMahajansToCsv,
  exportMahajansToPdf,
  getPrintTableBody,
  type MahajanSummaryForExport,
} from "../lib/exportMahajans";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import { Download, FileDown, Printer } from "lucide-react";
import type { Mahajan } from "../../shared/types";
import {
  formatDecimal,
  formatAbbreviatedInteger,
  formatAbbreviatedRupee,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  MahajansHero,
  MahajansSectionPanel,
  MahajansAsyncPanel,
  buildMahajanTableColumns,
} from "../components/mahajans-page";

export default function Mahajans() {
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
    () =>
      parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
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
  const [printData, setPrintData] = useState<{
    columns: string[];
    rows: string[][];
    summary: MahajanSummaryForExport | null;
  } | null>(null);
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

  const loadBalance = useCallback(async (mahajanId: number) => {
    setLoadingBalanceId(mahajanId);
    try {
      const result = (await api.getMahajanBalance(mahajanId)) as {
        balance: number;
      };
      setBalances((prev) => ({ ...prev, [mahajanId]: result.balance }));
    } finally {
      setLoadingBalanceId(null);
    }
  }, [api]);

  const tableColumns = useMemo(
    () =>
      buildMahajanTableColumns({
        showBalanceAll,
        allBalances,
        balances,
        isLoadingAllBalances,
        loadingBalanceId,
        onLoadBalance: loadBalance,
      }),
    [
      showBalanceAll,
      allBalances,
      balances,
      isLoadingAllBalances,
      loadingBalanceId,
      loadBalance,
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
      toast.error("No data to export.");
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    exportMahajansToCsv(data, summaryForExport, balances);
    toast.success("Exported as CSV.");
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    exportMahajansToPdf(data, summaryForExport, balances, appName);
    toast.success("Exported as PDF.");
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const [summaryForExport, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    setPrintData(getPrintTableBody(data, summaryForExport, balances));
  }

  useEffect(() => {
    if (!printData) {
      return;
    }
    const previousTitle = document.title;
    document.title = `Lenders_${formatDateForFile(new Date())}`;
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
      return "(payable)";
    }
    if (summary.balance < 0) {
      return "(receivable)";
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
    mahajansPageQuery.isSuccess &&
    mahajansPage.length === 0 &&
    !isPageError;
  const hasSearch = search.trim().length > 0;
  const emptyTitle = hasSearch ? "No matching lenders" : "No lenders yet";
  const emptyDescription = hasSearch
    ? "Try a different search, or clear filters to see the full list."
    : "Add a lender to start recording credit purchases and settlements in their ledger.";

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
        <span className="text-[var(--color-text-tertiary)]">Receivable</span>
        <span className="text-[var(--color-success)]">
          {receivableCountDisplay}
        </span>
      </span>
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium tabular-nums inline-flex items-center gap-1">
        <span className="text-[var(--color-text-tertiary)]">Payable</span>
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
          Export
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
        sectionTitle="Lender directory"
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
          title="Lender directory"
          description="Search the list, open a ledger, or load balances when you need them. Enable “Show balance” to fetch all balances at once."
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
              placeholder="Search by name, address, or phone…"
              rightContent={
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBalanceAll}
                    onChange={(e) => {
                      setShowBalanceAll(e.target.checked);
                      if (e.target.checked) {
                        void refetchAllBalances();
                      }
                    }}
                    className="rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Show balance
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
            emptyActionLabel={hasSearch ? undefined : "Add lender"}
            onEmptyAction={hasSearch ? undefined : () => setAddOpen(true)}
            loaderColumns={5}
          >
            <div className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
              <DataTable<Mahajan>
                scrollWrapClassName="table-scroll-wrap--shorter"
                columns={tableColumns}
                data={mahajansPage}
                onEdit={setEditing}
                onDelete={(row) => setDeleteConfirmMahajan(row)}
                emptyMessage="No Lenders yet. Click Add Lender."
              />
              <Pagination
                page={page}
                total={totalMahajans}
                limit={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </MahajansAsyncPanel>
        </MahajansSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmMahajan != null}
        onClose={() => setDeleteConfirmMahajan(null)}
        title="Delete Lender"
        message="Delete this Lender? Balance must be 0."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmMahajan) {
            deleteMahajan.mutate(deleteConfirmMahajan.id);
          }
        }}
      />

      <FormModal
        title="Add Lender"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <Button variant="primary" type="submit" form="add-mahajan-form">
            Save
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
          <FormField label="Name" required>
            <input
              name="name"
              required
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label="Address">
            <input
              name="address"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label="Phone">
            <input
              name="phone"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
          <FormField label="GSTIN">
            <input
              name="gstin"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </FormField>
        </form>
      </FormModal>

      <FormModal
        title="Edit Lender"
        open={!!editing}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <Button variant="primary" type="submit" form="edit-mahajan-form">
              Update
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
            <FormField label="Name" required>
              <input
                name="name"
                defaultValue={editing.name}
                required
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Address">
              <input
                name="address"
                defaultValue={editing.address ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Phone">
              <input
                name="phone"
                defaultValue={editing.phone ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
            <FormField label="GSTIN">
              <input
                name="gstin"
                defaultValue={editing.gstin ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </FormField>
          </form>
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
            <p className="text-xs text-[var(--color-text-secondary)]">Lenders</p>
            {printData.summary != null && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">Total Credit Purchase</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.summary.totalLend)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">Total Settlements</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.summary.totalDeposit)}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">
                    Balance (Credit Purchase − Settlement)
                  </span>
                  <span className="ml-2">
                    ₹{formatDecimal(Math.abs(printData.summary.balance))}
                    {printData.summary.balance > 0 && " (payable)"}
                    {printData.summary.balance < 0 && " (receivable)"}
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
