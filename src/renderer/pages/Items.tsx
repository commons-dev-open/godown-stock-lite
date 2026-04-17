import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getElectron } from "../api/client";
import { useAuth } from "../context/AuthContext";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import FormField from "../components/FormField";
import Button from "../components/Button";
import SearchFilterBar from "../components/SearchFilterBar";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  ItemsAsyncPanel,
  ItemsHero,
  ItemsSectionPanel,
} from "../components/items-page";
import type { LowStockItem } from "../components/home-dashboard/types";
import { PAGE_SIZE } from "../../shared/constants";
import toast from "react-hot-toast";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import { exportItemsToCsv, getPrintTableBody } from "../lib/exportItems";
import { getAppDisplayName } from "../lib/displayName";
import { formatDateForFile } from "../lib/exportUtils";
import {
  Download,
  ArrowDown,
  ArrowUp,
  Check,
  FileDown,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { computeProductUnits } from "../../shared/computeProductUnits";
import type {
  Item,
  ItemOtherUnit,
  Unit,
  UnitConversion,
} from "../../shared/types";
import {
  formatDecimal,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";
import {
  useElectronHtmlPrintJob,
  type HtmlPrintJobBase,
} from "../hooks/useElectronHtmlPrintJob";

type ItemWithUnits = Item & {
  other_units?: { id?: number; unit: string; sort_order: number }[];
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

const GST_SLABS = [0, 5, 12, 18, 28] as const;

type ConversionRow = { to_unit: string; factor: number };

export default function Items() {
  const { t } = useTranslation("items");
  const queryClient = useQueryClient();
  const api = getElectron();
  const { authState } = useAuth();
  const currentUser = authState.status === "unlocked" ? authState.user : null;
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
  const [addStockUnit, setAddStockUnit] = useState<string>("");
  const [addConversions, setAddConversions] = useState<ConversionRow[]>([
    { to_unit: "", factor: 0 },
  ]);
  const [editRetailPrimary, setEditRetailPrimary] = useState<string>("");
  const [editOtherUnits, setEditOtherUnits] = useState<ItemOtherUnit[]>([]);
  const [editStockUnit, setEditStockUnit] = useState<string>("");
  const [editConversions, setEditConversions] = useState<ConversionRow[]>([
    { to_unit: "", factor: 0 },
  ]);
  const [addStockUnitModal, setAddStockUnitModal] = useState<string>("");
  const [reduceStockUnitModal, setReduceStockUnitModal] = useState<string>("");
  const [addSellingPrice, setAddSellingPrice] = useState<string>("");
  const [addSellingPriceUnit, setAddSellingPriceUnit] = useState<string>("");
  const [addGstRate, setAddGstRate] = useState<number>(0);
  const [addHsnCode, setAddHsnCode] = useState<string>("");
  const [editSellingPrice, setEditSellingPrice] = useState<string>("");
  const [editSellingPriceUnit, setEditSellingPriceUnit] = useState<string>("");
  const [editGstRate, setEditGstRate] = useState<number>(0);
  const [editHsnCode, setEditHsnCode] = useState<string>("");

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (addProductOpen) setAddStockUnit(addUnitSelect);
  }, [addProductOpen, addUnitSelect]);
  useEffect(() => {
    if (addProductOpen && addGstRate === 0 && settings?.gst_default_rate) {
      setAddGstRate(Number(settings.gst_default_rate) || 0);
    }
  }, [addProductOpen, addGstRate, settings?.gst_default_rate]);
  useEffect(() => {
    if (addStockOpen && addStockItem) setAddStockUnitModal(addStockItem.unit);
  }, [addStockOpen, addStockItem]);
  useEffect(() => {
    if (reduceStockOpen && reduceStockItem)
      setReduceStockUnitModal(reduceStockItem.unit);
  }, [reduceStockOpen, reduceStockItem]);
  const [exportOpen, setExportOpen] = useState(false);
  type ItemsPrintJob = null | (HtmlPrintJobBase & {
    columns: string[];
    rows: string[][];
  });
  const [printJob, setPrintJob] = useState<ItemsPrintJob>(null);
  const [importUnitsPopupOpen, setImportUnitsPopupOpen] = useState(false);
  const [importUnitsTarget, setImportUnitsTarget] = useState<
    "add" | "edit" | null
  >(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);
  const [importProductId, setImportProductId] = useState<string>("");

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

  const appName = getAppDisplayName(settings);
  const gstEnabled = settings.gst_enabled === "true";
  const hsnEnabled = settings.hsn_enabled !== "false";

  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );

  const itemsExportColumnLabels = useMemo(
    () => [
      t("export.columns.id"),
      t("columns.name"),
      t("columns.code"),
      t("columns.unit"),
      t("columns.currentStock"),
      t("columns.reorderLevel"),
      t("export.columns.createdAt"),
      t("export.columns.updatedAt"),
    ],
    [t]
  );

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits() as Promise<Unit[]>,
    staleTime: 30_000,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions() as Promise<UnitConversion[]>,
    staleTime: 30_000,
  });

  const findUnitMeta = (unitName: string) =>
    units.find((x) => x.name === unitName);

  const unitDisplay = (unitName: string) => {
    const u = findUnitMeta(unitName);
    if (!u) return unitName;
    const symbol = u.symbol?.trim();
    if (symbol) {
      return `${u.name} (${symbol})`;
    }
    return u.name;
  };

  const itemsListQuery = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems() as Promise<Item[]>,
    staleTime: 30_000,
  });
  const items = itemsListQuery.data ?? [];

  const lowStockQuery = useQuery({
    queryKey: ["lowStockItems"],
    queryFn: async () => (await api.getLowStockItems()) as LowStockItem[],
    staleTime: 2 * 60_000,
  });
  const lowStockItems = lowStockQuery.data ?? [];

  const itemsPageQuery = useQuery({
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
    staleTime: 15_000,
  });
  const pageResult = itemsPageQuery.data;
  const itemsPage = pageResult?.data ?? [];
  const totalItems = pageResult?.total ?? 0;
  const itemsPageLoading = itemsPageQuery.isLoading;
  const itemsPageError = itemsPageQuery.isError;

  const addAllowedStockUnits = computeProductUnits({
    primaryUnit: addUnitSelect || null,
    retailPrimaryUnit: addRetailPrimary || null,
    otherUnits: addOtherUnits,
    itemConversions: addConversions,
    globalConversions: unitConversions,
    sortDirection: "desc",
    pinUnit: addUnitSelect || null,
  });

  const editAllowedStockUnits =
    editing != null
      ? computeProductUnits({
          primaryUnit: (editUnitSelect || editing.unit) ?? null,
          retailPrimaryUnit: editRetailPrimary || null,
          otherUnits: editOtherUnits,
          itemConversions: editConversions,
          globalConversions: unitConversions,
          sortDirection: "desc",
          pinUnit: (editUnitSelect || editing.unit) ?? null,
        })
      : [];

  const createItem = useMutation({
    mutationFn: async (payload: {
      name: string;
      code?: string;
      unit: string;
      retail_primary_unit?: string | null;
      other_units?: ItemOtherUnit[];
      current_stock?: number;
      current_stock_value?: number;
      current_stock_unit?: string;
      conversions?: { to_unit: string; factor: number }[];
      reorder_level?: number;
      selling_price?: number | null;
      selling_price_unit?: string | null;
      gst_rate?: number;
      hsn_code?: string | null;
    }) => {
      return api.createItem({
        name: payload.name,
        code: payload.code,
        unit: payload.unit,
        retail_primary_unit: payload.retail_primary_unit ?? null,
        other_units: payload.other_units,
        current_stock: payload.current_stock,
        current_stock_value: payload.current_stock_value,
        current_stock_unit: payload.current_stock_unit,
        conversions: payload.conversions,
        reorder_level: payload.reorder_level,
        selling_price: payload.selling_price ?? null,
        selling_price_unit: payload.selling_price_unit ?? null,
        gst_rate: payload.gst_rate ?? 0,
        hsn_code: payload.hsn_code ?? null,
        _userId: currentUser?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setAddProductOpen(false);
    },
  });

  const updateItem = useMutation({
    mutationFn: async (payload: {
      id: number;
      item: Parameters<typeof api.updateItem>[1];
      other_units?: ItemOtherUnit[];
    }) => {
      return api.updateItem(payload.id, {
        ...payload.item,
        other_units: payload.other_units,
        _userId: currentUser?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setEditing(null);
    },
  });

  const deleteItem = useMutationWithToast({
    mutationFn: (id: number) => api.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
    },
  });

  const addStock = useMutationWithToast({
    mutationFn: ({
      id,
      quantity,
      unit,
    }: {
      id: number;
      quantity: number;
      unit?: string;
    }) => api.addStock(id, unit ? { quantity, unit } : quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setAddStockOpen(false);
      setAddStockItem(null);
    },
  });

  const reduceStock = useMutationWithToast({
    mutationFn: ({
      id,
      quantity,
      unit,
    }: {
      id: number;
      quantity: number;
      unit?: string;
    }) => api.reduceStock(id, unit ? { quantity, unit } : quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["itemsPage"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
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
      toast.error(t("export.noData"));
      return;
    }
    exportItemsToCsv(allItems, itemsExportColumnLabels);
    toast.success(t("export.csvSuccess"));
  }

  async function handleExportPdf() {
    setExportOpen(false);
    const allItems = await getExportData();
    if (allItems.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const body = getPrintTableBody(allItems, itemsExportColumnLabels);
    setPrintJob({
      mode: "pdf",
      documentTitle: `${t("print.reportTitle")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `products-stock-${formatDateForFile(new Date())}.pdf`,
      ...body,
    });
  }

  async function handleExportPrint() {
    setExportOpen(false);
    const allItems = await getExportData();
    if (allItems.length === 0) {
      toast.error(t("export.noData"));
      return;
    }
    const body = getPrintTableBody(allItems, itemsExportColumnLabels);
    setPrintJob({
      mode: "browser",
      documentTitle: `${t("print.reportTitle")}_${formatDateForFile(new Date())}`,
      defaultPdfPath: `products-stock-${formatDateForFile(new Date())}.pdf`,
      ...body,
    });
  }

  useElectronHtmlPrintJob(printJob, setPrintJob, api, {
    onPdfFinished: ({ saved }) => {
      if (saved) {
        toast.success(t("export.pdfSuccess"));
      }
    },
    onPdfError: () => {
      toast.error(t("export.pdfFailed"));
    },
  });

  const loaderColumns = useMemo(() => {
    let n = 5;
    if (gstEnabled) {
      n += 2;
      if (hsnEnabled) {
        n += 1;
      }
    }
    return n;
  }, [gstEnabled, hsnEnabled]);

  const clearSearchAndPage = useCallback(() => {
    setSearch("");
    setPage(1);
  }, []);

  const noMatchesMeta = useMemo(
    () => ({
      title: t("empty.noMatchesTitle"),
      description: t("empty.noMatchesDescription"),
      actionLabel: t("actions.clearSearch"),
    }),
    [t]
  );

  const emptyCatalogMeta = useMemo(
    () => ({
      title: t("empty.noProductsTitle"),
      description: t("empty.noProductsDescription"),
      actionLabel: t("actions.addProduct"),
    }),
    [t]
  );

  const awaitingCatalogForEmptyState =
    itemsPageQuery.isSuccess &&
    itemsPage.length === 0 &&
    !search.trim() &&
    itemsListQuery.isLoading;

  const showTableSkeleton = itemsPageLoading || awaitingCatalogForEmptyState;

  const isListEmpty =
    itemsPageQuery.isSuccess &&
    itemsListQuery.isSuccess &&
    itemsPage.length === 0;

  const emptyIsNoMatches =
    isListEmpty && search.trim().length > 0 && items.length > 0;

  const emptyTitle = emptyIsNoMatches
    ? noMatchesMeta.title
    : emptyCatalogMeta.title;
  const emptyDescription = emptyIsNoMatches
    ? noMatchesMeta.description
    : emptyCatalogMeta.description;
  const emptyActionLabel = emptyIsNoMatches
    ? noMatchesMeta.actionLabel
    : emptyCatalogMeta.actionLabel;
  const onEmptyAction = emptyIsNoMatches
    ? clearSearchAndPage
    : () => setAddProductOpen(true);

  const countBadge = (
    <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">
      {totalItems}
    </span>
  );

  const heroToolbar = (
    <>
      <div ref={exportRefs.setReference} {...getExportRefProps()}>
        <Button variant="secondary" type="button" className="w-full sm:w-auto">
          <Download size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
          {t("actions.export")}
        </Button>
      </div>
      <FloatingPortal>
        {exportOpen && (
          <div
            ref={exportRefs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
            style={exportFloatingStyles}
            {...getExportFloatingProps()}
            className="z-50 min-w-[160px] rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-1 shadow-lg"
          >
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={handleExportCsv}
            >
              <FileDown size={16} className="shrink-0" />
              {t("export.asCsv")}
            </button>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={handleExportPdf}
            >
              <FileDown size={16} className="shrink-0" />
              {t("export.asPdf")}
            </button>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
              onClick={handleExportPrint}
            >
              <Printer size={16} className="shrink-0" />
              {t("actions.print")}
            </button>
          </div>
        )}
      </FloatingPortal>
      <Button
        variant="secondary"
        type="button"
        className="w-full sm:w-auto"
        onClick={() => setAddStockOpen(true)}
      >
        <ArrowUp size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
        {t("actions.addStock")}
      </Button>
      <Button
        variant="secondary"
        type="button"
        className="w-full sm:w-auto"
        onClick={() => setReduceStockOpen(true)}
      >
        <ArrowDown size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
        {t("actions.reduceStock")}
      </Button>
    </>
  );

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <ItemsHero
        abbreviationStyle={abbreviationStyle}
        catalogCount={items.length}
        lowStockCount={lowStockItems.length}
        unitsCount={units.length}
        primaryLabel={t("actions.addProduct")}
        onPrimary={() => setAddProductOpen(true)}
        toolbar={heroToolbar}
      />

      <DashboardSectionBoundary
        sectionTitle={t("catalog.sectionTitle")}
        containerClassName="dashboard-panel"
        resetKeys={[
          search,
          page,
          itemsPageLoading,
          itemsPageError,
          itemsPage.length,
          gstEnabled,
          hsnEnabled,
        ]}
      >
        <ItemsSectionPanel
          title={t("catalog.sectionTitle")}
          description={t("catalog.description")}
          badge={countBadge}
        >
          <div className="mb-4">
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
              placeholder={t("search.placeholder")}
            />
          </div>

          <ItemsAsyncPanel
            isLoading={showTableSkeleton}
            isError={itemsPageError}
            onRetry={() => {
              void itemsListQuery.refetch();
              void itemsPageQuery.refetch();
            }}
            isEmpty={isListEmpty}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyActionLabel={emptyActionLabel}
            onEmptyAction={onEmptyAction}
            loaderColumns={loaderColumns}
          >
            <DataTable<Item>
              scrollMaxHeight={`calc(100vh - 20.5rem)`}
              columns={[
                { key: "name", label: t("columns.name") },
                { key: "code", label: t("columns.code") },
                {
                  key: "current_stock",
                  label: t("columns.currentStock"),
                  align: "right",
                  render: (r) => formatDecimal(r.current_stock),
                },
                {
                  key: "unit",
                  label: t("columns.unit"),
                  render: (r) => unitDisplay(r.unit),
                },
                ...(gstEnabled
                  ? [
                      {
                        key: "selling_price" as const,
                        label: t("columns.sellingPrice"),
                        align: "right" as const,
                        render: (r: Item) =>
                          r.selling_price != null && r.selling_price > 0
                            ? `₹${formatDecimal(r.selling_price)}/${r.selling_price_unit ?? r.unit}`
                            : "",
                      },
                      {
                        key: "gst_rate" as const,
                        label: t("columns.gst"),
                        align: "right" as const,
                        render: (r: Item) =>
                          (r.gst_rate ?? 0) > 0 ? `${r.gst_rate}%` : "",
                      },
                      ...(hsnEnabled
                        ? [
                            {
                              key: "hsn_code" as const,
                              label: t("columns.hsn"),
                              render: (r: Item) => r.hsn_code ?? "",
                            },
                          ]
                        : []),
                    ]
                  : []),
                {
                  key: "reorder_level",
                  label: t("columns.reorderLevel"),
                  align: "right",
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
                setEditSellingPrice(
                  full.selling_price != null ? String(full.selling_price) : ""
                );
                setEditSellingPriceUnit(full.selling_price_unit ?? "");
                setEditGstRate(full.gst_rate ?? 0);
                setEditHsnCode(full.hsn_code ?? "");
                setEditStockUnit(full.unit);
                setEditConversions(
                  (full as ItemWithUnits).item_unit_conversions?.length
                    ? (full as ItemWithUnits).item_unit_conversions!
                    : full.reference_unit
                      ? [
                          {
                            to_unit: full.reference_unit,
                            factor: full.quantity_per_primary ?? 0,
                          },
                        ]
                      : [{ to_unit: "", factor: 0 }]
                );
                setEditOtherUnits(
                  full.other_units?.map((o) => ({
                    unit: o.unit,
                    sort_order: o.sort_order ?? 0,
                  })) ?? []
                );
              }}
              onDelete={(row) => setDeleteConfirmItem(row)}
              emptyMessage={t("empty.tableMessage")}
              pagination={{
                type: "controlled",
                page,
                total: totalItems,
                onPageChange: setPage,
                pageSize: PAGE_SIZE,
              }}
            />
          </ItemsAsyncPanel>
        </ItemsSectionPanel>
      </DashboardSectionBoundary>

      <ConfirmModal
        open={deleteConfirmItem != null}
        onClose={() => setDeleteConfirmItem(null)}
        title={t("confirmDelete.title")}
        message={t("confirmDelete.stockMustBeZero")}
        confirmLabel={t("actions.delete")}
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteConfirmItem) deleteItem.mutate(deleteConfirmItem.id);
        }}
      />

      <FormModal
        title={t("modals.addProduct.title")}
        open={addProductOpen}
        onClose={() => {
          setAddProductOpen(false);
          setAddUnitSelect("");
          setAddRetailPrimary("");
          setAddOtherUnits([]);
          setAddConversions([{ to_unit: "", factor: 0 }]);
          setAddSellingPrice("");
          setAddSellingPriceUnit("");
          setAddGstRate(Number(settings?.gst_default_rate) || 0);
          setAddHsnCode("");
          setImportUnitsPopupOpen(false);
          setImportUnitsTarget(null);
          setImportProductId("");
        }}
        maxWidth="max-w-3xl"
        footer={
          <Button variant="primary" type="submit" form="add-product-form">
            <Check size={20} className="mr-1.5" aria-hidden="true" />
            {t("actions.save")}
          </Button>
        }
      >
        <form
          id="add-product-form"
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const els = form.elements as HTMLFormControlsCollection & {
              name: HTMLInputElement;
              code: HTMLInputElement;
              unit: HTMLSelectElement;
              current_stock: HTMLInputElement;
              reorder_level: HTMLInputElement;
            };
            const primaryUnit = els.unit.value;
            const stockVal = Number(els.current_stock.value) || 0;
            const stockUnit = addStockUnit || primaryUnit;
            const conversions = addConversions
              .filter((c) => c.to_unit.trim() && Number(c.factor) > 0)
              .map((c) => ({
                to_unit: c.to_unit.trim(),
                factor: Number(c.factor),
              }));
            createItem.mutate({
              name: els.name.value,
              code: els.code.value || undefined,
              unit: primaryUnit,
              retail_primary_unit: addRetailPrimary || null,
              other_units: addOtherUnits.length > 0 ? addOtherUnits : undefined,
              selling_price:
                addSellingPrice && Number(addSellingPrice) > 0
                  ? Number(addSellingPrice)
                  : null,
              selling_price_unit:
                addSellingPrice && addSellingPriceUnit
                  ? addSellingPriceUnit
                  : null,
              gst_rate: addGstRate,
              hsn_code: addHsnCode?.trim() || null,
              current_stock: stockUnit === primaryUnit ? stockVal : undefined,
              current_stock_value:
                stockUnit !== primaryUnit ? stockVal : undefined,
              current_stock_unit:
                stockUnit && stockUnit !== primaryUnit ? stockUnit : undefined,
              conversions: conversions.length > 0 ? conversions : undefined,
              reorder_level: Number(els.reorder_level.value) || undefined,
            });
          }}
        >
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("form.basicDetails")}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label={t("columns.name")} required>
                <input
                  name="name"
                  required
                  className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                />
              </FormField>
              <FormField label={t("columns.code")}>
                <input
                  name="code"
                  className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-3 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t("form.unitsAndConversions")}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {t("form.unitsHelpAdd")}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setImportUnitsTarget("add");
                  setImportProductId("");
                  setImportUnitsPopupOpen(true);
                }}
              >
                <FileDown size={20} className="mr-1.5" aria-hidden="true" />
                {t("actions.importFromProduct")}
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {t("form.missingUnitPrefix")}{" "}
                <Link
                  to="/units"
                  className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline"
                >
                  {t("form.manageAllUnits")}
                </Link>{" "}
                {t("form.missingUnitSuffix")}
              </p>
              <div className="border-t border-[var(--color-border-default)] pt-3">
                <span className="mb-2 block text-sm text-[var(--color-text-tertiary)]">
                  {t("form.primaryUnitHelp")}
                </span>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label={t("form.primaryStockUnit")} required>
                    <select
                      name="unit"
                      value={addUnitSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAddUnitSelect(v);
                        setAddStockUnit(v);
                      }}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                      required
                    >
                      <option value="">{t("form.selectUnit")}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.name}>
                          {unitDisplay(u.name)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={t("form.retailPrimaryUnitOptional")}>
                    <select
                      value={addRetailPrimary}
                      onChange={(e) => setAddRetailPrimary(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    >
                      <option value="">{t("form.none")}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.name}>
                          {unitDisplay(u.name)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="block text-sm font-medium text-[var(--color-text-secondary)]">
                      Other units (optional)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setAddOtherUnits((prev) => [
                          ...prev,
                          { unit: "", sort_order: prev.length },
                        ])
                      }
                    >
                      <Plus size={20} className="mr-1.5" aria-hidden="true" />
                      Add unit
                    </Button>
                  </div>
                  {addOtherUnits.map((ou, idx) => (
                    <div key={idx} className="mt-2 flex items-center gap-2">
                      <select
                        value={ou.unit}
                        onChange={(e) =>
                          setAddOtherUnits((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, unit: e.target.value } : p
                            )
                          )
                        }
                        className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
                      >
                        <option value="">{t("form.selectUnit")}</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.name}>
                            {unitDisplay(u.name)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setAddOtherUnits((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="rounded p-1.5 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"
                        title={t("actions.remove", { defaultValue: "Remove" })}
                        aria-label={t("actions.remove", { defaultValue: "Remove" })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <FormField
                label={t("form.conversionOptional", {
                  defaultValue: "Conversion (optional)",
                })}
              >
                <p className="mb-2 text-sm text-[var(--color-text-tertiary)]">
                  e.g. 1 bag = 25 kg — lets you enter stock in kg or gram. Add
                  multiple rows for several units.
                </p>
                <div className="space-y-2">
                  {addConversions.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="text-[var(--color-text-secondary)]">
                        1 {addUnitSelect || "—"} =
                      </span>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        placeholder={t("form.example25", { defaultValue: "e.g. 25" })}
                        value={row.factor || ""}
                        onChange={(e) =>
                          setAddConversions((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    factor: Number(e.target.value) || 0,
                                  }
                                : p
                            )
                          )
                        }
                        className="w-24 border border-[var(--color-border-strong)] rounded px-3 py-2"
                      />
                      <select
                        value={row.to_unit}
                        onChange={(e) =>
                          setAddConversions((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, to_unit: e.target.value } : p
                            )
                          )
                        }
                        className="border border-[var(--color-border-strong)] rounded px-3 py-2"
                      >
                        <option value="">Select unit</option>
                        {units
                          .map((u) => u.name)
                          .sort()
                          .map((name) => (
                            <option key={name} value={name}>
                              {unitDisplay(name)}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setAddConversions((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="rounded p-1.5 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"
                        title={t("actions.remove", { defaultValue: "Remove" })}
                        aria-label={t("actions.remove", { defaultValue: "Remove" })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setAddConversions((prev) => [
                        ...prev,
                        { to_unit: "", factor: 0 },
                      ])
                    }
                  >
                    <Plus size={20} className="mr-1.5" aria-hidden="true" />
                    Add row
                  </Button>
                </div>
              </FormField>
            </div>
          </section>

          {gstEnabled && (
            <section className="space-y-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-3 md:p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                GST & Selling Price
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  label={t("form.sellingPriceOptional", {
                    defaultValue: "Selling Price (optional)",
                  })}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("form.example50", { defaultValue: "e.g. 50" })}
                    value={addSellingPrice}
                    onChange={(e) => setAddSellingPrice(e.target.value)}
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  />
                </FormField>
                <FormField
                  label={t("form.sellingPriceUnit", {
                    defaultValue: "Selling Price Unit",
                  })}
                >
                  <select
                    value={addSellingPriceUnit}
                    onChange={(e) => setAddSellingPriceUnit(e.target.value)}
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  >
                    <option value="">—</option>
                    {addAllowedStockUnits.map((name) => (
                      <option key={name} value={name}>
                        {unitDisplay(name)}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={t("form.gstRate", { defaultValue: "GST Rate" })}>
                  <select
                    value={addGstRate}
                    onChange={(e) => setAddGstRate(Number(e.target.value))}
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  >
                    {GST_SLABS.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </FormField>
                {hsnEnabled && (
                  <FormField
                    label={t("form.hsnCodeOptional", {
                      defaultValue: "HSN Code (optional)",
                    })}
                  >
                    <input
                      type="text"
                      placeholder={t("form.exampleHsn", { defaultValue: "e.g. 1006" })}
                      value={addHsnCode}
                      onChange={(e) => setAddHsnCode(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    />
                  </FormField>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Stock & reorder
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label={t("columns.currentStock")}>
                <div className="flex gap-2">
                  <input
                    name="current_stock"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue="0"
                    className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
                  />
                  <select
                    value={addStockUnit}
                    onChange={(e) => setAddStockUnit(e.target.value)}
                    className="w-32 border border-[var(--color-border-strong)] rounded px-3 py-2"
                  >
                    {addAllowedStockUnits.length === 0 ? (
                      <option value="">
                        {addUnitSelect
                          ? unitDisplay(addUnitSelect)
                          : "Select unit"}
                      </option>
                    ) : (
                      addAllowedStockUnits.map((name) => (
                        <option key={name} value={name}>
                          {unitDisplay(name)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </FormField>
              <FormField label={t("columns.reorderLevel")}>
                <input
                  name="reorder_level"
                  type="number"
                  min="0"
                  className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                />
              </FormField>
            </div>
          </section>
        </form>
      </FormModal>

      <FormModal
        title={t("modals.importUnits.title")}
        open={importUnitsPopupOpen}
        onClose={() => {
          setImportUnitsPopupOpen(false);
          setImportUnitsTarget(null);
          setImportProductId("");
        }}
        maxWidth="max-w-sm"
        stackAbove
        footer={
          <Button
            variant="primary"
            type="button"
            disabled={!importProductId}
            onClick={() => {
              const id = Number(importProductId);
              if (!id) return;
              api.getItemById(id).then((item) => {
                const retailPrimary =
                  item.retail_primary_unit != null
                    ? String(item.retail_primary_unit)
                    : "";
                const payload = {
                  unit: item.unit,
                  retailPrimary,
                  otherUnits: (item.other_units ?? []).map((o) => ({
                    unit: o.unit,
                    sort_order: o.sort_order ?? 0,
                  })),
                };
                if (importUnitsTarget === "add") {
                  setAddUnitSelect(payload.unit);
                  setAddRetailPrimary(payload.retailPrimary);
                  setAddOtherUnits(payload.otherUnits);
                } else {
                  setEditUnitSelect(payload.unit);
                  setEditRetailPrimary(payload.retailPrimary);
                  setEditOtherUnits(payload.otherUnits);
                }
                setImportUnitsPopupOpen(false);
                setImportUnitsTarget(null);
                setImportProductId("");
              });
            }}
          >
            <FileDown size={20} className="mr-1.5" aria-hidden="true" />
            {t("actions.import")}
          </Button>
        }
      >
        <FormField label={t("columns.product")}>
          <select
            value={importProductId}
            onChange={(e) => setImportProductId(e.target.value)}
            className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
          >
            <option value="">{t("modals.importUnits.selectProductToCopy")}</option>
            {(importUnitsTarget === "edit" && editing
              ? items.filter((i) => i.id !== editing.id)
              : items
            ).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </FormField>
      </FormModal>

      <FormModal
        title={t("modals.editProduct.title")}
        open={!!editing}
        onClose={() => {
          setEditing(null);
          setEditUnitSelect("");
          setEditRetailPrimary("");
          setEditStockUnit("");
          setEditConversions([{ to_unit: "", factor: 0 }]);
          setEditOtherUnits([]);
          setEditSellingPrice("");
          setEditSellingPriceUnit("");
          setEditGstRate(0);
          setEditHsnCode("");
          setImportUnitsPopupOpen(false);
          setImportUnitsTarget(null);
          setImportProductId("");
        }}
        maxWidth="max-w-3xl"
        footer={
          editing ? (
            <Button variant="primary" type="submit" form="edit-product-form">
              <Check size={20} className="mr-1.5" aria-hidden="true" />
              {t("actions.update")}
            </Button>
          ) : null
        }
      >
        {editing && (
          <form
            id="edit-product-form"
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const els = form.elements as HTMLFormControlsCollection & {
                name: HTMLInputElement;
                code: HTMLInputElement;
                unit: HTMLSelectElement;
                current_stock: HTMLInputElement;
                reorder_level: HTMLInputElement;
              };
              const primaryUnit = els.unit.value;
              const stockVal = Number(els.current_stock.value);
              const stockUnit = editStockUnit || primaryUnit;
              const conversions = editConversions
                .filter((c) => c.to_unit.trim() && Number(c.factor) > 0)
                .map((c) => ({
                  to_unit: c.to_unit.trim(),
                  factor: Number(c.factor),
                }));
              updateItem.mutate({
                id: editing.id,
                item: {
                  name: els.name.value,
                  code: els.code.value || undefined,
                  unit: primaryUnit,
                  retail_primary_unit: editRetailPrimary || null,
                  selling_price:
                    editSellingPrice && Number(editSellingPrice) > 0
                      ? Number(editSellingPrice)
                      : null,
                  selling_price_unit:
                    editSellingPrice && editSellingPriceUnit
                      ? editSellingPriceUnit
                      : null,
                  gst_rate: editGstRate,
                  hsn_code: editHsnCode?.trim() || null,
                  conversions: conversions.length > 0 ? conversions : undefined,
                  current_stock:
                    stockUnit === primaryUnit ? stockVal : undefined,
                  current_stock_value:
                    stockUnit !== primaryUnit ? stockVal : undefined,
                  current_stock_unit:
                    stockUnit && stockUnit !== primaryUnit
                      ? stockUnit
                      : undefined,
                  reorder_level: Number(els.reorder_level.value) || undefined,
                },
                other_units: editOtherUnits,
              });
            }}
          >
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("form.basicDetails")}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label={t("columns.name")} required>
                  <input
                    name="name"
                    defaultValue={editing.name}
                    required
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  />
                </FormField>
                <FormField label={t("columns.code")}>
                  <input
                    name="code"
                    defaultValue={editing.code ?? ""}
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  />
                </FormField>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-3 md:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Units & conversions
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                    Update how you buy, store and sell this product.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setImportUnitsTarget("edit");
                    setImportProductId("");
                    setImportUnitsPopupOpen(true);
                  }}
                >
                  <FileDown size={20} className="mr-1.5" aria-hidden="true" />
                  Import from product
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Don't see your unit?{" "}
                  <Link
                    to="/units"
                    className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline"
                  >
                    Manage all units
                  </Link>{" "}
                  — add to Stock (godown) or Invoice and return here.
                </p>
                <div className="border-t border-[var(--color-border-default)] pt-3">
                  <span className="mb-2 block text-sm text-[var(--color-text-tertiary)]">
                    Primary stock unit and optional retail/other units.
                  </span>
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField label={t("columns.unit")} required>
                      <select
                        name="unit"
                        value={editUnitSelect || editing.unit}
                        onChange={(e) => setEditUnitSelect(e.target.value)}
                        className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                        required
                      >
                        <option value="">{t("form.selectUnit")}</option>
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
                            {unitDisplay(u.name)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={t("form.retailPrimaryUnitOptional")}>
                      <select
                        value={editRetailPrimary}
                        onChange={(e) => setEditRetailPrimary(e.target.value)}
                        className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                      >
                        <option value="">{t("form.none")}</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.name}>
                            {unitDisplay(u.name)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="block text-sm font-medium text-[var(--color-text-secondary)]">
                        Other units (optional)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setEditOtherUnits((prev) => [
                            ...prev,
                            { unit: "", sort_order: prev.length },
                          ])
                        }
                      >
                        <Plus size={20} className="mr-1.5" aria-hidden="true" />
                        Add unit
                      </Button>
                    </div>
                    {editOtherUnits.map((ou, idx) => (
                      <div key={idx} className="mt-2 flex items-center gap-2">
                        <select
                          value={ou.unit}
                          onChange={(e) =>
                            setEditOtherUnits((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, unit: e.target.value } : p
                              )
                            )
                          }
                          className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
                        >
                          <option value="">{t("form.selectUnit")}</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.name}>
                              {unitDisplay(u.name)}
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
                          className="rounded p-1.5 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"
                          title={t("actions.remove", { defaultValue: "Remove" })}
                          aria-label={t("actions.remove", { defaultValue: "Remove" })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <FormField
                  label={t("form.conversionOptional", {
                    defaultValue: "Conversion (optional)",
                  })}
                >
                  <p className="mb-2 text-sm text-[var(--color-text-tertiary)]">
                    e.g. 1 bag = 25 kg — lets you enter stock in kg or gram. Add
                    multiple rows for several units.
                  </p>
                  <div className="space-y-2">
                    {editConversions.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-[var(--color-text-secondary)]">
                          1 {editUnitSelect || editing.unit} =
                        </span>
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          placeholder={t("form.example25", { defaultValue: "e.g. 25" })}
                          value={row.factor || ""}
                          onChange={(e) =>
                            setEditConversions((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      factor: Number(e.target.value) || 0,
                                    }
                                  : p
                              )
                            )
                          }
                          className="w-24 border border-[var(--color-border-strong)] rounded px-3 py-2"
                        />
                        <select
                          value={row.to_unit}
                          onChange={(e) =>
                            setEditConversions((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, to_unit: e.target.value }
                                  : p
                              )
                            )
                          }
                          className="border border-[var(--color-border-strong)] rounded px-3 py-2"
                        >
                          <option value="">{t("form.selectUnit")}</option>
                          {units
                            .map((u) => u.name)
                            .sort()
                            .map((name) => (
                              <option key={name} value={name}>
                                {unitDisplay(name)}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setEditConversions((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="rounded p-1.5 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"
                          title={t("actions.remove", { defaultValue: "Remove" })}
                          aria-label={t("actions.remove", { defaultValue: "Remove" })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setEditConversions((prev) => [
                          ...prev,
                          { to_unit: "", factor: 0 },
                        ])
                      }
                    >
                      <Plus size={20} className="mr-1.5" aria-hidden="true" />
                      Add row
                    </Button>
                  </div>
                </FormField>
              </div>
            </section>

            {gstEnabled && (
              <section className="space-y-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-3 md:p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  GST & Selling Price
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    label={t("form.sellingPriceOptional", {
                      defaultValue: "Selling Price (optional)",
                    })}
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t("form.example50", { defaultValue: "e.g. 50" })}
                      value={editSellingPrice}
                      onChange={(e) => setEditSellingPrice(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    />
                  </FormField>
                  <FormField
                    label={t("form.sellingPriceUnit", {
                      defaultValue: "Selling Price Unit",
                    })}
                  >
                    <select
                      value={editSellingPriceUnit}
                      onChange={(e) => setEditSellingPriceUnit(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    >
                      <option value="">—</option>
                      {editAllowedStockUnits.map((name) => (
                        <option key={name} value={name}>
                          {unitDisplay(name)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={t("form.gstRate", { defaultValue: "GST Rate" })}>
                    <select
                      value={editGstRate}
                      onChange={(e) => setEditGstRate(Number(e.target.value))}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    >
                      {GST_SLABS.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {hsnEnabled && (
                    <FormField
                      label={t("form.hsnCodeOptional", {
                        defaultValue: "HSN Code (optional)",
                      })}
                    >
                      <input
                        type="text"
                        placeholder={t("form.exampleHsn", { defaultValue: "e.g. 1006" })}
                        value={editHsnCode}
                        onChange={(e) => setEditHsnCode(e.target.value)}
                        className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                      />
                    </FormField>
                  )}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Stock & reorder
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label={t("columns.currentStock")}>
                  <div className="flex gap-2">
                    <input
                      name="current_stock"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue={editing.current_stock}
                      className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
                    />
                    <select
                      value={editStockUnit}
                      onChange={(e) => setEditStockUnit(e.target.value)}
                      className="w-32 border border-[var(--color-border-strong)] rounded px-3 py-2"
                    >
                      {editAllowedStockUnits.length === 0 ? (
                        <option value={editing.unit}>
                          {unitDisplay(editing.unit)}
                        </option>
                      ) : (
                        editAllowedStockUnits.map((name) => (
                          <option key={name} value={name}>
                            {unitDisplay(name)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </FormField>
                <FormField label={t("columns.reorderLevel")}>
                  <input
                    name="reorder_level"
                    type="number"
                    min="0"
                    defaultValue={editing.reorder_level ?? ""}
                    className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                  />
                </FormField>
              </div>
            </section>
          </form>
        )}
      </FormModal>

      <FormModal
        title={t("modals.addStock.title")}
        open={addStockOpen}
        onClose={() => {
          setAddStockOpen(false);
          setAddStockItem(null);
        }}
        footer={
          <Button variant="primary" type="submit" form="add-stock-form">
            <Plus size={20} className="mr-1.5" aria-hidden="true" />
            {t("actions.add")}
          </Button>
        }
      >
        <form
          id="add-stock-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addStockItem) return;
            const qty = Number((e.target as HTMLFormElement).quantity.value);
            if (qty <= 0) {
              toast.error(t("validation.quantityPositive"));
              return;
            }
            addStock.mutate({
              id: addStockItem.id,
              quantity: qty,
              unit:
                addStockUnitModal && addStockUnitModal !== addStockItem.unit
                  ? addStockUnitModal
                  : undefined,
            });
          }}
        >
          <FormField label={t("columns.product")}>
            <select
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              value={addStockItem?.id ?? ""}
              onChange={(e) =>
                setAddStockItem(
                  items.find((i) => i.id === Number(e.target.value)) ?? null
                )
              }
              required
            >
              <option value="">{t("modals.addStock.selectProduct")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatDecimal(i.current_stock)}{" "}
                  {unitDisplay(i.unit)})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("modals.addStock.quantityToAdd")}>
            <div className="flex gap-2">
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
              <select
                value={addStockUnitModal}
                onChange={(e) => setAddStockUnitModal(e.target.value)}
                className="w-32 border border-[var(--color-border-strong)] rounded px-3 py-2"
              >
                {addStockItem ? (
                  <>
                    <option value={addStockItem.unit}>
                      {unitDisplay(addStockItem.unit)}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {unitDisplay(u.name)}
                      </option>
                    ))}
                  </>
                ) : null}
              </select>
            </div>
          </FormField>
        </form>
      </FormModal>

      <FormModal
        title={t("modals.reduceStock.title")}
        open={reduceStockOpen}
        onClose={() => {
          setReduceStockOpen(false);
          setReduceStockItem(null);
        }}
        footer={
          <Button variant="primary" type="submit" form="reduce-stock-form">
            <ArrowDown size={20} className="mr-1.5" aria-hidden="true" />
            {t("actions.reduce")}
          </Button>
        }
      >
        <form
          id="reduce-stock-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reduceStockItem) return;
            const qty = Number((e.target as HTMLFormElement).quantity.value);
            if (qty <= 0) {
              toast.error(t("validation.quantityPositive"));
              return;
            }
            reduceStock.mutate({
              id: reduceStockItem.id,
              quantity: qty,
              unit:
                reduceStockUnitModal &&
                reduceStockUnitModal !== reduceStockItem.unit
                  ? reduceStockUnitModal
                  : undefined,
            });
          }}
        >
          <FormField label={t("columns.product")}>
            <select
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
              value={reduceStockItem?.id ?? ""}
              onChange={(e) =>
                setReduceStockItem(
                  items.find((i) => i.id === Number(e.target.value)) ?? null
                )
              }
              required
            >
              <option value="">{t("modals.reduceStock.selectProduct")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatDecimal(i.current_stock)}{" "}
                  {unitDisplay(i.unit)})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("modals.reduceStock.quantityToDeduct")}>
            <div className="flex gap-2">
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                className="flex-1 border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
              <select
                value={reduceStockUnitModal}
                onChange={(e) => setReduceStockUnitModal(e.target.value)}
                className="w-32 border border-[var(--color-border-strong)] rounded px-3 py-2"
              >
                {reduceStockItem ? (
                  <>
                    <option value={reduceStockItem.unit}>
                      {unitDisplay(reduceStockItem.unit)}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {unitDisplay(u.name)}
                      </option>
                    ))}
                  </>
                ) : null}
              </select>
            </div>
          </FormField>
        </form>
      </FormModal>

      {printJob && (
        <div
          className="app-print-container items-print-container daily-sales-print-container fixed left-0 top-0 z-[9999] hidden w-full bg-[var(--color-bg-surface)] p-6 print:block"
          aria-hidden
        >
          <header className="items-print-header mb-4 border-b border-[var(--color-border-default)] pb-3">
            <p className="items-print-app-name text-sm font-semibold text-[var(--color-text-primary)]">
              {appName}
            </p>
            <p className="items-print-report text-xs text-[var(--color-text-secondary)]">
              {t("print.reportTitle")}
            </p>
            <p className="items-print-datetime mt-1 text-xs text-[var(--color-text-tertiary)]">
              {new Date().toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </header>
          <table className="items-print-table w-full border-collapse text-xs">
            <thead>
              <tr className="items-print-thead">
                {printJob.columns.map((col) => (
                  <th
                    key={col}
                    className="border border-[var(--color-border-strong)] px-2 py-1.5 text-left font-medium text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printJob.rows.map((row) => (
                <tr key={row[0]} className="items-print-tbody-tr">
                  {row.map((cell, ci) => (
                    <td
                      key={`${row[0]}-${printJob.columns[ci]}`}
                      className="border border-[var(--color-border-strong)] px-2 py-1.5 text-[var(--color-text-primary)]"
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
