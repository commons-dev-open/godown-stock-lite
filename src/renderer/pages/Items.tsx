import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import TableLoader from "../components/TableLoader";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import type { Item } from "../../shared/types";

export default function Items() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [reduceStockOpen, setReduceStockOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [addStockItem, setAddStockItem] = useState<Item | null>(null);
  const [reduceStockItem, setReduceStockItem] = useState<Item | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const { data: pageResult, isLoading } = useQuery({
    queryKey: ["itemsPage", search, page],
    queryFn: () =>
      api.getItemsPage({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{
        data: Item[];
        total: number;
      }>,
  });
  const itemsPage = pageResult?.data ?? [];
  const totalItems = pageResult?.total ?? 0;

  const createItem = useMutation({
    mutationFn: (item: {
      name: string;
      code?: string;
      unit: string;
      current_stock?: number;
      reorder_level?: number;
    }) => api.createItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setAddProductOpen(false);
    },
  });

  const updateItem = useMutation({
    mutationFn: ({
      id,
      item,
    }: {
      id: number;
      item: Parameters<typeof api.updateItem>[1];
    }) => api.updateItem(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setEditing(null);
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const addStock = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.addStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setAddStockOpen(false);
      setAddStockItem(null);
    },
    onError: (err: Error) => alert(err.message),
  });

  const reduceStock = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.reduceStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setReduceStockOpen(false);
      setReduceStockItem(null);
    },
    onError: (err: Error) => alert(err.message),
  });

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Products & Stock
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddStockOpen(true)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              Add Stock
            </button>
            <button
              type="button"
              onClick={() => setReduceStockOpen(true)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              Reduce Stock
            </button>
            <button
              type="button"
              onClick={() => setAddProductOpen(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Add Product
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : (
          <>
            <DataTable<Item>
              columns={[
                { key: "name", label: "Name" },
                { key: "code", label: "Code" },
                { key: "unit", label: "Unit" },
                { key: "current_stock", label: "Current Stock" },
                { key: "reorder_level", label: "Reorder Level" },
              ]}
              data={itemsPage}
              onEdit={setEditing}
              onDelete={(row) => {
                if (globalThis.confirm("Delete this product? Stock must be 0."))
                  deleteItem.mutate(row.id);
              }}
              emptyMessage="No products yet. Click Add Product."
            />
            <Pagination
              page={page}
              total={totalItems}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <FormModal
        title="Add Product"
        open={addProductOpen}
        onClose={() => setAddProductOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            createItem.mutate({
              name: (form.name as HTMLInputElement).value,
              code: (form.code as HTMLInputElement).value || undefined,
              unit: (form.unit as HTMLInputElement).value || "pcs",
              current_stock:
                Number((form.current_stock as HTMLInputElement).value) || 0,
              reorder_level:
                Number((form.reorder_level as HTMLInputElement).value) ||
                undefined,
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              name="name"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input name="code" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit (e.g. packets, tin, bags)
            </label>
            <input
              name="unit"
              defaultValue="pcs"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Stock
            </label>
            <input
              name="current_stock"
              type="number"
              min="0"
              defaultValue="0"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reorder Level
            </label>
            <input
              name="reorder_level"
              type="number"
              min="0"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddProductOpen(false)}
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
        title="Edit Product"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              updateItem.mutate({
                id: editing.id,
                item: {
                  name: (form.name as HTMLInputElement).value,
                  code: (form.code as HTMLInputElement).value || undefined,
                  unit: (form.unit as HTMLInputElement).value,
                  current_stock: Number(
                    (form.current_stock as HTMLInputElement).value
                  ),
                  reorder_level:
                    Number((form.reorder_level as HTMLInputElement).value) ||
                    undefined,
                },
              });
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                name="name"
                defaultValue={editing.name}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                name="code"
                defaultValue={editing.code ?? ""}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <input
                name="unit"
                defaultValue={editing.unit}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Stock
              </label>
              <input
                name="current_stock"
                type="number"
                min="0"
                defaultValue={editing.current_stock}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Level
              </label>
              <input
                name="reorder_level"
                type="number"
                min="0"
                defaultValue={editing.reorder_level ?? ""}
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

      <FormModal
        title="Add Stock"
        open={addStockOpen}
        onClose={() => {
          setAddStockOpen(false);
          setAddStockItem(null);
        }}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addStockItem) return;
            const qty = Number((e.target as HTMLFormElement).quantity.value);
            if (qty <= 0) return alert("Quantity must be positive.");
            addStock.mutate({ id: addStockItem.id, quantity: qty });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={addStockItem?.id ?? ""}
              onChange={(e) =>
                setAddStockItem(
                  items.find((i) => i.id === Number(e.target.value)) ?? null
                )
              }
              required
            >
              <option value="">Select product</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.current_stock} {i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to add
            </label>
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="any"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddStockOpen(false)}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
            >
              Add
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Reduce Stock"
        open={reduceStockOpen}
        onClose={() => {
          setReduceStockOpen(false);
          setReduceStockItem(null);
        }}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reduceStockItem) return;
            const qty = Number((e.target as HTMLFormElement).quantity.value);
            if (qty <= 0) return alert("Quantity must be positive.");
            reduceStock.mutate({ id: reduceStockItem.id, quantity: qty });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={reduceStockItem?.id ?? ""}
              onChange={(e) =>
                setReduceStockItem(
                  items.find((i) => i.id === Number(e.target.value)) ?? null
                )
              }
              required
            >
              <option value="">Select product</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.current_stock} {i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to deduct
            </label>
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="any"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setReduceStockOpen(false)}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded"
            >
              Reduce
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
