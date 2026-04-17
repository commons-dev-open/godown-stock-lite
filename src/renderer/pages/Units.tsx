import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { getElectron } from "../api/client";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type { Unit, UnitType, UnitConversion } from "../../shared/types";
import {
  isSeedConversion,
  isSeedUnit,
  isSeedUnitType,
} from "../../shared/seedConstants";
import {
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  UnitsAsyncPanel,
  UnitsHero,
  UnitsSectionPanel,
  UnitsSegmentedTabs,
  type UnitsTabId,
} from "../components/units-page";

interface TabSectionMeta {
  title: string;
  description: string;
  loaderColumns: number;
}

const TAB_SECTION_META: Record<UnitsTabId, TabSectionMeta> = {
  all: {
    title: "All units",
    description:
      "Every product and stock movement references a unit from this list.",
    loaderColumns: 4,
  },
  types: {
    title: "Unit types",
    description:
      "Unit types (e.g. Mass, Volume, Count) help group units and restrict conversions to the same type.",
    loaderColumns: 2,
  },
  conversions: {
    title: "Standard conversions",
    description:
      "Link units with a numeric factor so the app can convert stock and quantities consistently.",
    loaderColumns: 3,
  },
};

interface TabEmptyCopy {
  title: string;
  description: string;
  actionLabel: string;
}

const TAB_EMPTY_COPY: Record<UnitsTabId, TabEmptyCopy> = {
  all: {
    title: "No units yet",
    description:
      "Create units you sell or stock in (kg, pcs, boxes). You can attach an optional symbol and type.",
    actionLabel: "Add unit",
  },
  types: {
    title: "No unit types",
    description:
      "Add types such as Mass, Volume, or Count so conversions stay within compatible units.",
    actionLabel: "Add type",
  },
  conversions: {
    title: "No standard conversions",
    description:
      "Add a row for each pair you need (for example 1 kg = 1000 g) so quantities convert automatically.",
    actionLabel: "Add conversion",
  },
};

const PRIMARY_LABELS: Record<UnitsTabId, string> = {
  all: "Add unit",
  types: "Add type",
  conversions: "Add conversion",
};

