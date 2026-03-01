import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatDateForView, formatDateForForm } from "../lib/date";
import type {
  LedgerRow,
  MahajanLend,
  MahajanDeposit,
  Item,
} from "../../shared/types";

export default function MahajanLedger() {
  const { mahajanId } = useParams<{ mahajanId: string }>();
  const navigate = useNavigate();
  const api = getElectron();
  const queryClient = useQueryClient();
  const id = Number(mahajanId);
  const [editingLend, setEditingLend] = useState<MahajanLend | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<MahajanDeposit | null>(
    null
  );
  const [filterType, setFilterType] = useState<"all" | "lend" | "deposit">(
    "all"
  );
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [editLendDate, setEditLendDate] = useState("");
  const [editDepositDate, setEditDepositDate] = useState("");

  useEffect(() => {
    if (editingLend) setEditLendDate(editingLend.transaction_date);
  }, [editingLend]);
  useEffect(() => {
    if (editingDeposit) setEditDepositDate(editingDeposit.transaction_date);
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
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setEditingLend(null);
      toast.success("Lend updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update lend"),
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
      setEditingDeposit(null);
      toast.success("Deposit updated");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to update deposit"),
  });

  const deleteLend = useMutation({
    mutationFn: (lendId: number) => api.deleteMahajanLend(lendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends", id] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Lend deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete lend"),
  });

  const deleteDeposit = useMutation({
    mutationFn: (depositId: number) => api.deleteMahajanDeposit(depositId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance", id] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits", id] });
      toast.success("Deposit deleted");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to delete deposit"),
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
    type?: "all" | "lend" | "deposit";
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (updates.type !== undefined) setFilterType(updates.type);
    if (updates.dateFrom !== undefined) setFilterDateFrom(updates.dateFrom);
    if (updates.dateTo !== undefined) setFilterDateTo(updates.dateTo);
  };

  if (!id) return <div className="text-gray-500">Invalid Mahajan</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Ledger: {mahajan?.name ?? `ID ${id}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLendModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700"
          >
            AddLend
          </button>
          <button
            type="button"
            onClick={() => setDepositModalOpen(true)}
            className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
          >
            Deposit
          </button>
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white shrink-0 min-w-0"
          value={filterType}
          onChange={(e) =>
            handleFilterChange({
              type: e.target.value as "all" | "lend" | "deposit",
            })
          }
        >
          <option value="all">All (Lend + Deposit)</option>
          <option value="lend">Lend only</option>
          <option value="deposit">Deposit only</option>
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
                htmlFor="mahajan-ledger-date-from"
                className="flex flex-col gap-1.5 text-sm text-gray-600"
              >
                From date
                <DateInput
                  id="mahajan-ledger-date-from"
                  value={filterDateFrom}
                  onChange={(v) => handleFilterChange({ dateFrom: v })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
                />
              </label>
              <label
                htmlFor="mahajan-ledger-date-to"
                className="flex flex-col gap-1.5 text-sm text-gray-600"
              >
                To date
                <DateInput
                  id="mahajan-ledger-date-to"
                  value={filterDateTo}
                  onChange={(v) => handleFilterChange({ dateTo: v })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
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
                  className="text-sm text-gray-600 hover:text-gray-900 underline self-start"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {balanceLoading && (
        <p className="text-sm text-gray-500 mb-4">Loading balance…</p>
      )}
      {!balanceLoading && balance != null && (
        <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <span className="text-xs font-medium uppercase text-gray-500">
              Total Lends
            </span>
            <p className="text-lg font-semibold text-amber-800">
              ₹{balance.totalLends.toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-gray-500">
              Total Deposits
            </span>
            <p className="text-lg font-semibold text-green-800">
              ₹{balance.totalDeposits.toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase text-gray-500">
              Balance (Lend − Deposit)
            </span>
            <p
              className={
                balance.balance >= 0
                  ? "text-lg font-semibold text-amber-800"
                  : "text-lg font-semibold text-green-800"
              }
            >
              ₹{balance.balance.toFixed(2)}
              {balance.balance > 0 && (
                <span className="ml-1 text-sm font-normal text-gray-500">
                  (you owe them)
                </span>
              )}
              {balance.balance < 0 && (
                <span className="ml-1 text-sm font-normal text-gray-500">
                  (they owe you)
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="table-scroll-wrap overflow-x-auto">
          {isLoading ? (
            <TableLoader />
          ) : filteredLedger.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No records match the filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLedger.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">
                      <Tooltip
                        content={formatDateForForm(row.transaction_date)}
                      >
                        <span>{formatDateForView(row.transaction_date)}</span>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <TransactionTypeBadge type={row.type} />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {row.description}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {row.amount.toFixed(2)}
                    </td>
                    <LedgerRowActions
                      type={row.type}
                      onEdit={() => {
                        if (row.type === "lend") {
                          const rec = getLendRecord(row);
                          if (rec) setEditingLend(rec);
                          else toast.error("Lend record not found");
                        } else {
                          const rec = getDepositRecord(row);
                          if (rec) setEditingDeposit(rec);
                          else toast.error("Deposit record not found");
                        }
                      }}
                      onDelete={() => {
                        if (row.type === "lend") deleteLend.mutate(row.id);
                        else deleteDeposit.mutate(row.id);
                      }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <FormModal
        title="Edit Lend"
        open={!!editingLend}
        onClose={() => setEditingLend(null)}
        maxWidth="max-w-3xl"
      >
        {editingLend && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const productId = (form.product_id as HTMLSelectElement)?.value
                ? Number((form.product_id as HTMLSelectElement).value)
                : null;
              const item = productId
                ? itemList.find((i) => i.id === productId)
                : undefined;
              if (!editLendDate) return;
              updateLend.mutate({
                id: editingLend.id,
                l: {
                  mahajan_id: id,
                  transaction_date: editLendDate,
                  product_id: productId || null,
                  product_name:
                    item?.name ?? editingLend.product_name ?? undefined,
                  quantity:
                    Number((form.quantity as HTMLInputElement).value) || 0,
                  amount: Number((form.amount as HTMLInputElement).value),
                  notes:
                    (form.notes as HTMLInputElement).value?.trim() || undefined,
                },
              });
            }}
          >
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
                defaultValue={editingLend.product_id ?? ""}
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
              </label>
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue={editingLend.quantity ?? 0}
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
                defaultValue={editingLend.amount}
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
                defaultValue={editingLend.notes ?? ""}
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
                Update
              </button>
            </div>
          </form>
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
        open={!!editingDeposit}
        onClose={() => setEditingDeposit(null)}
      >
        {editingDeposit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              if (!editDepositDate) return;
              updateDeposit.mutate({
                id: editingDeposit.id,
                d: {
                  transaction_date: editDepositDate,
                  amount: Number((form.amount as HTMLInputElement).value),
                  notes: (form.notes as HTMLInputElement).value || undefined,
                },
              });
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
                defaultValue={editingDeposit.amount}
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
                defaultValue={editingDeposit.notes ?? ""}
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
                Update
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
}
