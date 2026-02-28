import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { todayISO, formatDate } from "../lib/date";
import type { Purchase } from "../../shared/types";

type PurchaseRow = Purchase & { product_name?: string };

type PurchaseLine = {
  product_id: number;
  product_name: string;
  amount: number;
};

const emptyLine = (): PurchaseLine => ({
  product_id: 0,
  product_name: "",
  amount: 0,
});

export default function Purchases() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRow | null>(null);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    emptyLine(),
  ]);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const itemList = items as { id: number; name: string }[];

  const { data: pageResult, isLoading } = useQuery({
    queryKey: [
      "purchasesPage",
      fromDate || undefined,
      toDate || undefined,
      page,
    ],
    queryFn: () =>
      api.getPurchasesPage({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: PurchaseRow[]; total: number }>,
  });
  const purchases = pageResult?.data ?? [];
  const totalPurchases = pageResult?.total ?? 0;

  const createPurchaseBatch = useMutation({
    mutationFn: (payload: {
      transaction_date: string;
      notes?: string;
      lines: { product_id: number; amount: number }[];
    }) => api.createPurchaseBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      setAddOpen(false);
      setPurchaseLines([emptyLine()]);
      toast.success("Cash purchases saved");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save cash purchases");
    },
  });

  const updatePurchase = useMutation({
    mutationFn: ({
      id,
      p,
    }: {
      id: number;
      p: { transaction_date?: string; amount?: number; notes?: string };
    }) => api.updatePurchase(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      setEditing(null);
    },
  });

  const deletePurchase = useMutation({
    mutationFn: (id: number) => api.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
    },
  });

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Cash purchases
          </h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Cash Purchase
          </button>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            To date
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading…</div>
        ) : (
          <>
            <DataTable<PurchaseRow>
              columns={[
                {
                  key: "transaction_date",
                  label: "Date",
                  render: (r) => formatDate(r.transaction_date),
                },
                { key: "product_name", label: "Product" },
                {
                  key: "amount",
                  label: "Amount",
                  render: (r) => r.amount.toFixed(2),
                },
              ]}
              data={purchases}
              onEdit={(r) => setEditing(r)}
              onDelete={(row) => {
                if (globalThis.confirm("Delete this cash purchase?"))
                  deletePurchase.mutate(row.id);
              }}
              emptyMessage="No cash purchases. Filter by date or add one."
            />
            <Pagination
              page={page}
              total={totalPurchases}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Cash Purchase"
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPurchaseLines([emptyLine()]);
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
                const amount = Number(
                  (form[`amount_${idx}`] as HTMLInputElement)?.value
                );
                const item = itemList.find((i) => i.id === productId);
                return productId && amount >= 0
                  ? {
                      product_id: productId,
                      product_name: item?.name ?? "",
                      amount,
                    }
                  : null;
              })
              .filter((l): l is PurchaseLine => l != null);
            if (!lines.length) {
              toast.error("Add at least one product with amount.");
              return;
            }
            createPurchaseBatch.mutate({
              transaction_date,
              notes: notes || undefined,
              lines: lines.map((l) => ({
                product_id: l.product_id,
                amount: l.amount,
              })),
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
                  setPurchaseLines((prev) => [...prev, emptyLine()])
                }
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add product
              </button>
            </div>
            {purchaseLines.map((line, idx) => (
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
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-0.5">
                    Amount (₹)
                  </label>
                  <input
                    name={`amount_${idx}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount || ""}
                    onChange={(e) =>
                      setPurchaseLines((prev) => {
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
                setAddOpen(false);
                setPurchaseLines([emptyLine()]);
              }}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
              disabled={createPurchaseBatch.isPending}
            >
              {createPurchaseBatch.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Cash purchase"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              updatePurchase.mutate({
                id: editing.id,
                p: {
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
                defaultValue={editing.transaction_date}
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
                value={editing.product_name ?? ""}
                readOnly
                className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.amount}
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
                defaultValue={editing.notes ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
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
