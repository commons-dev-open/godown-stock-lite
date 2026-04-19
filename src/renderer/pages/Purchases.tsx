import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PAGE, modalPurchasesCashPurchase } from "shared/test-ids";
import toast from "react-hot-toast";
import { Banknote, Filter, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import { getElectron } from "../api/client";
import { PAGE_SIZE } from "../../shared/constants";
import DateInput from "../components/DateInput";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import AddLendModal from "../components/AddLendModal";
import { CashPurchaseEntryModals } from "../components/CashPurchaseEntryModals";
import type {
  Item,
  Lender,
  SupplierPurchaseAllocationSummary,
  SupplierPurchasePageRow,
  Unit,
  UnitConversion,
} from "../../shared/types";
import { getItemCatalogUnitsAsc } from "../../shared/itemCatalogUnits";
import { convertToPrimaryQuantity } from "../../shared/unitConversion";
import { formatDecimal, roundDecimal } from "../../shared/numbers";
import { computeLineGst, GST_SLABS } from "../../shared/gst";
import {
  formatDateForView,
  formatDateForForm,
  todayISO,
} from "../lib/date";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import {
  SalesListHero,
  SalesListSectionPanel,
  SalesListAsyncPanel,
} from "../components/sales-list-page";
import Tooltip from "../components/Tooltip";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";

type ItemWithUnitGraph = Item & {
  other_units?: { unit: string; sort_order: number }[];
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

interface EditLine {
  product_id: number;
  quantity: number;
  amount: number;
  unit: string;
  gst_rate: number;
  gst_inclusive: boolean;
}

function emptyEditLine(): EditLine {
  return {
    product_id: 0,
    quantity: 0,
    amount: 0,
    unit: "",
    gst_rate: 0,
    gst_inclusive: false,
  };
}

function unitOptionLabel(u: Unit): string {
  return (u.symbol && u.symbol.trim()) || u.name;
}

function purchaseEditUnitSelectRows(
  selectedItem: ItemWithUnitGraph | undefined,
  allUnits: Unit[],
  globalConversions: UnitConversion[],
  lineUnit: string
): Unit[] {
  if (!selectedItem) {
    return [];
  }
  const catalog = getItemCatalogUnitsAsc(
    selectedItem,
    allUnits,
    globalConversions,
    selectedItem.unit
  );
  const names = new Set(catalog.map((u) => u.name));
  const u = (lineUnit || selectedItem.unit || "").trim();
  const extra: Unit[] =
    u && !names.has(u)
      ? [
          {
            id: -1,
            name: u,
            symbol: null,
            unit_type_id: null,
            unit_type_name: null,
            created_at: "",
          },
        ]
      : [];
  const merged = [...extra, ...catalog];
  if (merged.length > 0) {
    return merged;
  }
  return [
    {
      id: -1,
      name: selectedItem.unit,
      symbol: null,
      unit_type_id: null,
      unit_type_name: null,
      created_at: "",
    },
  ];
}

function formatAllocationPayment(a: SupplierPurchaseAllocationSummary) {
  const pm = a.payment_method?.trim();
  const ref = a.reference_number?.trim();
  const refShort = ref && ref.length > 20 ? `${ref.slice(0, 18)}…` : ref;
  if (pm && refShort) {
    return `${pm} · ${refShort}`;
  }
  if (pm) {
    return pm;
  }
  if (refShort) {
    return refShort;
  }
  return "—";
}

const PAYMENT_METHODS = [
  {
    value: "cash",
    labelKey: "modals.shared.payment_methods.cash.label",
    refLabelKey: "modals.shared.payment_methods.cash.reference_label",
  },
  {
    value: "bank",
    labelKey: "modals.shared.payment_methods.bank.label",
    refLabelKey: "modals.shared.payment_methods.bank.reference_label",
    placeholderKey: "modals.shared.payment_methods.bank.placeholder",
  },
  {
    value: "upi",
    labelKey: "modals.shared.payment_methods.upi.label",
    refLabelKey: "modals.shared.payment_methods.upi.reference_label",
  },
  {
    value: "cheque",
    labelKey: "modals.shared.payment_methods.cheque.label",
    refLabelKey: "modals.shared.payment_methods.cheque.reference_label",
  },
] as const;

export default function Purchases() {
  const { t } = useTranslation("purchases");
  const { t: tTx } = useTranslation("transactions");
  const api = getElectron();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [cashPurchaseModalOpen, setCashPurchaseModalOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [filterKind, setFilterKind] = useState<"" | "credit" | "cash">("");
  const [filterLenderId, setFilterLenderId] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLenderId, setEditLenderId] = useState(0);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editInvoiceFilePath, setEditInvoiceFilePath] = useState("");
  const [editVendorName, setEditVendorName] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("cash");
  const [editOtherCharges, setEditOtherCharges] = useState("");
  const [editLines, setEditLines] = useState<EditLine[]>([emptyEditLine()]);
  const [addSettlementDate, setAddSettlementDate] = useState("");
  const [addSettlementAmount, setAddSettlementAmount] = useState("");
  const [addSettlementPaymentMethod, setAddSettlementPaymentMethod] =
    useState("");
  const [addSettlementReference, setAddSettlementReference] = useState("");
  const [addSettlementNotes, setAddSettlementNotes] = useState("");
  const didSeedEditForm = useRef(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementPurchaseId, setSettlementPurchaseId] = useState<
    number | null
  >(null);
  const didSeedSettlementForm = useRef(false);

  const purchaseIdFromUrl = searchParams.get("purchaseId");

  useEffect(() => {
    if (!purchaseIdFromUrl) {
      return;
    }
    const n = Number(purchaseIdFromUrl);
    if (!Number.isFinite(n) || n <= 0) {
      return;
    }
    setEditingId(n);
    setEditOpen(true);
  }, [purchaseIdFromUrl]);

  useEffect(() => {
    setPage(1);
  }, [filterKind, filterLenderId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (filterKind === "cash") {
      setFilterLenderId("");
    }
  }, [filterKind]);

  const { data: lenders = [] } = useQuery({
    queryKey: ["lenders"],
    queryFn: () => api.getLenders(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits(),
    enabled: editOpen,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions(),
    enabled: editOpen,
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: editOpen,
  });
  const gstEnabled =
    (settings as Record<string, string>).gst_enabled === "true";

  const itemList = useMemo(() => items as ItemWithUnitGraph[], [items]);

  const globalConversionRows = useMemo(
    () =>
      (unitConversions as UnitConversion[]).map((c) => ({
        from_unit: c.from_unit,
        to_unit: c.to_unit,
        factor: c.factor,
      })),
    [unitConversions]
  );

  const {
    data: listPage,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: [
      "supplierPurchasesPage",
      filterKind || null,
      filterLenderId || null,
      filterDateFrom,
      filterDateTo,
      page,
    ],
    queryFn: () =>
      api.getSupplierPurchasesPage({
        kind: filterKind === "" ? null : filterKind,
        lenderId:
          filterKind === "cash"
            ? null
            : filterLenderId !== "" && !Number.isNaN(Number(filterLenderId))
              ? Number(filterLenderId)
              : null,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const rows = listPage?.data ?? [];
  const totalRows = listPage?.total ?? 0;

  const detailPurchaseId =
    editOpen && editingId != null
      ? editingId
      : settlementOpen && settlementPurchaseId != null
        ? settlementPurchaseId
        : null;

  const {
    data: detail,
    isError: detailError,
    isFetching: detailFetching,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["supplierPurchaseDetail", detailPurchaseId],
    queryFn: () => api.getSupplierPurchaseById(detailPurchaseId!),
    enabled: detailPurchaseId != null,
  });

  useEffect(() => {
    if (!editOpen) {
      didSeedEditForm.current = false;
      return;
    }
    if (
      !detail ||
      editingId == null ||
      detail.header.id !== editingId ||
      didSeedEditForm.current
    ) {
      return;
    }
    didSeedEditForm.current = true;
    setEditDate(detail.header.document_date);
    setEditNotes(detail.header.notes ?? "");
    setEditLenderId(
      detail.header.kind === "credit" ? detail.header.lender_id ?? 0 : 0
    );
    setEditInvoiceNumber(detail.header.lender_invoice_number ?? "");
    setEditInvoiceFilePath(detail.header.invoice_file_path ?? "");
    setEditVendorName(detail.header.vendor_name ?? "");
    setEditPaymentMethod(
      detail.header.payment_method?.trim() || "cash"
    );
    setEditOtherCharges(
      detail.header.other_charges != null &&
        detail.header.other_charges > 0
        ? String(detail.header.other_charges)
        : ""
    );
    setEditLines(
      detail.lines.length
        ? detail.lines.map((ln) => ({
            product_id: ln.product_id,
            quantity: ln.quantity,
            amount: ln.amount,
            unit: ln.unit?.trim() || "",
            gst_rate: ln.gst_rate ?? 0,
            gst_inclusive: ln.gst_inclusive ?? false,
          }))
        : [emptyEditLine()]
    );
  }, [editOpen, detail, editingId]);

  useEffect(() => {
    if (!settlementOpen) {
      didSeedSettlementForm.current = false;
      return;
    }
    if (
      !detail ||
      settlementPurchaseId == null ||
      detail.header.id !== settlementPurchaseId ||
      didSeedSettlementForm.current
    ) {
      return;
    }
    didSeedSettlementForm.current = true;
    setAddSettlementDate(todayISO());
    setAddSettlementAmount("");
    setAddSettlementPaymentMethod("");
    setAddSettlementReference("");
    setAddSettlementNotes("");
  }, [settlementOpen, detail, settlementPurchaseId]);

  const hasAllocations =
    detail != null &&
    detail.header.kind === "credit" &&
    detail.allocations.length > 0;

  const allocatedOnBill = useMemo(() => {
    if (!detail || detail.header.kind !== "credit") {
      return 0;
    }
    return roundDecimal(
      detail.allocations.reduce(
        (s, a) => s + roundDecimal(a.allocated_amount),
        0
      )
    );
  }, [detail]);

  const draftBillTotal = useMemo(() => {
    return roundDecimal(
      editLines.reduce((s, ln) => {
        if (
          ln.product_id <= 0 ||
          ln.quantity <= 0 ||
          !Number.isFinite(ln.amount) ||
          ln.amount < 0
        ) {
          return s;
        }
        return s + roundDecimal(ln.amount);
      }, 0)
    );
  }, [editLines]);

  const savedBillTotal = useMemo(() => {
    if (!detail || detail.header.kind !== "credit") {
      return 0;
    }
    return roundDecimal(detail.header.total_amount);
  }, [detail]);

  const remainingForSettlement = useMemo(() => {
    const r = roundDecimal(savedBillTotal - allocatedOnBill);
    return r > 0 ? r : 0;
  }, [savedBillTotal, allocatedOnBill]);

  const canSubmitSettlementFromModal = useMemo(() => {
    if (!detail || detailError) {
      return false;
    }
    if (detail.header.kind !== "credit") {
      return false;
    }
    if (detail.header.lender_id == null || detail.header.lender_id <= 0) {
      return false;
    }
    if (remainingForSettlement <= 0) {
      return false;
    }
    return true;
  }, [detail, detailError, remainingForSettlement]);

  const settlementLenderLabel = useMemo(() => {
    if (!detail?.header.lender_id) {
      return null;
    }
    const m = (lenders as Lender[]).find(
      (x) => x.id === detail.header.lender_id
    );
    return m?.name ?? null;
  }, [detail, lenders]);

  const closeEdit = useCallback(() => {
    didSeedEditForm.current = false;
    setEditOpen(false);
    setEditingId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("purchaseId");
      return next;
    });
  }, [setSearchParams]);

  const closeSettlement = useCallback(() => {
    didSeedSettlementForm.current = false;
    setSettlementOpen(false);
    setSettlementPurchaseId(null);
  }, []);

  const openSettlement = useCallback((id: number) => {
    setSettlementPurchaseId(id);
    setSettlementOpen(true);
  }, []);

  const openSettlementFromEdit = useCallback(() => {
    if (!detail) {
      return;
    }
    const id = detail.header.id;
    closeEdit();
    openSettlement(id);
  }, [detail, closeEdit, openSettlement]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      lender_id?: number;
      transaction_date: string;
      notes: string | null;
      lender_invoice_number: string | null;
      invoice_file_path?: string | null;
      vendor_name?: string | null;
      payment_method?: string | null;
      other_charges?: number;
      lines: {
        product_id: number;
        quantity: number;
        amount: number;
        gst_rate?: number;
        gst_inclusive?: boolean;
        taxable_amount?: number;
        cgst_amount?: number;
        sgst_amount?: number;
      }[];
    }) => api.updateSupplierPurchaseWithLines(editingId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchaseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      queryClient.invalidateQueries({
        queryKey: ["creditPurchasesWithAllocated"],
      });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setLedgerUpdatesAvailable(true);
      toast.success(t("toasts.saved"));
      closeEdit();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t("toasts.save_failed"));
    },
  });

  const addSettlementMutation = useMutation({
    mutationFn: (payload: {
      mahajan_id: number;
      transaction_date: string;
      amount: number;
      notes?: string;
      payment_method?: string;
      reference_number?: string;
      allocations: { credit_purchase_id: number; amount: number }[];
    }) => api.createMahajanDeposit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchaseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      queryClient.invalidateQueries({
        queryKey: ["creditPurchasesWithAllocated"],
      });
      setLedgerUpdatesAvailable(true);
      toast.success(t("toasts.settlement_added"));
      closeSettlement();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t("toasts.settlement_failed"));
    },
  });

  function openEdit(id: number) {
    setEditingId(id);
    setEditOpen(true);
  }

  function handleSaveEdit() {
    if (editingId == null || !detail) {
      return;
    }
    if (detail.header.kind === "credit" && allocatedOnBill > 0) {
      if (draftBillTotal + 1e-9 < allocatedOnBill) {
        toast.error(
          t("toasts.total_below_settled", {
            min: formatDecimal(allocatedOnBill),
          })
        );
        return;
      }
    }
    const lines: {
      product_id: number;
      quantity: number;
      amount: number;
      gst_rate: number;
      gst_inclusive: boolean;
      taxable_amount: number;
      cgst_amount: number;
      sgst_amount: number;
    }[] = [];
    for (let idx = 0; idx < editLines.length; idx++) {
      const ln = editLines[idx];
      if (
        !(
          ln.product_id > 0 &&
          ln.quantity > 0 &&
          Number.isFinite(ln.amount) &&
          ln.amount >= 0
        )
      ) {
        continue;
      }
      const item = itemList.find((i) => i.id === ln.product_id);
      if (!item) {
        continue;
      }
      const fromUnit = (ln.unit?.trim() || item.unit).trim();
      const conv = convertToPrimaryQuantity(
        globalConversionRows,
        {
          unit: item.unit,
          reference_unit: item.reference_unit,
          quantity_per_primary: item.quantity_per_primary,
          item_conversions: item.item_unit_conversions,
        },
        ln.quantity,
        fromUnit
      );
      if ("error" in conv) {
        toast.error(conv.error);
        return;
      }
      const orig = detail.lines[idx];
      if (detail.header.kind === "cash") {
        const gstRate = gstEnabled ? (ln.gst_rate ?? orig?.gst_rate ?? 0) : 0;
        const gstInclusive = ln.gst_inclusive ?? orig?.gst_inclusive ?? false;
        const g =
          gstRate > 0
            ? computeLineGst(ln.amount, gstRate, gstInclusive)
            : null;
        lines.push({
          product_id: ln.product_id,
          quantity: conv.primaryQuantity,
          amount: g ? roundDecimal(g.total_amount) : roundDecimal(ln.amount),
          gst_rate: gstRate,
          gst_inclusive: gstInclusive,
          taxable_amount: g
            ? roundDecimal(g.taxable_amount)
            : roundDecimal(ln.amount),
          cgst_amount: g ? roundDecimal(g.cgst_amount) : 0,
          sgst_amount: g ? roundDecimal(g.sgst_amount) : 0,
        });
      } else {
        lines.push({
          product_id: ln.product_id,
          quantity: conv.primaryQuantity,
          amount: ln.amount,
          gst_rate: orig?.gst_rate ?? 0,
          gst_inclusive: orig?.gst_inclusive ?? false,
          taxable_amount: orig?.taxable_amount ?? ln.amount,
          cgst_amount: orig?.cgst_amount ?? 0,
          sgst_amount: orig?.sgst_amount ?? 0,
        });
      }
    }
    if (!lines.length) {
      toast.error(tTx("modals.cash_purchase.toasts.add_one_item"));
      return;
    }
    if (detail.header.kind === "credit" && (!editLenderId || editLenderId <= 0)) {
      toast.error(t("toasts.save_failed"));
      return;
    }
    if (detail.header.kind === "cash") {
      const ocRaw = editOtherCharges.trim().replace(/,/g, "");
      const ocParsed = ocRaw === "" ? 0 : Number(ocRaw);
      if (!Number.isFinite(ocParsed) || ocParsed < 0) {
        toast.error(tTx("modals.cash_purchase.toasts.other_charges_invalid"));
        return;
      }
      updateMutation.mutate({
        transaction_date: editDate,
        notes: editNotes.trim() || null,
        lender_invoice_number: editInvoiceNumber.trim() || null,
        invoice_file_path: editInvoiceFilePath.trim() || null,
        vendor_name: editVendorName.trim() || null,
        payment_method: editPaymentMethod.trim() || null,
        other_charges: roundDecimal(ocParsed),
        lines,
      });
      return;
    }
    updateMutation.mutate({
      transaction_date: editDate,
      notes: editNotes.trim() || null,
      lender_invoice_number: editInvoiceNumber.trim() || null,
      lender_id: editLenderId,
      lines,
    });
  }

  function handleAddSettlement() {
    if (
      settlementPurchaseId == null ||
      !detail ||
      detail.header.kind !== "credit"
    ) {
      return;
    }
    const lid = detail.header.lender_id;
    if (lid == null || lid <= 0) {
      return;
    }
    const raw = addSettlementAmount.trim().replace(/,/g, "");
    const amt = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t("toasts.settlement_amount_invalid"));
      return;
    }
    const rounded = roundDecimal(amt);
    if (rounded > remainingForSettlement + 1e-6) {
      toast.error(
        t("toasts.settlement_exceeds_remaining", {
          max: formatDecimal(remainingForSettlement),
        })
      );
      return;
    }
    const d = addSettlementDate.trim();
    if (!d) {
      toast.error(t("toasts.settlement_date_required"));
      return;
    }
    addSettlementMutation.mutate({
      mahajan_id: lid,
      transaction_date: d,
      amount: rounded,
      notes: addSettlementNotes.trim() || undefined,
      payment_method: addSettlementPaymentMethod.trim() || undefined,
      reference_number: addSettlementReference.trim() || undefined,
      allocations: [
        { credit_purchase_id: settlementPurchaseId, amount: rounded },
      ],
    });
  }

  const columns = useMemo(
    () => [
      {
        key: "document_date",
        label: t("columns.date"),
        render: (row: SupplierPurchasePageRow) => (
          <Tooltip content={formatDateForForm(row.document_date)}>
            <span>{formatDateForView(row.document_date)}</span>
          </Tooltip>
        ),
      },
      {
        key: "kind",
        label: t("columns.type"),
        render: (row: SupplierPurchasePageRow) => (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {row.kind === "credit"
              ? t("kind_labels.credit")
              : t("kind_labels.cash")}
          </span>
        ),
      },
      {
        key: "lender_name",
        label: t("columns.counterparty"),
        render: (row: SupplierPurchasePageRow) => (
          <span className="text-sm">
            {row.kind === "credit"
              ? row.lender_name ?? "—"
              : row.vendor_name?.trim()
                ? row.vendor_name.trim()
                : t("counterparty_cash")}
          </span>
        ),
      },
      {
        key: "product_summary",
        label: t("columns.products"),
        render: (row: SupplierPurchasePageRow) => (
          <span
            className="block max-w-[14rem] truncate text-sm text-[var(--color-text-secondary)]"
            title={row.product_summary ?? ""}
          >
            {row.product_summary?.trim() || "—"}
          </span>
        ),
      },
      {
        key: "line_count",
        label: t("columns.lines"),
        align: "right" as const,
        render: (row: SupplierPurchasePageRow) => (
          <span className="tabular-nums">{row.line_count}</span>
        ),
      },
      {
        key: "total_amount",
        label: t("columns.total"),
        align: "right" as const,
        render: (row: SupplierPurchasePageRow) => (
          <span className="font-medium tabular-nums">
            ₹{formatDecimal(row.total_amount)}
          </span>
        ),
      },
      {
        key: "settlement",
        label: t("columns.settlement"),
        render: (row: SupplierPurchasePageRow) => {
          if (row.kind !== "credit") {
            return (
              <span className="text-sm text-[var(--color-text-tertiary)]">
                {t("settlement.dash")}
              </span>
            );
          }
          const settled = roundDecimal(row.allocated_total ?? 0);
          const total = roundDecimal(row.total_amount);
          if (settled <= 0) {
            return (
              <span className="text-sm text-[var(--color-text-tertiary)]">
                {t("settlement.dash")}
              </span>
            );
          }
          const isFullySettled = settled >= total - 1e-9;
          const title = isFullySettled
            ? t("settlement.full_tooltip", {
                settled: formatDecimal(settled),
                total: formatDecimal(total),
              })
            : t("settlement.partial_title", {
                settled: formatDecimal(settled),
              });
          return (
            <Tooltip content={title}>
              <span
                className={`text-sm tabular-nums ${
                  isFullySettled
                    ? "text-[var(--color-success)] font-medium"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {isFullySettled ? (
                  t("settlement.settled")
                ) : (
                  <span className="font-medium">
                    {t("settlement.partial_short", {
                      settled: formatDecimal(settled),
                      total: formatDecimal(total),
                    })}
                  </span>
                )}
              </span>
            </Tooltip>
          );
        },
      },
      {
        key: "notes",
        label: t("columns.notes"),
        render: (row: SupplierPurchasePageRow) => (
          <span
            className="block max-w-[10rem] truncate text-sm text-[var(--color-text-tertiary)]"
            title={row.notes ?? ""}
          >
            {row.notes?.trim() || "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: t("columns.actions"),
        render: (row: SupplierPurchasePageRow) => (
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => openEdit(row.id)}
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
              title={t("actions.edit")}
              aria-label={t("actions.edit")}
            >
              <Pencil size={20} />
            </button>
            {row.kind === "credit" ? (
              <button
                type="button"
                onClick={() => openSettlement(row.id)}
                className="p-1.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                title={t("actions.settle")}
                aria-label={t("actions.settle")}
              >
                <Wallet size={20} />
              </button>
            ) : null}
            {row.kind === "credit" && row.invoice_file_path ? (
              <button
                type="button"
                onClick={() => {
                  void api.openCreditPurchaseInvoice(row.invoice_file_path!);
                }}
                className="text-xs text-[var(--color-accent)] hover:underline px-1"
              >
                {t("actions.view_invoice")}
              </button>
            ) : null}
          </span>
        ),
      },
    ],
    [t, api, openSettlement]
  );

  const clearFilters = useCallback(() => {
    setFilterKind("");
    setFilterLenderId("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }, []);

  const hasPurchaseFilters = useMemo(() => {
    return (
      filterKind !== "" ||
      filterLenderId !== "" ||
      Boolean(filterDateFrom) ||
      Boolean(filterDateTo)
    );
  }, [filterKind, filterLenderId, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-4 home-dashboard pb-3" data-testid={PAGE.purchases}>
      <SalesListHero
        title={t("hero.title")}
        metrics={[]}
        actions={
          <>
            <Button
              variant="primary"
              type="button"
              onClick={() => setCashPurchaseModalOpen(true)}
              className="!bg-[var(--color-accent)] hover:!bg-[var(--color-accent-hover)]"
            >
              <Banknote size={20} className="mr-1.5" aria-hidden="true" />
              {tTx("actions.cash_purchase")}
            </Button>
            <Button
              variant="amber"
              type="button"
              onClick={() => setLendModalOpen(true)}
            >
              <Plus size={20} className="mr-1.5" aria-hidden="true" />
              {tTx("actions.add_credit_purchase")}
            </Button>
          </>
        }
      />

      <DashboardSectionBoundary
        sectionTitle={t("title")}
        containerClassName="dashboard-panel"
        resetKeys={[
          filterKind,
          filterLenderId,
          filterDateFrom,
          filterDateTo,
          page,
          listLoading,
          listError,
          rows.length,
        ]}
      >
        <SalesListSectionPanel
          title={t("list.title")}
          description={t("list.description")}
        >
          <div className="flex flex-wrap items-end gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] overflow-hidden">
            <div className="flex min-w-0 flex-col gap-1 shrink-0">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t("filters.kind")}
              </span>
              <select
                value={filterKind}
                onChange={(e) =>
                  setFilterKind(e.target.value as "" | "credit" | "cash")
                }
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] min-w-[10rem] max-w-full"
              >
                <option value="">{t("filters.kind_all")}</option>
                <option value="credit">{t("filters.kind_credit")}</option>
                <option value="cash">{t("filters.kind_cash")}</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1 shrink-0">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t("filters.lender")}
              </span>
              <select
                value={filterLenderId}
                onChange={(e) => setFilterLenderId(e.target.value)}
                disabled={filterKind === "cash"}
                className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] min-w-[12rem] max-w-full disabled:opacity-50"
              >
                <option value="">{t("filters.lender_all")}</option>
                {(lenders as Lender[]).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setMoreFiltersOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-surface-raised)]"
            >
              <Filter size={16} aria-hidden="true" />
              {t("filters.more_filters")}
              {(filterDateFrom || filterDateTo) && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent)] rounded">
                  1
                </span>
              )}
            </button>
            {hasPurchaseFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline pb-1.5"
              >
                {t("filters.clear")}
              </button>
            ) : null}
          </div>

          {moreFiltersOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMoreFiltersOpen(false)}
                aria-hidden
              />
              <div className="relative bg-[var(--color-bg-surface)] rounded-lg shadow-xl w-full mx-4 max-w-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {t("filters.more_filters")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMoreFiltersOpen(false)}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)] rounded transition-colors"
                    aria-label={tTx("actions.close")}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <label
                    htmlFor="purchases-more-filters-date-from"
                    className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
                  >
                    {t("filters.date_from")}
                    <DateInput
                      id="purchases-more-filters-date-from"
                      value={filterDateFrom}
                      onChange={setFilterDateFrom}
                      className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                    />
                  </label>
                  <label
                    htmlFor="purchases-more-filters-date-to"
                    className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]"
                  >
                    {t("filters.date_to")}
                    <DateInput
                      id="purchases-more-filters-date-to"
                      value={filterDateTo}
                      onChange={setFilterDateTo}
                      className="border border-[var(--color-border-strong)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-surface)] w-full"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <SalesListAsyncPanel
              isLoading={listLoading}
              isError={listError}
              onRetry={() => {
                void refetchList();
              }}
              isEmpty={!listLoading && rows.length === 0}
              emptyTitle={
                hasPurchaseFilters
                  ? t("empty.no_matching_title")
                  : t("empty.title")
              }
              emptyDescription={
                hasPurchaseFilters
                  ? t("empty.no_matching_message")
                  : t("empty.description")
              }
              emptyActionLabel={
                hasPurchaseFilters
                  ? t("filters.clear")
                  : tTx("actions.cash_purchase")
              }
              onEmptyAction={
                hasPurchaseFilters
                  ? clearFilters
                  : () => setCashPurchaseModalOpen(true)
              }
              emptySecondaryLabel={
                hasPurchaseFilters
                  ? tTx("actions.cash_purchase")
                  : tTx("actions.add_credit_purchase")
              }
              onEmptySecondary={
                hasPurchaseFilters
                  ? () => setCashPurchaseModalOpen(true)
                  : () => setLendModalOpen(true)
              }
              loaderColumns={9}
            >
              <DataTable<SupplierPurchasePageRow>
                scrollMaxHeight={`calc(100vh - 20.5rem)`}
                columns={columns}
                data={rows}
                getRowKey={(r) => String(r.id)}
                tableClassName="min-w-full divide-y divide-[var(--color-border-default)]"
                rowClassName="border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                pagination={{
                  type: "controlled",
                  page,
                  total: totalRows,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </SalesListAsyncPanel>
          </div>
        </SalesListSectionPanel>
      </DashboardSectionBoundary>

      <AddLendModal open={lendModalOpen} onClose={() => setLendModalOpen(false)} />
      <CashPurchaseEntryModals
        open={cashPurchaseModalOpen}
        onClose={() => setCashPurchaseModalOpen(false)}
        modalTestIds={modalPurchasesCashPurchase}
      />

      <FormModal
        title={t("modal.title_edit")}
        open={editOpen}
        onClose={() => {
          if (!updateMutation.isPending) {
            closeEdit();
          }
        }}
        maxWidth="max-w-4xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={closeEdit}
              disabled={updateMutation.isPending}
            >
              {t("modal.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSaveEdit()}
              disabled={
                updateMutation.isPending ||
                detailFetching ||
                detailError
              }
            >
              {t("modal.save")}
            </Button>
          </>
        }
      >
        {detailError && editOpen ? (
          <p className="text-sm text-[var(--color-danger)]">
            {t("toasts.load_failed")}
            <button
              type="button"
              className="ml-2 text-[var(--color-accent)] underline"
              onClick={() => void refetchDetail()}
            >
              Retry
            </button>
          </p>
        ) : null}
        {hasAllocations ? (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {t("modal.allocations_hint", {
              settled: formatDecimal(allocatedOnBill),
            })}
          </p>
        ) : null}
        {detail && !detailError && detail.header.kind === "credit" ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {t("modal.manage_settlements_title")}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("modal.manage_settlements_hint", {
                  settled: formatDecimal(allocatedOnBill),
                  total: formatDecimal(savedBillTotal),
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => void openSettlementFromEdit()}
            >
              <Wallet
                size={16}
                aria-hidden
                className="text-[var(--color-success)]"
              />
              {t("modal.manage_settlements")}
            </Button>
          </div>
        ) : null}
        {detail && !detailError ? (
          <div className="space-y-4">
            {detail.header.kind === "credit" ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("modal.fields.lender")}
                </label>
                <select
                  value={editLenderId || ""}
                  onChange={(e) => setEditLenderId(Number(e.target.value))}
                  disabled={hasAllocations}
                  className="input-base w-full max-w-md"
                >
                  <option value="">{t("filters.lender_all")}</option>
                  {(lenders as Lender[]).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modal.fields.date")}
              </label>
              <DateInput
                value={editDate}
                onChange={setEditDate}
                className="w-full max-w-xs border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            {detail.header.kind === "credit" ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("modal.fields.invoice_number")}
                </label>
                <input
                  type="text"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  className="input-base w-full max-w-md"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      {tTx("modals.cash_purchase.fields.vendor")}
                    </label>
                    <input
                      type="text"
                      value={editVendorName}
                      onChange={(e) => setEditVendorName(e.target.value)}
                      className="input-base w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      {tTx("modals.cash_purchase.fields.invoice_number")}
                    </label>
                    <input
                      type="text"
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      className="input-base w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    {tTx("modals.cash_purchase.fields.invoice_file_path")}
                  </label>
                  <input
                    type="text"
                    value={editInvoiceFilePath}
                    onChange={(e) => setEditInvoiceFilePath(e.target.value)}
                    className="input-base w-full"
                    placeholder={tTx(
                      "modals.cash_purchase.placeholders.invoice_file_path"
                    )}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      {tTx("modals.shared.fields.payment_method")}
                    </label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value)}
                      className="input-base w-full"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.value} value={pm.value}>
                          {tTx(pm.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      {tTx("modals.cash_purchase.fields.other_charges")}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editOtherCharges}
                      onChange={(e) => setEditOtherCharges(e.target.value)}
                      className="input-base w-full tabular-nums"
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {tTx("modals.cash_purchase.hints.other_charges")}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modal.fields.notes")}
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="input-base w-full max-w-xl"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t("modal.lines_heading")}
              </p>
              <div className="min-w-0 overflow-x-auto">
                <div className="min-w-[40rem] space-y-2">
                  <div
                    className={`grid gap-2 text-xs font-medium text-[var(--color-text-secondary)] px-1 ${
                      detail.header.kind === "cash" && gstEnabled
                        ? "grid-cols-[12rem_5rem_5rem_7rem_5rem_6rem_2.5rem]"
                        : "grid-cols-[12rem_6rem_6rem_8rem_2.5rem]"
                    }`}
                  >
                    <span>{tTx("columns.product")}</span>
                    <span>{tTx("columns.qty")}</span>
                    <span>{tTx("columns.unit")}</span>
                    <span>{tTx("columns.amount")}</span>
                    {detail.header.kind === "cash" && gstEnabled ? (
                      <>
                        <span>{tTx("modals.cash_purchase.fields.gst_percent")}</span>
                        <span>{tTx("modals.cash_purchase.fields.gst_mode")}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true" />
                  </div>
                  {editLines.map((line, idx) => {
                    const selectedItem = itemList.find(
                      (i) => i.id === line.product_id
                    );
                    const unitRows = purchaseEditUnitSelectRows(
                      selectedItem,
                      units as Unit[],
                      unitConversions as UnitConversion[],
                      line.unit
                    );
                    return (
                      <div
                        key={idx}
                        className={`grid gap-2 items-center p-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] ${
                          detail.header.kind === "cash" && gstEnabled
                            ? "grid-cols-[12rem_5rem_5rem_7rem_5rem_6rem_2.5rem]"
                            : "grid-cols-[12rem_6rem_6rem_8rem_2.5rem]"
                        }`}
                      >
                        <select
                          value={line.product_id || ""}
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            const item = itemList.find((i) => i.id === pid);
                            const itemGst =
                              (item as Item & { gst_rate?: number })
                                ?.gst_rate ?? 0;
                            setEditLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                product_id: pid,
                                unit: item?.unit ?? "",
                                ...(detail.header.kind === "cash"
                                  ? { gst_rate: itemGst }
                                  : {}),
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full min-w-0"
                        >
                          <option value="">
                            {tTx("modals.shared.placeholders.select_product")}
                          </option>
                          {itemList.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.quantity || ""}
                          onChange={(e) => {
                            const q = Number(e.target.value);
                            setEditLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                quantity: Number.isFinite(q) ? q : 0,
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full tabular-nums"
                        />
                        <select
                          value={line.unit || selectedItem?.unit || ""}
                          onChange={(e) =>
                            setEditLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                unit: e.target.value,
                              };
                              return next;
                            })
                          }
                          disabled={!selectedItem}
                          className="input-base w-full min-w-0 text-sm"
                          aria-label={tTx("columns.unit")}
                        >
                          {unitRows.map((u) => (
                            <option key={u.name} value={u.name}>
                              {unitOptionLabel(u)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.amount || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const a =
                              raw === ""
                                ? 0
                                : roundDecimal(Number(raw));
                            setEditLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                amount: Number.isFinite(a) ? a : 0,
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full tabular-nums"
                        />
                        {detail.header.kind === "cash" && gstEnabled ? (
                          <>
                            <select
                              value={line.gst_rate}
                              onChange={(e) =>
                                setEditLines((prev) => {
                                  const next = [...prev];
                                  next[idx] = {
                                    ...next[idx],
                                    gst_rate: Number(e.target.value) || 0,
                                  };
                                  return next;
                                })
                              }
                              className="input-base w-full text-sm"
                            >
                              {GST_SLABS.map((r) => (
                                <option key={r} value={r}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                            <select
                              value={
                                line.gst_inclusive ? "inclusive" : "exclusive"
                              }
                              onChange={(e) =>
                                setEditLines((prev) => {
                                  const next = [...prev];
                                  next[idx] = {
                                    ...next[idx],
                                    gst_inclusive:
                                      e.target.value === "inclusive",
                                  };
                                  return next;
                                })
                              }
                              className="input-base w-full text-sm"
                            >
                              <option value="exclusive">
                                {tTx("modals.cash_purchase.gst_modes.exclusive")}
                              </option>
                              <option value="inclusive">
                                {tTx("modals.cash_purchase.gst_modes.inclusive")}
                              </option>
                            </select>
                          </>
                        ) : null}
                        <div className="flex justify-end">
                          {editLines.length > 1 ? (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded p-1.5 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-subtle)]"
                              title={t("modal.remove_line")}
                              aria-label={t("modal.remove_line")}
                              onClick={() =>
                                setEditLines((prev) =>
                                  prev.filter((_, j) => j !== idx)
                                )
                              }
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={() =>
                  setEditLines((prev) => [...prev, emptyEditLine()])
                }
              >
                {t("modal.add_line")}
              </Button>
            </div>
          </div>
        ) : detailFetching && editOpen ? (
          <p className="text-sm text-[var(--color-text-secondary)]">…</p>
        ) : null}
      </FormModal>

      <FormModal
        title={t("settlement_modal.title")}
        open={settlementOpen}
        onClose={() => {
          if (!addSettlementMutation.isPending) {
            closeSettlement();
          }
        }}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={closeSettlement}
              disabled={addSettlementMutation.isPending}
            >
              {t("modal.cancel")}
            </Button>
            <Button
              type="button"
              variant="green"
              disabled={
                !canSubmitSettlementFromModal ||
                addSettlementMutation.isPending
              }
              onClick={() => void handleAddSettlement()}
            >
              {t("modal.add_settlement_submit")}
            </Button>
          </>
        }
      >
        {detailError && settlementOpen ? (
          <p className="text-sm text-[var(--color-danger)]">
            {t("toasts.load_failed")}
            <button
              type="button"
              className="ml-2 text-[var(--color-accent)] underline"
              onClick={() => void refetchDetail()}
            >
              Retry
            </button>
          </p>
        ) : null}
        {detailFetching && settlementOpen && !detail ? (
          <p className="text-sm text-[var(--color-text-secondary)]">…</p>
        ) : null}
        {detail && !detailError && detail.header.kind !== "credit" ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("settlement_modal.not_credit")}
          </p>
        ) : null}
        {detail && !detailError && detail.header.kind === "credit" ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                {t("settlement_modal.summary_heading")}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("settlement_modal.subtitle", {
                  date: formatDateForView(detail.header.document_date),
                  lender: settlementLenderLabel ?? "—",
                })}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-[var(--color-bg-surface-raised)] px-3 py-2.5">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("settlement_modal.stat_bill")}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    ₹{formatDecimal(savedBillTotal)}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg-surface-raised)] px-3 py-2.5">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("settlement_modal.stat_applied")}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-[var(--color-text-secondary)]">
                    ₹{formatDecimal(allocatedOnBill)}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg-surface-raised)] px-3 py-2.5">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("settlement_modal.stat_remaining")}
                  </p>
                  <p
                    className={`text-lg font-semibold tabular-nums ${
                      remainingForSettlement <= 0
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    ₹{formatDecimal(remainingForSettlement)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t("modal.allocations_heading")}
              </p>
              {detail.allocations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {t("modal.allocations_empty")}
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-[var(--color-text-tertiary)] border-b border-[var(--color-border-default)]">
                        <th className="pb-2 pr-3">
                          {t("modal.allocation_columns.date")}
                        </th>
                        <th className="pb-2 pr-3">
                          {t("modal.allocation_columns.direction")}
                        </th>
                        <th className="pb-2 pr-3 text-right tabular-nums">
                          {t("modal.allocation_columns.applied")}
                        </th>
                        <th className="pb-2">
                          {t("modal.allocation_columns.payment")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.allocations.map((a, allocIdx) => {
                        const isOut = a.direction === "out";
                        const movementTitle = t(
                          "modal.allocation_movement_total",
                          {
                            amount: formatDecimal(a.movement_amount),
                          }
                        );
                        return (
                          <tr
                            key={`${a.movement_id}-${allocIdx}`}
                            className="border-b border-[var(--color-border-default)] last:border-0"
                          >
                            <td className="py-2 pr-3 align-top">
                              <Tooltip
                                content={formatDateForForm(a.movement_date)}
                              >
                                <span>{formatDateForView(a.movement_date)}</span>
                              </Tooltip>
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <Tooltip content={movementTitle}>
                                <span>
                                  {isOut
                                    ? t("modal.allocation_direction_out")
                                    : t("modal.allocation_direction_in")}
                                </span>
                              </Tooltip>
                            </td>
                            <td className="py-2 pr-3 align-top text-right font-medium tabular-nums">
                              ₹{formatDecimal(a.allocated_amount)}
                            </td>
                            <td className="py-2 align-top text-[var(--color-text-secondary)] break-all">
                              {formatAllocationPayment(a)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {detail.header.lender_id != null && detail.header.lender_id > 0 ? (
              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t("modal.add_settlement_heading")}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                  {remainingForSettlement > 0
                    ? t("modal.add_settlement_remaining", {
                        amount: formatDecimal(remainingForSettlement),
                      })
                    : t("modal.add_settlement_none_remaining")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <div
                    className={
                      addSettlementMutation.isPending
                        ? "opacity-60 pointer-events-none"
                        : undefined
                    }
                  >
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("modal.add_settlement_date")}
                    </label>
                    <DateInput
                      value={addSettlementDate}
                      onChange={setAddSettlementDate}
                      className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                        {t("modal.add_settlement_amount")}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-xs"
                        disabled={
                          remainingForSettlement <= 0 ||
                          addSettlementMutation.isPending
                        }
                        onClick={() =>
                          setAddSettlementAmount(
                            String(remainingForSettlement)
                          )
                        }
                      >
                        {t("settlement_modal.fill_remaining")}
                      </Button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={addSettlementAmount}
                      onChange={(e) => setAddSettlementAmount(e.target.value)}
                      disabled={
                        addSettlementMutation.isPending ||
                        remainingForSettlement <= 0
                      }
                      className="input-base w-full tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="add-settlement-payment-method"
                      className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                    >
                      {tTx("modals.shared.fields.payment_method")}
                    </label>
                    <select
                      id="add-settlement-payment-method"
                      value={addSettlementPaymentMethod}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAddSettlementPaymentMethod(next);
                        if (!next) {
                          setAddSettlementReference("");
                        }
                      }}
                      disabled={
                        addSettlementMutation.isPending ||
                        remainingForSettlement <= 0
                      }
                      className="input-base w-full"
                    >
                      <option value="">
                        {tTx("modals.shared.placeholders.none")}
                      </option>
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.value} value={pm.value}>
                          {tTx(pm.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {addSettlementPaymentMethod
                    ? (() => {
                        const pm = PAYMENT_METHODS.find(
                          (p) => p.value === addSettlementPaymentMethod
                        );
                        return (
                          <div>
                            <label
                              htmlFor="add-settlement-reference"
                              className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
                            >
                              {pm
                                ? tTx(pm.refLabelKey)
                                : tTx("modals.shared.fields.reference")}
                            </label>
                            <input
                              id="add-settlement-reference"
                              type="text"
                              value={addSettlementReference}
                              onChange={(e) =>
                                setAddSettlementReference(e.target.value)
                              }
                              placeholder={
                                pm &&
                                "placeholderKey" in pm &&
                                pm.placeholderKey
                                  ? tTx(pm.placeholderKey)
                                  : undefined
                              }
                              disabled={
                                addSettlementMutation.isPending ||
                                remainingForSettlement <= 0
                              }
                              className="input-base w-full"
                            />
                          </div>
                        );
                      })()
                    : null}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("modal.add_settlement_notes")}
                    </label>
                    <textarea
                      value={addSettlementNotes}
                      onChange={(e) => setAddSettlementNotes(e.target.value)}
                      disabled={
                        addSettlementMutation.isPending ||
                        remainingForSettlement <= 0
                      }
                      rows={2}
                      className="input-base w-full"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </FormModal>
    </div>
  );
}
