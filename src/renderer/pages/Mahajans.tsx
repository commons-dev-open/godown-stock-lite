import { useState, useEffect } from "react";
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
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import SearchFilterBar from "../components/SearchFilterBar";
import TableLoader from "../components/TableLoader";
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
import type { Mahajan } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

function totalBalanceClass(total: number): string {
  if (total > 0) return "font-medium text-red-600";
  if (total < 0) return "font-medium text-emerald-600";
  return "font-medium text-gray-900";
}

export default function Mahajans() {
  const queryClient = useQueryClient();
  const api = getElectron();
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

  const { data: pageResult, isLoading } = useQuery({
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
  });
  const {
    data: summaryResult,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
    isStale: isSummaryStale,
  } = useQuery({
    queryKey: ["mahajanSummary"],
    queryFn: () => api.getMahajanSummary(),
    enabled: false,
    refetchOnMount: false,
  });

  const { data: allBalancesResult, isLoading: isLoadingAllBalances } = useQuery(
    {
      queryKey: ["allMahajanBalances"],
      queryFn: () => api.getAllMahajanBalances(),
      enabled: showBalanceAll,
    }
  );

  const mahajansPage = pageResult?.data ?? [];
  const totalMahajans = pageResult?.total ?? 0;
  const summary = summaryResult ?? null;
  const allBalances: Record<number, number> = allBalancesResult?.balances ?? {};
  const showUpdatesIndicator =
    (summary != null && isSummaryStale) || updatesAvailable;

  async function loadBalance(mahajanId: number) {
    setLoadingBalanceId(mahajanId);
    try {
      const result = (await api.getMahajanBalance(mahajanId)) as {
        balance: number;
      };
      setBalances((prev) => ({ ...prev, [mahajanId]: result.balance }));
    } finally {
      setLoadingBalanceId(null);
    }
  }

  const createMahajan = useMutation({
    mutationFn: (m: {
      name: string;
      address?: string;
      phone?: string;
      gstin?: string;
    }) => api.createMahajan(m),
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
    }) => api.updateMahajan(id, m),
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
      const res = (await api.getAllMahajanBalances()) as { balances: Record<number, number> };
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
    const [summary, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    exportMahajansToCsv(data, summary, balances);
    toast.success("Exported as CSV.");
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const [summary, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    exportMahajansToPdf(data, summary, balances);
    toast.success("Exported as PDF.");
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const data = await getExportData();
    if (data.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const [summary, balances] = await Promise.all([
      getSummaryForExport(),
      getBalancesForExport(),
    ]);
    setPrintData(getPrintTableBody(data, summary, balances));
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

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Mahajans</h1>
          <div className="flex items-center gap-2">
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <Button variant="secondary" type="button">
                Export
              </Button>
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
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add Mahajan
            </Button>
          </div>
        </div>

        {/* Summary strip above filter – load on demand via Get totals */}
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          {isLoadingSummary && (
            <div className="text-sm text-gray-500">Loading…</div>
          )}
          {!isLoadingSummary && isSummaryError && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-600">
                Failed to load
                {summaryError instanceof Error
                  ? `: ${summaryError.message}`
                  : ""}
              </span>
              <Button
                variant="secondary"
                type="button"
                onClick={() => refetchSummary()}
                className="!py-1 !text-xs"
              >
                Retry
              </Button>
            </div>
          )}
          {!isLoadingSummary && !isSummaryError && summary && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Button
                variant={showUpdatesIndicator ? "amber" : "secondary"}
                type="button"
                onClick={() => {
                  refetchSummary().then(() => {
                    setLedgerUpdatesAvailable(false);
                    setUpdatesAvailable(false);
                  });
                }}
                className="!py-1 !text-xs shrink-0"
                title={
                  showUpdatesIndicator
                    ? "Totals may have changed – click to refresh"
                    : "Refresh totals"
                }
              >
                {showUpdatesIndicator ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full bg-white shrink-0"
                      aria-hidden
                    />
                    {"Fetch latest"}
                  </span>
                ) : (
                  "Fetch latest"
                )}
              </Button>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600">Total lend</span>
                <span className="font-medium text-red-600">
                  ₹{formatDecimal(summary.totalLend)}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600">Total deposit</span>
                <span className="font-medium text-emerald-600">
                  ₹{formatDecimal(summary.totalDeposit)}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600">Balance</span>
                <span className={totalBalanceClass(summary.balance)}>
                  ₹{formatDecimal(Math.abs(summary.balance))}
                  {summary.balance > 0 && " (payable)"}
                  {summary.balance < 0 && " (receivable)"}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600">Receivable</span>
                <span className="font-medium text-emerald-600">
                  {summary.countOweMe}{" "}
                  {summary.countOweMe === 1 ? "mahajan" : "mahajans"}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600">Payable</span>
                <span className="font-medium text-red-600">
                  {summary.countIOwe}{" "}
                  {summary.countIOwe === 1 ? "mahajan" : "mahajans"}
                </span>
              </div>
            </div>
          )}
          {!isLoadingSummary && !isSummaryError && !summary && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => refetchSummary()}
              className="!py-1.5 !text-sm"
            >
              Get totals
            </Button>
          )}
        </div>

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
                onChange={(e) => setShowBalanceAll(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show balance</span>
            </label>
          }
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading && <TableLoader />}
        {!isLoading && mahajansPage.length === 0 && <EmptyState />}
        {!isLoading && mahajansPage.length > 0 && (
          <>
            <DataTable<Mahajan>
              scrollWrapClassName="table-scroll-wrap--shorter"
              columns={[
                { key: "name", label: "Name" },
                { key: "address", label: "Address" },
                { key: "phone", label: "Phone" },
                {
                  key: "balance",
                  label: "Balance (Lend - Deposit)",
                  render: (row) => {
                    const bal = showBalanceAll
                      ? allBalances[row.id]
                      : balances[row.id];
                    if (bal !== undefined) {
                      let colorClass = "text-gray-500";
                      if (bal > 0) colorClass = "text-red-600 font-medium";
                      else if (bal < 0)
                        colorClass = "text-green-600 font-medium";
                      let hint = "";
                      if (bal > 0) hint = " (payable)";
                      else if (bal < 0) hint = " (receivable)";
                      return (
                        <span className={colorClass}>
                          ₹{formatDecimal(Math.abs(bal))}
                          {hint && (
                            <span className="text-gray-500 font-normal">
                              {hint}
                            </span>
                          )}
                        </span>
                      );
                    }
                    if (showBalanceAll && isLoadingAllBalances) {
                      return (
                        <span className="text-gray-400 text-sm">Loading…</span>
                      );
                    }
                    if (showBalanceAll) {
                      return (
                        <span className="text-gray-500 text-sm">
                          ₹0.00 (Settled)
                        </span>
                      );
                    }
                    const loading = loadingBalanceId === row.id;
                    return (
                      <button
                        type="button"
                        onClick={() => loadBalance(row.id)}
                        disabled={loading}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? "Loading…" : "View balance"}
                      </button>
                    );
                  },
                },
                {
                  key: "id",
                  label: "Details",
                  render: (row) => (
                    <Link
                      to={`/mahajans/ledger/${row.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Ledger
                    </Link>
                  ),
                },
              ]}
              data={mahajansPage}
              onEdit={setEditing}
              onDelete={(row) => {
                if (
                  globalThis.confirm("Delete this Mahajan? Balance must be 0.")
                )
                  deleteMahajan.mutate(row.id);
              }}
              emptyMessage="No Mahajans yet. Click Add Mahajan."
            />
            <Pagination
              page={page}
              total={totalMahajans}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Add Mahajan"
        open={addOpen}
        onClose={() => setAddOpen(false)}
      >
        <form
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
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <FormField label="Address">
            <input
              name="address"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <FormField label="Phone">
            <input
              name="phone"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <FormField label="GSTIN">
            <input
              name="gstin"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Mahajan"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
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
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Address">
              <input
                name="address"
                defaultValue={editing.address ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Phone">
              <input
                name="phone"
                defaultValue={editing.phone ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField label="GSTIN">
              <input
                name="gstin"
                defaultValue={editing.gstin ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Update
              </Button>
            </div>
          </form>
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
            <p className="text-xs text-gray-600">Mahajans</p>
            {printData.summary != null && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-gray-700">
                  <span className="font-medium">Total Lends</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.summary.totalLend)}
                  </span>
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Total Deposits</span>
                  <span className="ml-2">
                    ₹{formatDecimal(printData.summary.totalDeposit)}
                  </span>
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Balance (Lend − Deposit)</span>
                  <span className="ml-2">
                    ₹{formatDecimal(Math.abs(printData.summary.balance))}
                    {printData.summary.balance > 0 && " (payable)"}
                    {printData.summary.balance < 0 && " (receivable)"}
                  </span>
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
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