export default function Units() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
  });
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const [activeSection, setActiveSection] = useState<UnitsTabId>("all");
  const [tabTablePages, setTabTablePages] = useState<
    Record<UnitsTabId, number>
  >({
    all: 1,
    types: 1,
    conversions: 1,
  });
  const [allAddOpen, setAllAddOpen] = useState(false);
  const [stockEditing, setStockEditing] = useState<Unit | null>(null);
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<Unit | null>(null);
  const [convAddOpen, setConvAddOpen] = useState(false);
  const [convEditing, setConvEditing] = useState<UnitConversion | null>(null);
  const [deleteConfirmConv, setDeleteConfirmConv] =
    useState<UnitConversion | null>(null);
  const [typesAddOpen, setTypesAddOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<UnitType | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<UnitType | null>(
    null
  );

  const unitTypesQuery = useQuery({
    queryKey: ["unitTypes"],
    queryFn: () => api.getUnitTypes() as Promise<UnitType[]>,
    staleTime: 30_000,
  });

  const unitsQuery = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
    staleTime: 30_000,
  });

  const unitConversionsQuery = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions() as Promise<UnitConversion[]>,
    staleTime: 30_000,
  });

  const unitTypes = unitTypesQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const unitConversions = unitConversionsQuery.data ?? [];

  const allUnitNames = useMemo(
    () => units.map((u) => u.name).sort((a, b) => a.localeCompare(b)),
    [units]
  );

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
      setAllAddOpen(false);
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
      setStockEditing(null);
    },
  });

  const deleteUnit = useMutationWithToast({
    mutationFn: (id: number) => api.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setDeleteConfirmUnit(null);
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

  const openPrimaryAction = useCallback(() => {
    if (activeSection === "all") {
      setAllAddOpen(true);
      return;
    }
    if (activeSection === "types") {
      setTypesAddOpen(true);
      return;
    }
    setConvAddOpen(true);
  }, [activeSection]);

  const primaryActionLabel = PRIMARY_LABELS[activeSection];

  const activeListQuery = useMemo(() => {
    if (activeSection === "all") {
      return unitsQuery;
    }
    if (activeSection === "types") {
      return unitTypesQuery;
    }
    return unitConversionsQuery;
  }, [activeSection, unitsQuery, unitTypesQuery, unitConversionsQuery]);

  const {
    title: sectionTitle,
    description: sectionDescription,
    loaderColumns,
  } = TAB_SECTION_META[activeSection];

  const tabCountBadge =
    activeSection === "all"
      ? units.length
      : activeSection === "types"
        ? unitTypes.length
        : unitConversions.length;

  const countBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {tabCountBadge}
    </span>
  );

  let tableContent: ReactNode;
  if (activeSection === "all") {
    tableContent = (
      <DataTable<Unit>
        scrollMaxHeight={`calc(100vh - 19.8rem)`}
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
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  type="button"
                  className="!py-1 !px-2 text-xs"
                  onClick={() => setStockEditing(row)}
                >
                  Edit
                </Button>
                {!isSeedUnit(row.name) && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmUnit(row)}
                    className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded transition-colors"
                    title="Delete unit"
                    aria-label="Delete unit"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={units}
        emptyMessage="No units yet."
        pagination={{
          type: "client",
          page: tabTablePages.all,
          onPageChange: (page) => {
            setTabTablePages((prev) => ({ ...prev, all: page }));
          },
        }}
      />
    );
  } else if (activeSection === "types") {
    tableContent = (
      <DataTable<UnitType>
        scrollMaxHeight={`calc(100vh - 19.8rem)`}
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
                    className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded transition-colors"
                    title="Delete type"
                    aria-label="Delete type"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={unitTypes}
        emptyMessage="No unit types."
        pagination={{
          type: "client",
          page: tabTablePages.types,
          onPageChange: (page) => {
            setTabTablePages((prev) => ({ ...prev, types: page }));
          },
        }}
      />
    );
  } else {
    tableContent = (
      <DataTable<UnitConversion>
        scrollMaxHeight={`calc(100vh - 19.8rem)`}
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
        emptyMessage="No standard conversions."
        pagination={{
          type: "client",
          page: tabTablePages.conversions,
          onPageChange: (page) => {
            setTabTablePages((prev) => ({ ...prev, conversions: page }));
          },
        }}
      />
    );
  }

  const emptyCopy = TAB_EMPTY_COPY[activeSection];

  const isListEmpty =
    activeListQuery.isSuccess &&
    Array.isArray(activeListQuery.data) &&
    activeListQuery.data.length === 0;

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <UnitsHero
        abbreviationStyle={abbreviationStyle}
        unitsCount={units.length}
        typesCount={unitTypes.length}
        conversionsCount={unitConversions.length}
        primaryLabel={primaryActionLabel}
        onPrimary={openPrimaryAction}
      />

      <UnitsSegmentedTabs active={activeSection} onChange={setActiveSection} />

      <DashboardSectionBoundary
        sectionTitle={sectionTitle}
        containerClassName="dashboard-panel"
        resetKeys={[
          activeSection,
          units.length,
          unitTypes.length,
          unitConversions.length,
          activeListQuery.isLoading,
          activeListQuery.isError,
        ]}
      >
        <UnitsSectionPanel
          title={sectionTitle}
          description={sectionDescription}
          badge={countBadge}
        >
          <UnitsAsyncPanel
            isLoading={activeListQuery.isLoading}
            isError={activeListQuery.isError}
            onRetry={() => {
              void activeListQuery.refetch();
            }}
            isEmpty={isListEmpty}
            emptyTitle={emptyCopy.title}
            emptyDescription={emptyCopy.description}
            emptyActionLabel={emptyCopy.actionLabel}
            onEmptyAction={openPrimaryAction}
            loaderColumns={loaderColumns}
          >
            {tableContent}
          </UnitsAsyncPanel>
        </UnitsSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmUnit != null}
        onClose={() => setDeleteConfirmUnit(null)}
        title="Delete unit"
        message="Delete this unit? Products using it will be blocked."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmUnit) deleteUnit.mutate(deleteConfirmUnit.id);
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

      {/* Unit type - Add */}
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
              const name = (
                form?.elements.namedItem("name") as HTMLInputElement
              )?.value?.trim();
              if (!name) return;
              createUnitType.mutate(name);
            }}
          >
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <form
          id="form-type-add"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (
              e.currentTarget.elements.namedItem("name") as HTMLInputElement
            )?.value?.trim();
            if (name) createUnitType.mutate(name);
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              placeholder="e.g. Mass, Volume, Count"
              required
            />
          </FormField>
        </form>
      </FormModal>

      {/* Unit type - Edit */}
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
              const name = (
                form.elements.namedItem("name") as HTMLInputElement
              )?.value?.trim();
              if (!name) return;
              updateUnitType.mutate({ id: typeEditing.id, name });
            }}
          >
            <Check size={20} className="mr-1.5" aria-hidden="true" />
            Save
          </Button>
        }
      >
        {typeEditing && (
          <form
            id="form-type-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const name = (
                e.currentTarget.elements.namedItem("name") as HTMLInputElement
              )?.value?.trim();
              if (name) updateUnitType.mutate({ id: typeEditing.id, name });
            }}
            className="space-y-4"
          >
            <FormField label="Name" required>
              <input
                name="name"
                defaultValue={typeEditing.name}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                required
              />
            </FormField>
          </form>
        )}
      </FormModal>

      {/* Add unit */}
      <FormModal
        title="Add unit"
        open={allAddOpen}
        onClose={() => setAllAddOpen(false)}
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
              };
              const name = els.name?.value?.trim();
              if (!name) return;
              const typeEl = els.unit_type_id;
              const unitTypeId =
                typeEl?.value === "" || typeEl?.value === undefined
                  ? undefined
                  : Number(typeEl?.value);
              createUnit.mutate({
                name,
                symbol: els.symbol?.value?.trim() || undefined,
                unit_type_id:
                  unitTypeId !== undefined && Number.isFinite(unitTypeId)
                    ? unitTypeId
                    : undefined,
              });
            }}
            disabled={createUnit.isPending}
          >
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
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
            };
            const name = els.name?.value?.trim();
            if (!name) return;
            const typeEl = (els as { unit_type_id?: HTMLSelectElement })
              .unit_type_id;
            const unitTypeId =
              typeEl?.value === "" ? undefined : Number(typeEl?.value);
            createUnit.mutate({
              name,
              symbol: els.symbol?.value?.trim() || undefined,
              unit_type_id:
                unitTypeId !== undefined && Number.isFinite(unitTypeId)
                  ? unitTypeId
                  : undefined,
            });
          }}
          className="space-y-4"
        >
          <FormField label="Name" required>
            <input
              name="name"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              placeholder="e.g. kg, pcs, boxes"
              required
            />
          </FormField>
          <FormField label="Symbol (optional)">
            <input
              name="symbol"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              placeholder="e.g. g, kg; if empty, full name is used"
            />
          </FormField>
          <FormField label="Type (optional)">
            <select
              name="unit_type_id"
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2 bg-[var(--color-bg-surface)]"
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

      {/* Edit unit */}
      <FormModal
        title="Edit unit"
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
            <Check size={20} className="mr-1.5" aria-hidden="true" />
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
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                required
              />
            </FormField>
            <FormField label="Symbol (optional)">
              <input
                name="symbol"
                defaultValue={stockEditing.symbol ?? ""}
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                placeholder="e.g. g for gram"
              />
            </FormField>
            <FormField label="Type (optional)">
              <select
                name="unit_type_id"
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2 bg-[var(--color-bg-surface)]"
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

      {/* Standard conversion - Add */}
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
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
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
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
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
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
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
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              placeholder="e.g. 1000 for kg → g"
              required
            />
          </FormField>
        </form>
      </FormModal>

      {/* Standard conversion - Edit */}
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
            <Check size={20} className="mr-1.5" aria-hidden="true" />
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
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
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
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
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
                className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                required
              />
            </FormField>
          </form>
        )}
      </FormModal>
    </div>
  );
}
