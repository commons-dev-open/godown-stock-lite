import { useState, useEffect } from "react";
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
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import SearchFilterBar from "../components/SearchFilterBar";
import TableLoader from "../components/TableLoader";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import toast from "react-hot-toast";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import {
  exportItemsToCsv,
  exportItemsToPdf,
  getPrintTableBody,
} from "../lib/exportItems";
import type {
  Item,
  ItemOtherUnit,
  InvoiceUnit,
  Unit,
} from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

const UNIT_ADD_NEW = "__new__";

type ItemWithUnits = Item & {
  other_units?: { id?: number; unit: string; sort_order: number }[];
};

export default function Items() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [reduceStockOpen, setReduceStockOpen] = useState(false);
  const [editing, setEditing] = useState<ItemWithUnits | null>(null);
  const [addStockItem, setAddStockItem] = useState<Item | null>(null);
  const [reduceStockItem, setReduceStockItem] = useState<Item | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [addUnitSelect, setAddUnitSelect] = useState<string>("");
  const [editUnitSelect, setEditUnitSelect] = useState<string>("");
  const [addRetailPrimary, setAddRetailPrimary] = useState<string>("");
  const [addOtherUnits, setAddOtherUnits] = useState<ItemOtherUnit[]>([]);
  const [editRetailPrimary, setEditRetailPrimary] = useState<string>("");
  const [editOtherUnits, setEditOtherUnits] = useState<ItemOtherUnit[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    columns: string[];
    rows: string[][];
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

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
  });

  const { data: invoiceUnits = [] } = useQuery({
    queryKey: ["invoiceUnits"],
    queryFn: () => api.getInvoiceUnits() as Promise<InvoiceUnit[]>,
  });

  const unitDisplay = (unitName: string) => {
    const u = units.find((x) => x.name === unitName);
    return (u?.symbol && u.symbol.trim()) || unitName;
  };

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems() as Promise<Item[]>,
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
    mutationFn: async (payload: {
      name: string;
      code?: string;
      unit: string;
      newUnitName?: string;
      retail_primary_unit?: string | null;
      other_units?: ItemOtherUnit[];
      current_stock?: number;
      reorder_level?: number;
    }) => {
      let unit = payload.unit;
      if (payload.newUnitName?.trim()) {
        unit = await api.createUnit(payload.newUnitName.trim());
      }
      return api.createItem({
        name: payload.name,
        code: payload.code,
        unit,
        retail_primary_unit: payload.retail_primary_unit ?? null,
        other_units: payload.other_units,
        current_stock: payload.current_stock,
        reorder_level: payload.reorder_level,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setAddProductOpen(false);
    },
  });

  const updateItem = useMutation({
    mutationFn: async (payload: {
      id: number;
      item: Parameters<typeof api.updateItem>[1];
      newUnitName?: string;
      other_units?: ItemOtherUnit[];
    }) => {
      let unit = payload.item.unit;
      if (payload.newUnitName?.trim()) {
        unit = await api.createUnit(payload.newUnitName.trim());
      }
      return api.updateItem(payload.id, {
        ...payload.item,
        unit,
        other_units: payload.other_units,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setEditing(null);
    },
  });

  const deleteItem = useMutationWithToast({
    mutationFn: (id: number) => api.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
    },
  });

  const addStock = useMutationWithToast({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.addStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setAddStockOpen(false);
      setAddStockItem(null);
    },
  });

  const reduceStock = useMutationWithToast({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.reduceStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      setReduceStockOpen(false);
      setReduceStockItem(null);
    },
  });

  async function getExportData(): Promise<Item[]> {
    const data = await queryClient.fetchQuery({
      queryKey: ["items"],
      queryFn: () => api.getItems() as Promise<Item[]>,
    });
    return data ?? [];
  }

  async function handleExportCsv() {
    setExportOpen(false);
    const allItems = await getExportData();
    if (allItems.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportItemsToCsv(allItems);
    toast.success("Exported as CSV.");
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const allItems = await getExportData();
    if (allItems.length === 0) {
      toast.error("No data to export.");
      return;
    }
    exportItemsToPdf(allItems);
    toast.success("Exported as PDF.");
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const allItems = await getExportData();
    if (allItems.length === 0) {
      toast.error("No data to export.");
      return;
    }
    setPrintData(getPrintTableBody(allItems));
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
          <h1 className="text-2xl font-semibold text-gray-900">
            Products & Stock
          </h1>
          <div className="flex items-center gap-2">
            <div ref={exportRefs.setReference} {...getExportRefProps()}>
              <Button variant="secondary" type="button">
                Export
              </Button>
            </div>
            <FloatingPortal>
              {exportOpen && (
                <div
                  ref={exportRefs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
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
            <Button variant="secondary" onClick={() => setAddStockOpen(true)}>
              Add Stock
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReduceStockOpen(true)}
            >
              Reduce Stock
            </Button>
            <Button variant="primary" onClick={() => setAddProductOpen(true)}>
              Add Product
            </Button>
          </div>
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
          placeholder="Search by name or code…"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <TableLoader />
        ) : itemsPage.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <DataTable<Item>
              columns={[
                { key: "name", label: "Name" },
                { key: "code", label: "Code" },
                {
                  key: "current_stock",
                  label: "Current Stock",
                  render: (r) => formatDecimal(r.current_stock),
                },
                {
                  key: "unit",
                  label: "Unit",
                  render: (r) => {
                    const u = units.find((x) => x.name === r.unit);
                    return (u?.symbol && u.symbol.trim()) || r.unit;
                  },
                },
                {
                  key: "reorder_level",
                  label: "Reorder Level",
                  render: (r) =>
                    r.reorder_level != null
                      ? formatDecimal(r.reorder_level)
                      : "",
                },
              ]}
              data={itemsPage}
              onEdit={async (row) => {
                const full = (await api.getItemById(row.id)) as ItemWithUnits;
                setEditing(full);
                setEditUnitSelect(full.unit);
                setEditRetailPrimary(full.retail_primary_unit ?? "");
                setEditOtherUnits(
                  full.other_units?.map((o) => ({
                    unit: o.unit,
                    sort_order: o.sort_order ?? 0,
                  })) ?? []
                );
              }}
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
        onClose={() => {
          setAddProductOpen(false);
          setAddUnitSelect("");
          setAddRetailPrimary("");
          setAddOtherUnits([]);
        }}
        maxWidth="max-w-lg"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const els = form.elements as HTMLFormControlsCollection & {
              name: HTMLInputElement;
              code: HTMLInputElement;
              unit: HTMLSelectElement;
              unit_name?: HTMLInputElement;
              current_stock: HTMLInputElement;
              reorder_level: HTMLInputElement;
            };
            const isNewUnit = els.unit.value === UNIT_ADD_NEW;
            const newUnitName = els.unit_name?.value?.trim();
            createItem.mutate({
              name: els.name.value,
              code: els.code.value || undefined,
              unit: isNewUnit ? "" : els.unit.value,
              newUnitName: isNewUnit ? newUnitName : undefined,
              retail_primary_unit: addRetailPrimary || undefined,
              other_units: addOtherUnits.length > 0 ? addOtherUnits : undefined,
              current_stock: Number(els.current_stock.value) || 0,
              reorder_level: Number(els.reorder_level.value) || undefined,
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
          <FormField label="Code">
            <input
              name="code"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <FormField
            label="Unit"
            required
            extra={
              addUnitSelect === UNIT_ADD_NEW ? (
                <FormField label="Unit name" required>
                  <input
                    name="unit_name"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="e.g. packets, tins, bags"
                    required={addUnitSelect === UNIT_ADD_NEW}
                  />
                </FormField>
              ) : undefined
            }
          >
            <select
              name="unit"
              value={addUnitSelect}
              onChange={(e) => setAddUnitSelect(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {(u.symbol && u.symbol.trim()) || u.name}
                </option>
              ))}
              <option value={UNIT_ADD_NEW}>Add new…</option>
            </select>
          </FormField>
          <FormField label="Retail primary unit (optional)">
            <select
              value={addRetailPrimary}
              onChange={(e) => setAddRetailPrimary(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">None</option>
              {invoiceUnits.map((u) => (
                <option key={u.id} value={u.name}>
                  {(u.symbol && u.symbol.trim()) || u.name}
                </option>
              ))}
            </select>
          </FormField>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="block text-sm font-medium text-gray-700">
                Other units (optional)
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setAddOtherUnits((prev) => [
                    ...prev,
                    { unit: "", sort_order: prev.length },
                  ])
                }
              >
                Add unit
              </Button>
            </div>
            {addOtherUnits.map((ou, idx) => (
              <div key={idx} className="flex gap-2 items-center mt-2">
                <select
                  value={ou.unit}
                  onChange={(e) =>
                    setAddOtherUnits((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, unit: e.target.value } : p
                      )
                    )
                  }
                  className="flex-1 border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Select unit</option>
                  {invoiceUnits.map((u) => (
                    <option key={u.id} value={u.name}>
                      {(u.symbol && u.symbol.trim()) || u.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setAddOtherUnits((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-red-600 hover:underline text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">
              Import units from product
            </span>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;
                api.getItemById(id).then((item: ItemWithUnits) => {
                  setAddUnitSelect(item.unit);
                  setAddRetailPrimary(item.retail_primary_unit ?? "");
                  setAddOtherUnits(
                    (item.other_units ?? []).map((o) => ({
                      unit: o.unit,
                      sort_order: o.sort_order ?? 0,
                    }))
                  );
                });
                e.target.value = "";
              }}
            >
              <option value="">Select a product to copy units…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Current Stock">
            <input
              name="current_stock"
              type="number"
              min="0"
              defaultValue="0"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <FormField label="Reorder Level">
            <input
              name="reorder_level"
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddProductOpen(false)}
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
        title="Edit Product"
        open={!!editing}
        onClose={() => {
          setEditing(null);
          setEditUnitSelect("");
          setEditRetailPrimary("");
          setEditOtherUnits([]);
        }}
        maxWidth="max-w-lg"
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const els = form.elements as HTMLFormControlsCollection & {
                name: HTMLInputElement;
                code: HTMLInputElement;
                unit: HTMLSelectElement;
                unit_name?: HTMLInputElement;
                current_stock: HTMLInputElement;
                reorder_level: HTMLInputElement;
              };
              const isNewUnit = els.unit.value === UNIT_ADD_NEW;
              const newUnitName = els.unit_name?.value?.trim();
              updateItem.mutate({
                id: editing.id,
                item: {
                  name: els.name.value,
                  code: els.code.value || undefined,
                  unit: isNewUnit ? editing.unit : els.unit.value,
                  retail_primary_unit: editRetailPrimary || null,
                  current_stock: Number(els.current_stock.value),
                  reorder_level: Number(els.reorder_level.value) || undefined,
                },
                newUnitName: isNewUnit ? newUnitName : undefined,
                other_units: editOtherUnits,
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
            <FormField label="Code">
              <input
                name="code"
                defaultValue={editing.code ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField
              label="Unit"
              required
              extra={
                editUnitSelect === UNIT_ADD_NEW ? (
                  <FormField label="Unit name" required>
                    <input
                      name="unit_name"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="e.g. packets, tins, bags"
                      required={editUnitSelect === UNIT_ADD_NEW}
                    />
                  </FormField>
                ) : undefined
              }
            >
              <select
                name="unit"
                value={editUnitSelect || editing.unit}
                onChange={(e) => setEditUnitSelect(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="">Select unit</option>
                {(units.some((u) => u.name === editing.unit)
                  ? units
                  : [
                      {
                        id: -1,
                        name: editing.unit,
                        symbol: null,
                        created_at: "",
                      },
                      ...units,
                    ]
                ).map((u) => (
                  <option
                    key={u.id >= 0 ? u.id : `unit-${u.name}`}
                    value={u.name}
                  >
                    {(u.symbol && u.symbol.trim()) || u.name}
                  </option>
                ))}
                <option value={UNIT_ADD_NEW}>Add new…</option>
              </select>
            </FormField>
            <FormField label="Retail primary unit (optional)">
              <select
                value={editRetailPrimary}
                onChange={(e) => setEditRetailPrimary(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">None</option>
                {invoiceUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {(u.symbol && u.symbol.trim()) || u.name}
                  </option>
                ))}
              </select>
            </FormField>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="block text-sm font-medium text-gray-700">
                  Other units (optional)
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setEditOtherUnits((prev) => [
                      ...prev,
                      { unit: "", sort_order: prev.length },
                    ])
                  }
                >
                  Add unit
                </Button>
              </div>
              {editOtherUnits.map((ou, idx) => (
                <div key={idx} className="flex gap-2 items-center mt-2">
                  <select
                    value={ou.unit}
                    onChange={(e) =>
                      setEditOtherUnits((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, unit: e.target.value } : p
                        )
                      )
                    }
                    className="flex-1 border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select unit</option>
                    {invoiceUnits.map((u) => (
                      <option key={u.id} value={u.name}>
                        {(u.symbol && u.symbol.trim()) || u.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setEditOtherUnits((prev) =>
                        prev.filter((_, i) => i !== idx)
                      )
                    }
                    className="text-red-600 hover:underline text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Import units from product
              </span>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2"
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (!id || id === editing.id) return;
                  api.getItemById(id).then((item: ItemWithUnits) => {
                    setEditUnitSelect(item.unit);
                    setEditRetailPrimary(item.retail_primary_unit ?? "");
                    setEditOtherUnits(
                      (item.other_units ?? []).map((o) => ({
                        unit: o.unit,
                        sort_order: o.sort_order ?? 0,
                      }))
                    );
                  });
                  e.target.value = "";
                }}
              >
                <option value="">Select a product to copy units…</option>
                {items
                  .filter((i) => i.id !== editing.id)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
            <FormField label="Current Stock">
              <input
                name="current_stock"
                type="number"
                min="0"
                defaultValue={editing.current_stock}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Reorder Level">
              <input
                name="reorder_level"
                type="number"
                min="0"
                defaultValue={editing.reorder_level ?? ""}
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
            if (qty <= 0) {
              toast.error("Quantity must be positive.");
              return;
            }
            addStock.mutate({ id: addStockItem.id, quantity: qty });
          }}
        >
          <FormField label="Product">
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
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
                  {i.name} ({formatDecimal(i.current_stock)}{" "}
                  {unitDisplay(i.unit)})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Quantity to add">
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="any"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddStockOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add
            </Button>
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
            if (qty <= 0) {
              toast.error("Quantity must be positive.");
              return;
            }
            reduceStock.mutate({ id: reduceStockItem.id, quantity: qty });
          }}
        >
          <FormField label="Product">
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
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
                  {i.name} ({formatDecimal(i.current_stock)}{" "}
                  {unitDisplay(i.unit)})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Quantity to deduct">
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="any"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setReduceStockOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Reduce
            </Button>
          </div>
        </form>
      </FormModal>

      {printData && (
        <div
          className="app-print-container items-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-white p-6 print:block"
          aria-hidden
        >
          <header className="items-print-header mb-4 border-b border-gray-200 pb-3">
            <p className="items-print-app-name text-sm font-semibold text-gray-900">
              Godown Stock Lite
            </p>
            <p className="items-print-report text-xs text-gray-600">
              Products & Stock
            </p>
            <p className="items-print-datetime mt-1 text-xs text-gray-500">
              {new Date().toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </header>
          <table className="items-print-table w-full border-collapse text-xs">
            <thead>
              <tr className="items-print-thead">
                {printData.columns.map((col) => (
                  <th
                    key={col}
                    className="border border-gray-300 px-2 py-1.5 text-left font-medium text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printData.rows.map((row) => (
                <tr key={row[0]} className="items-print-tbody-tr">
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
