import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowsRightLeftIcon,
  CheckIcon,
  CubeIcon,
  DocumentTextIcon,
  ListBulletIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import SortableUnitTable from "../components/SortableUnitTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type {
  Unit,
  UnitType,
  InvoiceUnit,
  UnitConversion,
} from "../../shared/types";
import {
  isSeedConversion,
  isSeedUnit,
  isSeedUnitType,
} from "../../shared/seedConstants";

export type UnitWithContext = {
  id: number;
  name: string;
  symbol: string | null;
  unit_type_id: number | null;
  unit_type_name: string | null;
  created_at: string;
  in_godown: number;
  in_invoice: number;
  invoice_sort_order: number | null;
};

export default function Units() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [activeSection, setActiveSection] = useState<
    "all" | "types" | "stock" | "invoice" | "conversions"
  >("all");
  const [allAddOpen, setAllAddOpen] = useState(false);
  const [allAddUseStock, setAllAddUseStock] = useState(true);
  const [allAddUseInvoice, setAllAddUseInvoice] = useState(true);
  const [allAddInvoiceSort, setAllAddInvoiceSort] = useState(999);
  const [stockAddOpen, setStockAddOpen] = useState(false);
  const [stockEditing, setStockEditing] = useState<Unit | null>(null);
  const [invoiceAddOpen, setInvoiceAddOpen] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState<InvoiceUnit | null>(
    null
  );
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<Unit | null>(null);
  const [deleteConfirmInvoiceUnit, setDeleteConfirmInvoiceUnit] =
    useState<InvoiceUnit | null>(null);
  const [convAddOpen, setConvAddOpen] = useState(false);
  const [convEditing, setConvEditing] = useState<UnitConversion | null>(null);
  const [deleteConfirmConv, setDeleteConfirmConv] =
    useState<UnitConversion | null>(null);
  const [deleteConfirmAllUnit, setDeleteConfirmAllUnit] =
    useState<UnitWithContext | null>(null);
  const [typesAddOpen, setTypesAddOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<UnitType | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<UnitType | null>(
    null
  );

  const { data: unitTypes = [] } = useQuery({
    queryKey: ["unitTypes"],
    queryFn: () => api.getUnitTypes() as Promise<UnitType[]>,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
  });

  const { data: unitsWithContext = [] } = useQuery({
    queryKey: ["unitsWithContext"],
    queryFn: () => api.getUnitsWithContext() as Promise<UnitWithContext[]>,
  });

  const { data: invoiceUnits = [] } = useQuery({
    queryKey: ["invoiceUnits"],
    queryFn: () => api.getInvoiceUnits() as Promise<InvoiceUnit[]>,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions() as Promise<UnitConversion[]>,
  });

  const allUnitNames = [
    ...new Set([
      ...units.map((u) => u.name),
      ...invoiceUnits.map((u) => u.name),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const createUnitType = useMutation({
    mutationFn: (name: string) => api.createUnitType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitTypes"] });
      setTypesAddOpen(false);
    },
  });

  const updateUnitType = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.updateUnitType(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitTypes"] });
      setTypeEditing(null);
    },
  });

  const deleteUnitType = useMutationWithToast({
    mutationFn: (id: number) => api.deleteUnitType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitTypes"] });
      setDeleteConfirmType(null);
    },
  });

  const createUnit = useMutation({
    mutationFn: (payload: {
      name: string;
      symbol?: string | null;
      unit_type_id?: number | null;
    }) => api.createUnit(payload),
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
      unit_type_id,
    }: {
      id: number;
      name: string;
      symbol?: string | null;
      unit_type_id?: number | null;
    }) => api.updateUnit(id, { name, symbol, unit_type_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      setStockEditing(null);
    },
  });

  const deleteUnit = useMutationWithToast({
    mutationFn: (id: number) => api.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      setDeleteConfirmUnit(null);
      setDeleteConfirmAllUnit(null);
    },
  });

  const addUnitToContext = useMutation({
    mutationFn: ({
      unitId,
      context,
      sortOrder,
    }: {
      unitId: number;
      context: "godown" | "invoice";
      sortOrder?: number;
    }) => api.addUnitToContext(unitId, context, sortOrder),
    onSuccess: (_, { context }) => {
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      queryClient.invalidateQueries({
        queryKey: [context === "godown" ? "units" : "invoiceUnits"],
      });
    },
  });

  const removeUnitFromContext = useMutationWithToast({
    mutationFn: ({
      unitId,
      context,
    }: {
      unitId: number;
      context: "godown" | "invoice";
    }) => api.removeUnitFromContext(unitId, context),
    onSuccess: (_, { context }) => {
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      queryClient.invalidateQueries({
        queryKey: [context === "godown" ? "units" : "invoiceUnits"],
      });
    },
  });

  const createUnitFromAll = useMutation({
    mutationFn: async (payload: {
      name: string;
      symbol?: string | null;
      unit_type_id?: number | null;
      useInStock: boolean;
      useInInvoice: boolean;
      invoiceSortOrder?: number;
    }) => {
      await api.createUnit({
        name: payload.name,
        symbol: payload.symbol,
        unit_type_id: payload.unit_type_id,
      });
      const list = (await api.getUnitsWithContext()) as UnitWithContext[];
      const unit = list.find((u) => u.name === payload.name);
      if (!unit) throw new Error("Unit not found after create");
      if (!payload.useInStock)
        await api.removeUnitFromContext(unit.id, "godown");
      if (!payload.useInInvoice)
        await api.removeUnitFromContext(unit.id, "invoice");
      if (
        payload.useInInvoice &&
        typeof payload.invoiceSortOrder === "number" &&
        Number.isFinite(payload.invoiceSortOrder)
      )
        await api.updateInvoiceUnit(unit.id, {
          sort_order: payload.invoiceSortOrder,
        });
      return unit.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["invoiceUnits"] });
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      setAllAddOpen(false);
      setAllAddUseStock(true);
      setAllAddUseInvoice(true);
      setAllAddInvoiceSort(999);
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
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
      setInvoiceEditing(null);
    },
  });

  const deleteInvoiceUnit = useMutationWithToast({
    mutationFn: (id: number) => api.deleteInvoiceUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceUnits"] });
      queryClient.invalidateQueries({ queryKey: ["unitsWithContext"] });
    },
  });

  const createUnitConversion = useMutation({
    mutationFn: (payload: {
      from_unit: string;
      to_unit: string;
      factor: number;
    }) => api.createUnitConversion(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitConversions"] });
      setConvAddOpen(false);
    },
  });

  const updateUnitConversion = useMutation({
    mutationFn: ({
      id,
      from_unit,
      to_unit,
      factor,
    }: {
      id: number;
      from_unit?: string;
      to_unit?: string;
      factor?: number;
    }) => api.updateUnitConversion(id, { from_unit, to_unit, factor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitConversions"] });
      setConvEditing(null);
    },
  });

  const deleteUnitConversion = useMutationWithToast({
    mutationFn: (id: number) => api.deleteUnitConversion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitConversions"] });
      setDeleteConfirmConv(null);
    },
  });

  const reorderUnits = useMutation({
    mutationFn: ({
      context,
      unitIds,
    }: {
      context: "godown" | "invoice";
      unitIds: number[];
    }) => api.reorderUnits(context, unitIds),
    onSuccess: (_, { context }) => {
      queryClient.invalidateQueries({
        queryKey: [context === "godown" ? "units" : "invoiceUnits"],
      });
    },
  });

  const handleReorder = (context: "godown" | "invoice", unitIds: number[]) => {
    reorderUnits.mutate({ context, unitIds });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Units</h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSection("all")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeSection === "all"
              ? "bg-white border border-b-0 border-gray-200 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <ListBulletIcon className="w-4 h-4" aria-hidden />
          All units
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("types")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeSection === "types"
              ? "bg-white border border-b-0 border-gray-200 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <TagIcon className="w-4 h-4" aria-hidden />
          Unit types
        </button>
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
        <button
          type="button"
          onClick={() => setActiveSection("conversions")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
            activeSection === "conversions"
              ? "bg-white border border-b-0 border-gray-200 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <ArrowsRightLeftIcon className="w-4 h-4" aria-hidden />
          Standard conversions
        </button>
      </div>

      {activeSection === "all" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-4">
            See every unit in one place. Add or remove units from Stock (godown)
            and Invoice sections. Reorder within each section using the Stock /
            Invoice tabs.
          </p>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setAllAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add unit
            </Button>
          </div>
          <DataTable<UnitWithContext>
            columns={[
              { key: "name", label: "Name" },
              {
                key: "symbol",
                label: "Symbol",
                render: (r) => r.symbol?.trim() || "—",
              },
              {
                key: "unit_type_name",
                label: "Type",
                render: (r) => r.unit_type_name?.trim() || "—",
              },
              {
                key: "in_godown",
                label: "Stock (godown)",
                render: (r) =>
                  r.in_godown ? (
                    <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5">
                      No
                    </span>
                  ),
              },
              {
                key: "in_invoice",
                label: "Invoice",
                render: (r) =>
                  r.in_invoice ? (
                    <span className="inline-flex items-center rounded bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5">
                      No
                    </span>
                  ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="secondary"
                      type="button"
                      className="!py-1 !px-2 text-xs"
                      onClick={() =>
                        setStockEditing({
                          id: row.id,
                          name: row.name,
                          symbol: row.symbol,
                          unit_type_id: row.unit_type_id,
                          unit_type_name: row.unit_type_name,
                          created_at: row.created_at,
                        })
                      }
                    >
                      Edit
                    </Button>
                    {row.in_godown ? (
                      <Button
                        variant="secondary"
                        type="button"
                        className="!py-1 !px-2 text-xs"
                        onClick={() =>
                          removeUnitFromContext.mutate({
                            unitId: row.id,
                            context: "godown",
                          })
                        }
                        title="Remove from Stock (godown) list"
                      >
                        <XMarkIcon className="w-3.5 h-3.5 mr-0.5" />
                        Stock
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        type="button"
                        className="!py-1 !px-2 text-xs"
                        onClick={() =>
                          addUnitToContext.mutate({
                            unitId: row.id,
                            context: "godown",
                          })
                        }
                        title="Add to Stock (godown) list"
                      >
                        <PlusIcon className="w-3.5 h-3.5 mr-0.5" />
                        Stock
                      </Button>
                    )}
                    {row.in_invoice ? (
                      <Button
                        variant="secondary"
                        type="button"
                        className="!py-1 !px-2 text-xs"
                        onClick={() =>
                          removeUnitFromContext.mutate({
                            unitId: row.id,
                            context: "invoice",
                          })
                        }
                        title="Remove from Invoice list"
                      >
                        <XMarkIcon className="w-3.5 h-3.5 mr-0.5" />
                        Invoice
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        type="button"
                        className="!py-1 !px-2 text-xs"
                        onClick={() =>
                          addUnitToContext.mutate({
                            unitId: row.id,
                            context: "invoice",
                          })
                        }
                        title="Add to Invoice list"
                      >
                        <PlusIcon className="w-3.5 h-3.5 mr-0.5" />
                        Invoice
                      </Button>
                    )}
                    {!isSeedUnit(row.name) && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmAllUnit(row)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete unit"
                        aria-label="Delete unit"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={unitsWithContext}
            emptyMessage="No units yet. Add one to get started."
          />
        </div>
      )}

      {activeSection === "types" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-4">
            Unit types (e.g. Mass, Volume, Count) help group units and restrict
            conversions to the same type.
          </p>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setTypesAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add type
            </Button>
          </div>
          <DataTable<UnitType>
            columns={[
              { key: "name", label: "Name" },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      type="button"
                      className="!py-1 !px-2 text-xs"
                      onClick={() =>
                        setTypeEditing({
                          id: row.id,
                          name: row.name,
                          created_at: row.created_at,
                        })
                      }
                    >
                      Edit
                    </Button>
                    {!isSeedUnitType(row.name) && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmType(row)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete type"
                        aria-label="Delete type"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={unitTypes}
            emptyMessage="No unit types. Add one (e.g. Mass, Volume, Count)."
          />
        </div>
      )}

      {activeSection === "stock" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setStockAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add unit
            </Button>
          </div>
          <SortableUnitTable
            items={units}
            context="godown"
            onReorder={handleReorder}
            onEdit={(row) => setStockEditing(row)}
            onDelete={(row) => setDeleteConfirmUnit(row)}
            canDelete={(row) => !isSeedUnit(row.name)}
            emptyMessage="No stock units. Add one to get started."
            showType
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
          <SortableUnitTable
            items={invoiceUnits}
            context="invoice"
            onReorder={handleReorder}
            onEdit={(row) => setInvoiceEditing(row as InvoiceUnit)}
            onDelete={(row) => setDeleteConfirmInvoiceUnit(row as InvoiceUnit)}
            canDelete={(row) => !isSeedUnit(row.name)}
            emptyMessage="No invoice units. Add one to get started."
            showType
          />
        </div>
      )}

      {activeSection === "conversions" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setConvAddOpen(true)}>
              <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
              Add conversion
            </Button>
          </div>
          <DataTable<UnitConversion>
            columns={[
              { key: "from_unit", label: "From unit" },
              { key: "to_unit", label: "To unit" },
              {
                key: "factor",
                label: "Factor",
                render: (row) =>
                  `1 ${row.from_unit} = ${row.factor} ${row.to_unit}`,
              },
            ]}
            data={unitConversions}
            onEdit={(row) => setConvEditing(row)}
            onDelete={(row) => setDeleteConfirmConv(row)}
            canDelete={(row) => !isSeedConversion(row.from_unit, row.to_unit)}
            emptyMessage="No standard conversions. Add one to link units (e.g. 1 kg = 1000 g)."
          />
        </div>
      )}

      <ConfirmModal
        open={deleteConfirmUnit != null}
        onClose={() => setDeleteConfirmUnit(null)}
        title="Delete stock unit"
        message="Delete this unit? Products using it will be blocked."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmUnit) deleteUnit.mutate(deleteConfirmUnit.id);
        }}
      />
      <ConfirmModal
        open={deleteConfirmAllUnit != null}
        onClose={() => setDeleteConfirmAllUnit(null)}
        title="Delete unit"
        message="Delete this unit? Products using it will be blocked."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmAllUnit) deleteUnit.mutate(deleteConfirmAllUnit.id);
        }}
      />
      <ConfirmModal
        open={deleteConfirmInvoiceUnit != null}
        onClose={() => setDeleteConfirmInvoiceUnit(null)}
        title="Delete invoice unit"
        message="Delete this invoice unit?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmInvoiceUnit)
            deleteInvoiceUnit.mutate(deleteConfirmInvoiceUnit.id);
        }}
      />
      <ConfirmModal
        open={deleteConfirmConv != null}
        onClose={() => setDeleteConfirmConv(null)}
        title="Delete conversion"
        message="Delete this standard conversion?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmConv)
            deleteUnitConversion.mutate(deleteConfirmConv.id);
        }}
      />
      <ConfirmModal
        open={deleteConfirmType != null}
        onClose={() => setDeleteConfirmType(null)}
        title="Delete unit type"
        message="Delete this type? Units using it must be reassigned first."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmType) deleteUnitType.mutate(deleteConfirmType.id);
        }}
      />

      {/* Unit type – Add */}
      <FormModal
        title="Add unit type"
        open={typesAddOpen}
        onClose={() => setTypesAddOpen(false)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-type-add"
              ) as HTMLFormElement;
              const name = (form?.elements.namedItem("name") as HTMLInputElement)
                ?.value?.trim();
              if (!name) return;
              createUnitType.mutate(name);
            }}
          >
            <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Add
          </Button>
        }
      >
        <form
          id="form-type-add"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem(
              "name"
            ) as HTMLInputElement)?.value?.trim();
            if (name) createUnitType.mutate(name);
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. Mass, Volume, Count"
              required
            />
          </FormField>
        </form>
      </FormModal>

      {/* Unit type – Edit */}
      <FormModal
        title="Edit unit type"
        open={!!typeEditing}
        onClose={() => setTypeEditing(null)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-type-edit"
              ) as HTMLFormElement;
              if (!form || !typeEditing) return;
              const name = (form.elements.namedItem("name") as HTMLInputElement)
                ?.value?.trim();
              if (!name) return;
              updateUnitType.mutate({ id: typeEditing.id, name });
            }}
          >
            <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Save
          </Button>
        }
      >
        {typeEditing && (
          <form
            id="form-type-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const name = (e.currentTarget.elements.namedItem(
                "name"
              ) as HTMLInputElement)?.value?.trim();
              if (name) updateUnitType.mutate({ id: typeEditing.id, name });
            }}
            className="space-y-4"
          >
            <FormField label="Name" required>
              <input
                name="name"
                defaultValue={typeEditing.name}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </FormField>
          </form>
        )}
      </FormModal>

      {/* All units – Add */}
      <FormModal
        title="Add unit"
        open={allAddOpen}
        onClose={() => {
          setAllAddOpen(false);
          setAllAddUseStock(true);
          setAllAddUseInvoice(true);
          setAllAddInvoiceSort(999);
        }}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-all-add-unit"
              ) as HTMLFormElement;
              if (!form) return;
              const els = form.elements as unknown as {
                name: HTMLInputElement;
                symbol: HTMLInputElement;
                unit_type_id?: HTMLSelectElement;
                invoice_sort: HTMLInputElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              if (!allAddUseStock && !allAddUseInvoice) return;
              const typeEl = els.unit_type_id;
              const unitTypeId =
                typeEl?.value === "" || typeEl?.value === undefined
                  ? undefined
                  : Number(typeEl?.value);
              createUnitFromAll.mutate({
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                unit_type_id:
                  unitTypeId !== undefined && Number.isFinite(unitTypeId)
                    ? unitTypeId
                    : undefined,
                useInStock: allAddUseStock,
                useInInvoice: allAddUseInvoice,
                invoiceSortOrder: allAddUseInvoice
                  ? Number(els.invoice_sort?.value || "999")
                  : undefined,
              });
            }}
            disabled={
              createUnitFromAll.isPending ||
              (!allAddUseStock && !allAddUseInvoice)
            }
          >
            <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Add
          </Button>
        }
      >
        <form
          id="form-all-add-unit"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const els = form.elements as unknown as {
              name: HTMLInputElement;
              symbol: HTMLInputElement;
              invoice_sort: HTMLInputElement;
            };
            const name = els.name?.value?.trim();
            if (!name) return;
            if (!allAddUseStock && !allAddUseInvoice) return;
            const typeEl = (els as { unit_type_id?: HTMLSelectElement })
              .unit_type_id;
            const unitTypeId =
              typeEl?.value === "" ? undefined : Number(typeEl?.value);
            createUnitFromAll.mutate({
              name,
              symbol: els.symbol?.value?.trim() || undefined,
              unit_type_id:
                unitTypeId !== undefined && Number.isFinite(unitTypeId)
                  ? unitTypeId
                  : undefined,
              useInStock: allAddUseStock,
              useInInvoice: allAddUseInvoice,
              invoiceSortOrder: allAddUseInvoice
                ? Number(els.invoice_sort?.value || "999")
                : undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. kg, pcs, boxes"
              required
            />
          </FormField>
          <FormField label="Symbol (optional)">
            <input
              name="symbol"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. g, kg; if empty, full name is used"
            />
          </FormField>
          <FormField label="Type (optional)">
            <select
              name="unit_type_id"
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
            >
              <option value="">—</option>
              {unitTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">
              Use in{" "}
              <span className="text-gray-500 font-normal">
                (pick at least one)
              </span>
            </span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allAddUseStock}
                onChange={(e) => setAllAddUseStock(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                Stock (godown) — for product stock and add/reduce stock
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allAddUseInvoice}
                onChange={(e) => setAllAddUseInvoice(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                Invoice — for invoice lines and retail units
              </span>
            </label>
          </div>
          {allAddUseInvoice && (
            <FormField label="Invoice sort order (lower = first in dropdown)">
              <input
                name="invoice_sort"
                type="number"
                value={allAddInvoiceSort}
                onChange={(e) =>
                  setAllAddInvoiceSort(Number(e.target.value) || 999)
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </FormField>
          )}
        </form>
      </FormModal>

      {/* Stock unit – Add */}
      <FormModal
        title="Add stock unit"
        open={stockAddOpen}
        onClose={() => setStockAddOpen(false)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-stock-add"
              ) as HTMLFormElement;
              if (!form) return;
              const els = form.elements as unknown as {
                name: HTMLInputElement;
                symbol: HTMLInputElement;
                unit_type_id: HTMLSelectElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              const typeVal =
                els.unit_type_id?.value === ""
                  ? undefined
                  : Number(els.unit_type_id?.value);
              createUnit.mutate({
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                unit_type_id:
                  typeVal !== undefined && Number.isFinite(typeVal)
                    ? typeVal
                    : undefined,
              });
            }}
          >
            <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Add
          </Button>
        }
      >
        <form
          id="form-stock-add"
          onSubmit={(e) => {
            e.preventDefault();
            const els = (e.target as HTMLFormElement).elements as unknown as {
              name: HTMLInputElement;
              symbol: HTMLInputElement;
              unit_type_id: HTMLSelectElement;
            };
            const name = els.name?.value?.trim();
            if (!name) return;
            const typeVal =
              els.unit_type_id?.value === ""
                ? undefined
                : Number(els.unit_type_id?.value);
            createUnit.mutate({
              name,
              symbol: els.symbol?.value?.trim() || undefined,
              unit_type_id:
                typeVal !== undefined && Number.isFinite(typeVal)
                  ? typeVal
                  : undefined,
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
          <FormField label="Type (optional)">
            <select
              name="unit_type_id"
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
            >
              <option value="">—</option>
              {unitTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormField>
        </form>
      </FormModal>

      {/* Stock unit – Edit */}
      <FormModal
        title="Edit stock unit"
        open={!!stockEditing}
        onClose={() => setStockEditing(null)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-stock-edit"
              ) as HTMLFormElement;
              if (!form || !stockEditing) return;
              const els = form.elements as unknown as {
                name: HTMLInputElement;
                symbol: HTMLInputElement;
                unit_type_id: HTMLSelectElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              const typeVal =
                els.unit_type_id?.value === ""
                  ? null
                  : Number(els.unit_type_id?.value);
              updateUnit.mutate({
                id: stockEditing.id,
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                unit_type_id:
                  typeVal !== undefined && Number.isFinite(typeVal)
                    ? typeVal
                    : null,
              });
            }}
          >
            <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Save
          </Button>
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
                unit_type_id: HTMLSelectElement;
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              const typeVal =
                els.unit_type_id?.value === ""
                  ? null
                  : Number(els.unit_type_id?.value);
              updateUnit.mutate({
                id: stockEditing.id,
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                unit_type_id:
                  typeVal !== undefined && Number.isFinite(typeVal)
                    ? typeVal
                    : null,
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
            <FormField label="Type (optional)">
              <select
                name="unit_type_id"
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                defaultValue={stockEditing.unit_type_id ?? ""}
              >
                <option value="">—</option>
                {unitTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
                sort_order: Number.parseInt(els.sort_order?.value || "999", 10),
              });
            }}
          >
            <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Add
          </Button>
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
                sort_order: Number.parseInt(els.sort_order?.value || "999", 10),
              });
            }}
          >
            <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Save
          </Button>
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

      {/* Standard conversion – Add */}
      <FormModal
        title="Add conversion"
        open={convAddOpen}
        onClose={() => setConvAddOpen(false)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-conv-add"
              ) as HTMLFormElement;
              if (!form) return;
              const els = form.elements as unknown as {
                from_unit: HTMLSelectElement;
                to_unit: HTMLSelectElement;
                factor: HTMLInputElement;
              };
              const from_unit = els.from_unit?.value?.trim();
              const to_unit = els.to_unit?.value?.trim();
              const factor = Number(els.factor?.value);
              if (!from_unit || !to_unit) return;
              if (!Number.isFinite(factor) || factor <= 0) return;
              createUnitConversion.mutate({ from_unit, to_unit, factor });
            }}
          >
            <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Add
          </Button>
        }
      >
        <form
          id="form-conv-add"
          onSubmit={(e) => {
            e.preventDefault();
            const els = (e.target as HTMLFormElement).elements as unknown as {
              from_unit: HTMLSelectElement;
              to_unit: HTMLSelectElement;
              factor: HTMLInputElement;
            };
            const from_unit = els.from_unit?.value?.trim();
            const to_unit = els.to_unit?.value?.trim();
            const factor = Number(els.factor?.value);
            if (
              !from_unit ||
              !to_unit ||
              !Number.isFinite(factor) ||
              factor <= 0
            )
              return;
            createUnitConversion.mutate({ from_unit, to_unit, factor });
          }}
          className="space-y-4"
        >
          <FormField label="From unit" required>
            <select
              name="from_unit"
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">Select unit</option>
              {allUnitNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="To unit" required>
            <select
              name="to_unit"
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">Select unit</option>
              {allUnitNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Factor (1 from_unit = factor × to_unit)" required>
            <input
              name="factor"
              type="number"
              step="any"
              min="0.0000000001"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. 1000 for kg → g"
              required
            />
          </FormField>
        </form>
      </FormModal>

      {/* Standard conversion – Edit */}
      <FormModal
        title="Edit conversion"
        open={!!convEditing}
        onClose={() => setConvEditing(null)}
        footer={
          <Button
            onClick={() => {
              const form = document.getElementById(
                "form-conv-edit"
              ) as HTMLFormElement;
              if (!form || !convEditing) return;
              const els = form.elements as unknown as {
                from_unit: HTMLSelectElement;
                to_unit: HTMLSelectElement;
                factor: HTMLInputElement;
              };
              const from_unit = els.from_unit?.value?.trim();
              const to_unit = els.to_unit?.value?.trim();
              const factor = Number(els.factor?.value);
              if (
                !from_unit ||
                !to_unit ||
                !Number.isFinite(factor) ||
                factor <= 0
              )
                return;
              updateUnitConversion.mutate({
                id: convEditing.id,
                from_unit,
                to_unit,
                factor,
              });
            }}
          >
            <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
            Save
          </Button>
        }
      >
        {convEditing && (
          <form
            id="form-conv-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const els = (e.target as HTMLFormElement).elements as unknown as {
                from_unit: HTMLSelectElement;
                to_unit: HTMLSelectElement;
                factor: HTMLInputElement;
              };
              const from_unit = els.from_unit?.value?.trim();
              const to_unit = els.to_unit?.value?.trim();
              const factor = Number(els.factor?.value);
              if (
                !from_unit ||
                !to_unit ||
                !Number.isFinite(factor) ||
                factor <= 0
              )
                return;
              updateUnitConversion.mutate({
                id: convEditing.id,
                from_unit,
                to_unit,
                factor,
              });
            }}
            className="space-y-4"
          >
            <FormField label="From unit" required>
              <select
                name="from_unit"
                defaultValue={convEditing.from_unit}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                {allUnitNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="To unit" required>
              <select
                name="to_unit"
                defaultValue={convEditing.to_unit}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                {allUnitNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Factor (1 from_unit = factor × to_unit)" required>
              <input
                name="factor"
                type="number"
                step="any"
                min="0.0000000001"
                defaultValue={convEditing.factor}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </FormField>
          </form>
        )}
      </FormModal>
    </div>
  );
}
