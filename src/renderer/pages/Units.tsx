import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  CubeIcon,
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type { Unit, InvoiceUnit } from "../../shared/types";

export default function Units() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [activeSection, setActiveSection] = useState<"stock" | "invoice">(
    "stock"
  );
  const [stockAddOpen, setStockAddOpen] = useState(false);
  const [stockEditing, setStockEditing] = useState<Unit | null>(null);
  const [invoiceAddOpen, setInvoiceAddOpen] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState<InvoiceUnit | null>(
    null
  );

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
  });

  const { data: invoiceUnits = [] } = useQuery({
    queryKey: ["invoiceUnits"],
    queryFn: () => api.getInvoiceUnits() as Promise<InvoiceUnit[]>,
  });

  const createUnit = useMutation({
    mutationFn: (payload: { name: string; symbol?: string | null }) =>
      api.createUnit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setStockAddOpen(false);
    },
  });

  const updateUnit = useMutation({
    mutationFn: ({
      id,
      name,
      symbol,
    }: {
      id: number;
      name: string;
      symbol?: string | null;
    }) => api.updateUnit(id, { name, symbol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setStockEditing(null);
    },
  });

  const deleteUnit = useMutationWithToast({
    mutationFn: (id: number) => api.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });

  const createInvoiceUnit = useMutation({
    mutationFn: (payload: {
      name: string;
      symbol?: string | null;
      sort_order?: number;
    }) => api.createInvoiceUnit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceUnits"] });
      setInvoiceAddOpen(false);
    },
  });

  const updateInvoiceUnit = useMutation({
    mutationFn: ({
      id,
      name,
      symbol,
      sort_order,
    }: {
      id: number;
      name: string;
      symbol?: string | null;
      sort_order?: number;
    }) => api.updateInvoiceUnit(id, { name, symbol, sort_order }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceUnits"] });
      setInvoiceEditing(null);
    },
  });

  const deleteInvoiceUnit = useMutationWithToast({
    mutationFn: (id: number) => api.deleteInvoiceUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceUnits"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Units</h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSection("stock")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeSection === "stock"
              ? "bg-white border border-b-0 border-gray-200 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <CubeIcon className="w-4 h-4" aria-hidden />
          Stock units (godown)
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("invoice")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeSection === "invoice"
              ? "bg-white border border-b-0 border-gray-200 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" aria-hidden />
          Invoice units
        </button>
      </div>

      {activeSection === "stock" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setStockAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add unit
            </Button>
          </div>
          <DataTable<Unit>
            columns={[
              { key: "name", label: "Name" },
              {
                key: "symbol",
                label: "Symbol",
                render: (row) => row.symbol?.trim() || "—",
              },
            ]}
            data={units}
            onEdit={(row) => setStockEditing(row)}
            onDelete={(row) => {
              if (
                globalThis.confirm(
                  "Delete this unit? Products using it will be blocked."
                )
              ) {
                deleteUnit.mutate(row.id);
              }
            }}
            emptyMessage="No stock units. Add one to get started."
          />
        </div>
      )}

      {activeSection === "invoice" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setInvoiceAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add unit
            </Button>
          </div>
          <DataTable<InvoiceUnit>
            columns={[
              { key: "name", label: "Name" },
              {
                key: "symbol",
                label: "Symbol",
                render: (row) => row.symbol?.trim() || "—",
              },
              { key: "sort_order", label: "Sort order" },
            ]}
            data={invoiceUnits}
            onEdit={(row) => setInvoiceEditing(row)}
            onDelete={(row) => {
              if (globalThis.confirm("Delete this invoice unit?")) {
                deleteInvoiceUnit.mutate(row.id);
              }
            }}
            emptyMessage="No invoice units. Add one to get started."
          />
        </div>
      )}

      {/* Stock unit – Add */}
      <FormModal
        title="Add stock unit"
        open={stockAddOpen}
        onClose={() => setStockAddOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStockAddOpen(false)}>
              <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Cancel
            </Button>
            <Button
              onClick={() => {
                const form = document.getElementById(
                  "form-stock-add"
                ) as HTMLFormElement;
                if (!form) return;
                const els = form.elements as unknown as {
                  name: HTMLInputElement;
                  symbol: HTMLInputElement;
                };
                const name = els.name?.value?.trim();
                if (!name) return;
                createUnit.mutate({
                  name,
                  symbol: els.symbol?.value?.trim() || undefined,
                });
              }}
            >
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add
            </Button>
          </>
        }
      >
        <form
          id="form-stock-add"
          onSubmit={(e) => {
            e.preventDefault();
            const els = (e.target as HTMLFormElement).elements as unknown as {
              name: HTMLInputElement;
              symbol: HTMLInputElement;
            };
            const name = els.name?.value?.trim();
            if (!name) return;
            createUnit.mutate({
              name,
              symbol: els.symbol?.value?.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. bags, jars"
              required
            />
          </FormField>
          <FormField label="Symbol (optional)">
            <input
              name="symbol"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. g for gram; if empty, full name is used"
            />
          </FormField>
        </form>
      </FormModal>

      {/* Stock unit – Edit */}
      <FormModal
        title="Edit stock unit"
        open={!!stockEditing}
        onClose={() => setStockEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStockEditing(null)}>
              <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Cancel
            </Button>
            <Button
              onClick={() => {
                const form = document.getElementById(
                  "form-stock-edit"
                ) as HTMLFormElement;
                if (!form || !stockEditing) return;
                const els = form.elements as unknown as {
                  name: HTMLInputElement;
                  symbol: HTMLInputElement;
                };
                const name = els.name?.value?.trim();
                if (!name) return;
                updateUnit.mutate({
                  id: stockEditing.id,
                  name,
                  symbol: els.symbol?.value?.trim() || undefined,
                });
              }}
            >
              <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Save
            </Button>
          </>
        }
      >
        {stockEditing && (
          <form
            id="form-stock-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const els = (e.target as HTMLFormElement).elements as unknown as {
                name: HTMLInputElement;
                symbol: HTMLInputElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              updateUnit.mutate({
                id: stockEditing.id,
                name,
                symbol: els.symbol?.value?.trim() || undefined,
              });
            }}
            className="space-y-4"
          >
            <FormField label="Name" required>
              <input
                name="name"
                defaultValue={stockEditing.name}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </FormField>
            <FormField label="Symbol (optional)">
              <input
                name="symbol"
                defaultValue={stockEditing.symbol ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g. g for gram"
              />
            </FormField>
          </form>
        )}
      </FormModal>

      {/* Invoice unit – Add */}
      <FormModal
        title="Add invoice unit"
        open={invoiceAddOpen}
        onClose={() => setInvoiceAddOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setInvoiceAddOpen(false)}
            >
              <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Cancel
            </Button>
            <Button
              onClick={() => {
                const form = document.getElementById(
                  "form-invoice-add"
                ) as HTMLFormElement;
                if (!form) return;
                const els = form.elements as unknown as {
                  name: HTMLInputElement;
                  symbol: HTMLInputElement;
                  sort_order: HTMLInputElement;
                };
                const name = els.name?.value?.trim();
                if (!name) return;
                createInvoiceUnit.mutate({
                  name,
                  symbol: els.symbol?.value?.trim() || undefined,
                  sort_order: Number.parseInt(
                    els.sort_order?.value || "999",
                    10
                  ),
                });
              }}
            >
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add
            </Button>
          </>
        }
      >
        <form
          id="form-invoice-add"
          onSubmit={(e) => {
            e.preventDefault();
            const els = (e.target as HTMLFormElement).elements as unknown as {
              name: HTMLInputElement;
              symbol: HTMLInputElement;
              sort_order: HTMLInputElement;
            };
            const name = els.name?.value?.trim();
            if (!name) return;
            createInvoiceUnit.mutate({
              name,
              symbol: els.symbol?.value?.trim() || undefined,
              sort_order: Number.parseInt(els.sort_order?.value || "999", 10),
            });
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. gram, kg, pcs"
              required
            />
          </FormField>
          <FormField label="Symbol (optional)">
            <input
              name="symbol"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. g, kg, L"
            />
          </FormField>
          <FormField label="Sort order (lower = first in dropdown)">
            <input
              name="sort_order"
              type="number"
              defaultValue={999}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </FormField>
        </form>
      </FormModal>

      {/* Invoice unit – Edit */}
      <FormModal
        title="Edit invoice unit"
        open={!!invoiceEditing}
        onClose={() => setInvoiceEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setInvoiceEditing(null)}>
              <XMarkIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Cancel
            </Button>
            <Button
              onClick={() => {
                const form = document.getElementById(
                  "form-invoice-edit"
                ) as HTMLFormElement;
                if (!form || !invoiceEditing) return;
                const els = form.elements as unknown as {
                  name: HTMLInputElement;
                  symbol: HTMLInputElement;
                  sort_order: HTMLInputElement;
                };
                const name = els.name?.value?.trim();
                if (!name) return;
                updateInvoiceUnit.mutate({
                  id: invoiceEditing.id,
                  name,
                  symbol: els.symbol?.value?.trim() || undefined,
                  sort_order: Number.parseInt(
                    els.sort_order?.value || "999",
                    10
                  ),
                });
              }}
            >
              <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Save
            </Button>
          </>
        }
      >
        {invoiceEditing && (
          <form
            id="form-invoice-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const els = (e.target as HTMLFormElement).elements as unknown as {
                name: HTMLInputElement;
                symbol: HTMLInputElement;
                sort_order: HTMLInputElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              updateInvoiceUnit.mutate({
                id: invoiceEditing.id,
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                sort_order: Number.parseInt(els.sort_order?.value || "999", 10),
              });
            }}
            className="space-y-4"
          >
            <FormField label="Name" required>
              <input
                name="name"
                defaultValue={invoiceEditing.name}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </FormField>
            <FormField label="Symbol (optional)">
              <input
                name="symbol"
                defaultValue={invoiceEditing.symbol ?? ""}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
            <FormField label="Sort order">
              <input
                name="sort_order"
                type="number"
                defaultValue={invoiceEditing.sort_order}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
          </form>
        )}
      </FormModal>
    </div>
  );
}
