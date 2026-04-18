import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Pencil, Wallet } from "lucide-react";
import { getElectron } from "../api/client";
import { PAGE_SIZE } from "../../shared/constants";
import DateInput from "../components/DateInput";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import type {
  Item,
  Lender,
  SupplierPurchaseAllocationSummary,
  SupplierPurchasePageRow,
} from "../../shared/types";
import { formatDecimal, roundDecimal } from "../../shared/numbers";
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

interface EditLine {
  product_id: number;
  quantity: number;
  amount: number;
}

function emptyEditLine(): EditLine {
  return { product_id: 0, quantity: 0, amount: 0 };
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

export default function Purchases() {
  const { t } = useTranslation("purchases");
  const { t: tTx } = useTranslation("transactions");
  const api = getElectron();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [filterKind, setFilterKind] = useState<"" | "credit" | "cash">("");
  const [filterLenderId, setFilterLenderId] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLenderId, setEditLenderId] = useState(0);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
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

  const { data: lenders = [] } = useQuery({
    queryKey: ["lenders"],
    queryFn: () => api.getLenders(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const itemList = useMemo(() => items as Item[], [items]);

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
    setEditLines(
      detail.lines.length
        ? detail.lines.map((ln) => ({
            product_id: ln.product_id,
            quantity: ln.quantity,
            amount: ln.amount,
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
    const lines = editLines
      .map((ln, idx) => {
        const orig = detail.lines[idx];
        return {
          product_id: ln.product_id,
          quantity: ln.quantity,
          amount: ln.amount,
          gst_rate: orig?.gst_rate ?? 0,
          gst_inclusive: orig?.gst_inclusive ?? false,
          taxable_amount: orig?.taxable_amount ?? ln.amount,
          cgst_amount: orig?.cgst_amount ?? 0,
          sgst_amount: orig?.sgst_amount ?? 0,
        };
      })
      .filter(
        (ln) =>
          ln.product_id > 0 &&
          ln.quantity > 0 &&
          Number.isFinite(ln.amount) &&
          ln.amount >= 0
      );
    if (!lines.length) {
      toast.error(tTx("modals.cash_purchase.toasts.add_one_item"));
      return;
    }
    if (detail.header.kind === "credit" && (!editLenderId || editLenderId <= 0)) {
      toast.error(t("toasts.save_failed"));
      return;
    }
    updateMutation.mutate({
      transaction_date: editDate,
      notes: editNotes.trim() || null,
      lender_invoice_number:
        detail.header.kind === "credit"
          ? editInvoiceNumber.trim() || null
          : null,
      ...(detail.header.kind === "credit" ? { lender_id: editLenderId } : {}),
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

  return (
    <div className="min-h-0 flex flex-col gap-4 p-4 md:p-6">
      <SalesListHero title={t("title")} metrics={[]} actions={null} />
      <p className="text-sm text-[var(--color-text-secondary)] -mt-2 px-1">
        {t("subtitle")}
      </p>

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
        <SalesListSectionPanel title={t("title")}>
          <div className="flex flex-wrap items-end gap-3 p-3 border-b border-[var(--color-border-default)]">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.kind")}
              </label>
              <select
                value={filterKind}
                onChange={(e) =>
                  setFilterKind(e.target.value as "" | "credit" | "cash")
                }
                className="input-base min-w-[10rem]"
              >
                <option value="">{t("filters.kind_all")}</option>
                <option value="credit">{t("filters.kind_credit")}</option>
                <option value="cash">{t("filters.kind_cash")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.lender")}
              </label>
              <select
                value={filterLenderId}
                onChange={(e) => setFilterLenderId(e.target.value)}
                className="input-base min-w-[12rem]"
              >
                <option value="">{t("filters.lender_all")}</option>
                {(lenders as Lender[]).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.date_from")}
              </label>
              <DateInput
                value={filterDateFrom}
                onChange={setFilterDateFrom}
                className="w-full min-w-[10rem] border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("filters.date_to")}
              </label>
              <DateInput
                value={filterDateTo}
                onChange={setFilterDateTo}
                className="w-full min-w-[10rem] border border-[var(--color-border-strong)] rounded px-3 py-2"
              />
            </div>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              {t("filters.clear")}
            </Button>
          </div>

          <div className="mt-2">
            <SalesListAsyncPanel
              isLoading={listLoading}
              isError={listError}
              onRetry={() => {
                void refetchList();
              }}
              isEmpty={!listLoading && rows.length === 0}
              emptyTitle={t("empty.title")}
              emptyDescription={t("empty.description")}
              emptyActionLabel={t("filters.clear")}
              onEmptyAction={clearFilters}
              loaderColumns={9}
            >
              <DataTable<SupplierPurchasePageRow>
                scrollMaxHeight={`calc(100vh - 22rem)`}
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
            ) : null}
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
                <div className="min-w-[32rem] space-y-2">
                  <div className="grid grid-cols-[12rem_6rem_8rem_2.5rem] gap-2 text-xs font-medium text-[var(--color-text-secondary)] px-1">
                    <span>{tTx("columns.product")}</span>
                    <span>{tTx("columns.qty")}</span>
                    <span>{tTx("columns.amount")}</span>
                    <span aria-hidden="true" />
                  </div>
                  {editLines.map((line, idx) => {
                    const selectedItem = itemList.find(
                      (i) => i.id === line.product_id
                    );
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[12rem_6rem_8rem_2.5rem] gap-2 items-center p-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
                      >
                        <select
                          value={line.product_id || ""}
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            setEditLines((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], product_id: pid };
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
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={line.amount || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const a =
                              raw === ""
                                ? 0
                                : Math.floor(Number(raw));
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
                        <div className="flex justify-end">
                          {editLines.length > 1 ? (
                            <button
                              type="button"
                              className="text-xs text-[var(--color-danger)] hover:underline"
                              onClick={() =>
                                setEditLines((prev) =>
                                  prev.filter((_, j) => j !== idx)
                                )
                              }
                            >
                              {t("modal.remove_line")}
                            </button>
                          ) : null}
                        </div>
                        {selectedItem ? (
                          <p className="col-span-full text-xs text-[var(--color-text-tertiary)]">
                            {tTx("columns.unit")}: {selectedItem.unit}
                          </p>
                        ) : null}
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
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("modal.add_settlement_payment_method")}
                    </label>
                    <input
                      type="text"
                      value={addSettlementPaymentMethod}
                      onChange={(e) =>
                        setAddSettlementPaymentMethod(e.target.value)
                      }
                      disabled={
                        addSettlementMutation.isPending ||
                        remainingForSettlement <= 0
                      }
                      className="input-base w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("modal.add_settlement_reference")}
                    </label>
                    <input
                      type="text"
                      value={addSettlementReference}
                      onChange={(e) =>
                        setAddSettlementReference(e.target.value)
                      }
                      disabled={
                        addSettlementMutation.isPending ||
                        remainingForSettlement <= 0
                      }
                      className="input-base w-full"
                    />
                  </div>
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
