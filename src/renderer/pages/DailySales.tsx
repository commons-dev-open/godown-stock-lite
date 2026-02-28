import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { todayISO, formatDate } from "../lib/date";
import type { DailySale } from "../../shared/types";

export default function DailySales() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DailySale | null>(null);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: pageResult, isLoading } = useQuery({
    queryKey: [
      "dailySalesPage",
      fromDate || undefined,
      toDate || undefined,
      page,
    ],
    queryFn: () =>
      api.getDailySalesPage({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: DailySale[]; total: number }>,
  });
  const sales = pageResult?.data ?? [];
  const totalSales = pageResult?.total ?? 0;

  const createSale = useMutation({
    mutationFn: (s: {
      sale_date: string;
      sale_amount: number;
      cash_in_hand: number;
      expenditure_amount?: number;
      notes?: string;
    }) => api.createDailySale(s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      setAddOpen(false);
    },
  });

  const updateSale = useMutation({
    mutationFn: ({
      id,
      s,
    }: {
      id: number;
      s: {
        sale_date?: string;
        sale_amount?: number;
        cash_in_hand?: number;
        expenditure_amount?: number;
        notes?: string;
      };
    }) => api.updateDailySale(id, s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
      setEditing(null);
    },
  });

  const deleteSale = useMutation({
    mutationFn: (id: number) => api.deleteDailySale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
      queryClient.invalidateQueries({ queryKey: ["dailySalesPage"] });
    },
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Daily Sales</h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Add Sale
          </button>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            From
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
            To
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
            <DataTable<DailySale>
              columns={[
                {
                  key: "sale_date",
                  label: "Date",
                  render: (r) => formatDate(r.sale_date),
                },
                {
                  key: "sale_amount",
                  label: "Sale Amount",
                  render: (r) => r.sale_amount.toFixed(2),
                },
                {
                  key: "cash_in_hand",
                  label: "Cash in Hand",
                  render: (r) => r.cash_in_hand.toFixed(2),
                },
                {
                  key: "expenditure_amount",
                  label: "Expenditure",
                  render: (r) => (r.expenditure_amount ?? 0).toFixed(2),
                },
              ]}
              data={sales}
              onEdit={setEditing}
              onDelete={(row) => {
                if (globalThis.confirm("Delete this sale?"))
                  deleteSale.mutate(row.id);
              }}
              emptyMessage="No sales yet. Click Add Sale."
            />
            <Pagination
              page={page}
              total={totalSales}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Add Sale"
        open={addOpen}
        onClose={() => setAddOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            createSale.mutate({
              sale_date: (form.sale_date as HTMLInputElement).value,
              sale_amount: Number((form.sale_amount as HTMLInputElement).value),
              cash_in_hand: Number(
                (form.cash_in_hand as HTMLInputElement).value
              ),
              expenditure_amount:
                Number((form.expenditure_amount as HTMLInputElement).value) ||
                undefined,
              notes: (form.notes as HTMLInputElement).value || undefined,
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              name="sale_date"
              type="date"
              defaultValue={todayISO()}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sale Amount *
            </label>
            <input
              name="sale_amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cash in Hand *
            </label>
            <input
              name="cash_in_hand"
              type="number"
              min="0"
              step="0.01"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expenditure (if any)
            </label>
            <input
              name="expenditure_amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
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
              onClick={() => setAddOpen(false)}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Edit Sale"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              updateSale.mutate({
                id: editing.id,
                s: {
                  sale_date: (form.sale_date as HTMLInputElement).value,
                  sale_amount: Number(
                    (form.sale_amount as HTMLInputElement).value
                  ),
                  cash_in_hand: Number(
                    (form.cash_in_hand as HTMLInputElement).value
                  ),
                  expenditure_amount:
                    Number(
                      (form.expenditure_amount as HTMLInputElement).value
                    ) || undefined,
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
                name="sale_date"
                type="date"
                defaultValue={editing.sale_date}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Amount *
              </label>
              <input
                name="sale_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.sale_amount}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash in Hand *
              </label>
              <input
                name="cash_in_hand"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.cash_in_hand}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expenditure
              </label>
              <input
                name="expenditure_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.expenditure_amount ?? 0}
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
