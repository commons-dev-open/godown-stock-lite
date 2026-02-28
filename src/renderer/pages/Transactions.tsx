import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormModal from "../components/FormModal";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { todayISO } from "../lib/date";
import type {
  Item,
  MahajanLend,
  MahajanDeposit,
  Purchase,
} from "../../shared/types";

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
  const itemList = items as { id: number; name: string }[];

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

        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-700">Filters:</span>
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
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
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
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
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            From
            <input
              type="date"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              value={filterDateFrom}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            To
            <input
              type="date"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              value={filterDateTo}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
            />
          </label>
          {(filterMahajanId !== "" ||
            filterType !== "all" ||
            filterDateFrom ||
            filterDateTo) && (
            <button
              type="button"
              onClick={() =>
                handleFilterChange({
                  mahajanId: "",
                  type: "all",
                  dateFrom: "",
                  dateTo: "",
                })
              }
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white">
          {ledgerLoading ? (
            <div className="text-center py-8 text-gray-500">Loading…</div>
          ) : unifiedRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No records match the filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
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
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              row.type === "lend"
                                ? "bg-amber-100 text-amber-800"
                                : row.type === "deposit"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {row.type === "lend"
                              ? "Lend"
                              : row.type === "deposit"
                                ? "Deposit"
                                : "Cash"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {row.transaction_date}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {row.mahajan_name ?? "—"}
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
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                          ₹{row.amount.toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-gray-600 truncate max-w-[12rem]"
                          title={row.notes ?? ""}
                        >
                          {row.notes ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-sm space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (row.type === "lend")
                                setEditingLend(toLendRecord(row));
                              else if (row.type === "deposit")
                                setEditingDeposit(toDepositRecord(row));
                              else setEditingPurchase(toPurchaseRecord(row));
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const msg =
                                row.type === "lend"
                                  ? "Delete this lend?"
                                  : row.type === "deposit"
                                    ? "Delete this deposit?"
                                    : "Delete this cash purchase?";
                              if (globalThis.confirm(msg)) {
                                if (row.type === "lend")
                                  deleteLend.mutate(row.id);
                                else if (row.type === "deposit")
                                  deleteDeposit.mutate(row.id);
                                else deletePurchase.mutate(row.id);
                              }
                            }}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
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
            const transaction_date = (form.transaction_date as HTMLInputElement)
              .value;
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
              transaction_date,
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
              Date *
            </label>
            <input
              name="transaction_date"
              type="date"
              defaultValue={todayISO()}
              required
              className="w-full border rounded px-3 py-2"
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
            {lendLines.map((line, idx) => (
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
                    Qty
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
                        setLendLines((prev) => prev.filter((_, i) => i !== idx))
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
              {confirmPayload.transaction_date}
            </p>
            <div className="overflow-auto max-h-60">
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
              {confirmPayload.lines
                .reduce((s, l) => s + l.amount, 0)
                .toFixed(2)}
            </p>
            {balanceLoading ? (
              <p className="text-sm text-gray-500">Loading balance…</p>
            ) : mahajanBalance != null ? (
              <div className="text-sm rounded border p-3 bg-gray-50 space-y-1">
                <p>Total Lends: ₹{mahajanBalance.totalLends.toFixed(2)}</p>
                <p>
                  Total Deposits: ₹{mahajanBalance.totalDeposits.toFixed(2)}
                </p>
                <p className="font-medium">
                  Balance (Lend - Deposit): ₹{mahajanBalance.balance.toFixed(2)}
                </p>
                <p className="font-medium text-amber-700">
                  After this lend: ₹
                  {(
                    mahajanBalance.balance +
                    confirmPayload.lines.reduce((s, l) => s + l.amount, 0)
                  ).toFixed(2)}
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
            createDeposit.mutate({
              mahajan_id: Number((form.mahajan_id as HTMLSelectElement).value),
              transaction_date: (form.transaction_date as HTMLInputElement)
                .value,
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
              Date *
            </label>
            <input
              name="transaction_date"
              type="date"
              defaultValue={todayISO()}
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
              updateLend.mutate({
                id: editingLend.id,
                l: {
                  mahajan_id: Number(
                    (form.mahajan_id as HTMLSelectElement).value
                  ),
                  transaction_date: (form.transaction_date as HTMLInputElement)
                    .value,
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
                Mahajan *
              </label>
              <select
                name="mahajan_id"
                required
                className="w-full border rounded px-3 py-2"
                defaultValue={editingLend.mahajan_id}
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
                Date *
              </label>
              <input
                name="transaction_date"
                type="date"
                defaultValue={editingLend.transaction_date}
                required
                className="w-full border rounded px-3 py-2"
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
              updateDeposit.mutate({
                id: editingDeposit.id,
                d: {
                  transaction_date: (form.transaction_date as HTMLInputElement)
                    .value,
                  amount: Number((form.amount as HTMLInputElement).value),
                  notes: (form.notes as HTMLInputElement).value || undefined,
                },
              });
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                name="transaction_date"
                type="date"
                defaultValue={editingDeposit.transaction_date}
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
            const transaction_date = (form.transaction_date as HTMLInputElement)
              .value;
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
              transaction_date,
              notes,
              lines,
            });
            setConfirmPurchaseOpen(true);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              name="transaction_date"
              type="date"
              defaultValue={todayISO()}
              required
              className="w-full border rounded px-3 py-2"
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
              <strong>{confirmPurchasePayload.transaction_date}</strong>
              {confirmPurchasePayload.notes
                ? ` — ${confirmPurchasePayload.notes}`
                : ""}
            </p>
            <div className="overflow-auto max-h-60">
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
                          ₹{line.amount.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-medium">
              Total amount: ₹
              {confirmPurchasePayload.lines
                .reduce((s, l) => s + l.amount, 0)
                .toFixed(0)}
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
                    notes:
                      confirmPurchasePayload.notes || undefined,
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
        open={!!editingPurchase}
        onClose={() => setEditingPurchase(null)}
      >
        {editingPurchase && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              updatePurchase.mutate({
                id: editingPurchase.id,
                p: {
                  transaction_date: (form.transaction_date as HTMLInputElement)
                    .value,
                  quantity: Number((form.quantity as HTMLInputElement).value),
                  amount: Number((form.amount as HTMLInputElement).value),
                  notes: (form.notes as HTMLInputElement).value || undefined,
                },
              });
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                name="transaction_date"
                type="date"
                defaultValue={editingPurchase.transaction_date}
                required
                className="w-full border rounded px-3 py-2"
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
              </label>
              <input
                name="quantity"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue={editingPurchase.quantity}
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
                defaultValue={editingPurchase.amount}
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
                defaultValue={editingPurchase.notes ?? ""}
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
                Update
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
}
