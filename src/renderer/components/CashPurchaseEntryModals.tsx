import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import Button from "./Button";
import DateInput from "./DateInput";
import DataTable from "./DataTable";
import Tooltip from "./Tooltip";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import type { Item, Unit, UnitConversion } from "../../shared/types";
import { convertToPrimaryQuantity } from "../../shared/unitConversion";
import { getItemCatalogUnitsAsc } from "../../shared/itemCatalogUnits";
import { formatDecimal } from "../../shared/numbers";

type ItemWithUnitGraph = Item & {
  other_units?: { unit: string; sort_order: number }[];
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

interface PurchaseLine {
  product_id: number;
  product_name: string;
  quantity: number;
  quantity_unit: string;
  amount: number;
}

interface CashPurchasePreviewRow {
  id: number;
  product: string;
  oldStock: number;
  qty: number;
  totalAfter: number;
  amountDisplay: string;
}

function unitOptionLabel(u: Unit): string {
  return (u.symbol && u.symbol.trim()) || u.name;
}

function emptyPurchaseLine(): PurchaseLine {
  return {
    product_id: 0,
    product_name: "",
    quantity: 0,
    quantity_unit: "",
    amount: 0,
  };
}

interface CashPurchaseEntryModalsProps {
  open: boolean;
  onClose: () => void;
}

export function CashPurchaseEntryModals({
  open,
  onClose,
}: Readonly<CashPurchaseEntryModalsProps>) {
  const { t } = useTranslation("transactions");
  const queryClient = useQueryClient();
  const api = getElectron();

  const [purchaseFormDate, setPurchaseFormDate] = useState(todayISO());
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    emptyPurchaseLine(),
  ]);
  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [confirmPurchasePayload, setConfirmPurchasePayload] = useState<{
    transaction_date: string;
    notes: string;
    lines: PurchaseLine[];
  } | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits(),
    enabled: open || confirmPurchaseOpen,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions(),
    enabled: open || confirmPurchaseOpen,
  });

  const globalConversionRows = useMemo(
    () =>
      (unitConversions as UnitConversion[]).map((c) => ({
        from_unit: c.from_unit,
        to_unit: c.to_unit,
        factor: c.factor,
      })),
    [unitConversions]
  );

  const itemList = items as ItemWithUnitGraph[];

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setPurchaseFormDate(todayISO()));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setConfirmPurchaseOpen(false);
      setConfirmPurchasePayload(null);
      setPurchaseLines([emptyPurchaseLine()]);
    }
  }, [open]);

  const createPurchaseBatch = useMutation({
    mutationFn: (payload: {
      transaction_date: string;
      notes?: string;
      lines: PurchaseLine[];
      globalConversionRows: {
        from_unit: string;
        to_unit: string;
        factor: number;
      }[];
    }) => {
      const linesApi = payload.lines.map((l) => {
        const item = itemList.find((i) => i.id === l.product_id);
        if (!item) {
          return {
            product_id: l.product_id,
            quantity: l.quantity,
            amount: l.amount,
          };
        }
        const fromUnit = (l.quantity_unit || item.unit).trim();
        const conv = convertToPrimaryQuantity(
          payload.globalConversionRows,
          {
            unit: item.unit,
            reference_unit: item.reference_unit,
            quantity_per_primary: item.quantity_per_primary,
            item_conversions: item.item_unit_conversions,
          },
          l.quantity,
          fromUnit
        );
        if ("error" in conv) {
          throw new Error(conv.error);
        }
        return {
          product_id: l.product_id,
          quantity: conv.primaryQuantity,
          amount: l.amount,
        };
      });
      return api.createPurchaseBatch({
        transaction_date: payload.transaction_date,
        notes: payload.notes,
        lines: linesApi,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setLedgerUpdatesAvailable(true);
      setConfirmPurchaseOpen(false);
      setConfirmPurchasePayload(null);
      setPurchaseLines([emptyPurchaseLine()]);
      toast.success(t("toasts.cash_purchases_saved"));
      onClose();
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("toasts.cash_purchases_save_failed")),
  });

  const cashPurchasePreviewColumns = useMemo(
    () => [
      { key: "product", label: String(t("columns.product")) },
      {
        key: "oldStock",
        label: String(t("preview.old_stock")),
        align: "right" as const,
        render: (r: CashPurchasePreviewRow) => (
          <span className="tabular-nums">{r.oldStock}</span>
        ),
      },
      {
        key: "qty",
        label: String(t("columns.qty")),
        align: "right" as const,
        render: (r: CashPurchasePreviewRow) => (
          <span className="tabular-nums">{r.qty}</span>
        ),
      },
      {
        key: "totalAfter",
        label: String(t("preview.total_after")),
        align: "right" as const,
        render: (r: CashPurchasePreviewRow) => (
          <span className="tabular-nums">{r.totalAfter}</span>
        ),
      },
      {
        key: "amountDisplay",
        label: String(t("columns.amount_inr")),
        align: "right" as const,
        render: (r: CashPurchasePreviewRow) => (
          <span className="tabular-nums">{r.amountDisplay}</span>
        ),
      },
    ],
    [t]
  );

  return (
    <>
      <FormModal
        title={t("modals.cash_purchase.title")}
        open={open && !confirmPurchaseOpen}
        onClose={() => {
          if (!createPurchaseBatch.isPending) {
            setPurchaseLines([emptyPurchaseLine()]);
            onClose();
          }
        }}
        maxWidth="max-w-4xl"
        footer={
          <>
            <Button
              type="submit"
              form="cash-purchase-entry-form"
              variant="primary"
            >
              {t("modals.shared.actions.review_confirm")}
            </Button>
          </>
        }
      >
        <form
          id="cash-purchase-entry-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            if (!purchaseFormDate) {
              return;
            }
            const notes = (form.notes as HTMLInputElement).value?.trim() || "";
            const lines: PurchaseLine[] = purchaseLines
              .map((line, idx) => {
                const productId = Number(
                  (form[`product_id_${idx}`] as HTMLSelectElement)?.value
                );
                const quantity = Number(
                  (form[`quantity_${idx}`] as HTMLInputElement)?.value
                );
                const amountRaw = (form[`amount_${idx}`] as HTMLInputElement)
                  ?.value;
                const amount =
                  amountRaw !== "" && amountRaw != null
                    ? Math.floor(Number(amountRaw))
                    : Number.NaN;
                const item = itemList.find((i) => i.id === productId);
                const quantityUnit = line.quantity_unit || item?.unit || "";
                return productId &&
                  quantity > 0 &&
                  Number.isFinite(amount) &&
                  amount >= 0
                  ? {
                      product_id: productId,
                      product_name: item?.name ?? "",
                      quantity,
                      quantity_unit: quantityUnit,
                      amount,
                    }
                  : null;
              })
              .filter((l): l is PurchaseLine => l != null);
            if (!lines.length) {
              toast.error(t("modals.cash_purchase.toasts.add_one_item"));
              return;
            }
            for (const line of lines) {
              const item = itemList.find((i) => i.id === line.product_id);
              if (!item) {
                continue;
              }
              const fromUnit = (line.quantity_unit || item.unit).trim();
              const conv = convertToPrimaryQuantity(
                globalConversionRows,
                {
                  unit: item.unit,
                  reference_unit: item.reference_unit,
                  quantity_per_primary: item.quantity_per_primary,
                  item_conversions: item.item_unit_conversions,
                },
                line.quantity,
                fromUnit
              );
              if ("error" in conv) {
                toast.error(conv.error);
                return;
              }
            }
            setConfirmPurchasePayload({
              transaction_date: purchaseFormDate,
              notes,
              lines,
            });
            setConfirmPurchaseOpen(true);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("modals.shared.fields.date_required")}
            </label>
            <DateInput
              value={purchaseFormDate}
              onChange={setPurchaseFormDate}
              className="w-full border border-[var(--color-border-strong)] rounded px-3 py-2"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[32rem]">
                {purchaseLines.length > 0 && (
                  <div className="grid grid-cols-[12rem_6rem_6rem_8rem_2.5rem] gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1">
                    <span>{t("columns.product")}</span>
                    <span>{t("columns.qty")}</span>
                    <span>{t("columns.unit")}</span>
                    <span>{t("columns.amount")}</span>
                    <span aria-hidden="true" />
                  </div>
                )}
                <div className="space-y-3">
                  {purchaseLines.map((line, idx) => {
                    const selectedItem = line.product_id
                      ? itemList.find((i) => i.id === line.product_id)
                      : undefined;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[12rem_6rem_6rem_8rem_2.5rem] gap-3 items-center p-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm"
                      >
                        <select
                          name={`product_id_${idx}`}
                          required={idx === 0}
                          value={line.product_id || ""}
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            const item = itemList.find((i) => i.id === pid);
                            setPurchaseLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                product_id: pid,
                                product_name: item?.name ?? "",
                                quantity_unit: item?.unit ?? "",
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full min-w-0"
                          aria-label={t("columns.product")}
                        >
                          <option value="">
                            {t("modals.shared.placeholders.select_product")}
                          </option>
                          {itemList.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name={`quantity_${idx}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          placeholder={t("modals.shared.placeholders.zero")}
                          value={line.quantity === 0 ? "" : line.quantity}
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              n[idx] = {
                                ...n[idx],
                                quantity: Number(e.target.value) || 0,
                              };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label={
                            line.quantity_unit || selectedItem?.unit
                              ? `Quantity (${line.quantity_unit || selectedItem?.unit})`
                              : t("modals.shared.fields.quantity")
                          }
                        />
                        <select
                          value={
                            line.quantity_unit || selectedItem?.unit || ""
                          }
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              n[idx] = {
                                ...n[idx],
                                quantity_unit: e.target.value,
                              };
                              return n;
                            })
                          }
                          disabled={!selectedItem}
                          className="input-base w-full min-w-0 text-sm"
                          aria-label={t("columns.unit")}
                        >
                          {selectedItem
                            ? (() => {
                                const opts = getItemCatalogUnitsAsc(
                                  selectedItem,
                                  units as Unit[],
                                  unitConversions as UnitConversion[],
                                  selectedItem.unit
                                );
                                if (opts.length > 0) {
                                  return opts.map((u) => (
                                    <option key={u.id} value={u.name}>
                                      {unitOptionLabel(u)}
                                    </option>
                                  ));
                                }
                                return (
                                  <option
                                    key={selectedItem.unit}
                                    value={selectedItem.unit}
                                  >
                                    {selectedItem.unit}
                                  </option>
                                );
                              })()
                            : null}
                        </select>
                        <input
                          name={`amount_${idx}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          required={idx === 0}
                          placeholder={t("modals.shared.placeholders.zero")}
                          value={line.amount === 0 ? "" : line.amount}
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              const val =
                                Math.floor(Number(e.target.value)) || 0;
                              n[idx] = { ...n[idx], amount: val };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label={t("columns.amount")}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseLines((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] text-xs font-medium py-1.5 px-2 rounded transition-colors inline-flex items-center gap-1 disabled:invisible"
                          aria-label={t("modals.shared.actions.remove_line")}
                          disabled={purchaseLines.length <= 1}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPurchaseLines((prev) => [...prev, emptyPurchaseLine()])
                  }
                  className="mt-3 !text-[var(--color-accent)] hover:!text-[var(--color-accent)] hover:!bg-transparent focus:outline-none focus:ring-0"
                >
                  <Plus size={20} className="mr-1.5" aria-hidden="true" />
                  {t("modals.shared.actions.add_item")}
                </Button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("columns.notes")}
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
        </form>
      </FormModal>

      <FormModal
        title={t("modals.cash_purchase.confirm_title")}
        open={confirmPurchaseOpen}
        onClose={() => {
          setConfirmPurchaseOpen(false);
          setConfirmPurchasePayload(null);
        }}
        maxWidth="max-w-4xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmPurchaseOpen(false);
                setConfirmPurchasePayload(null);
              }}
            >
              {t("modals.shared.actions.back")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!confirmPurchasePayload) {
                  return;
                }
                createPurchaseBatch.mutate({
                  transaction_date: confirmPurchasePayload.transaction_date,
                  notes: confirmPurchasePayload.notes || undefined,
                  lines: confirmPurchasePayload.lines,
                  globalConversionRows,
                });
              }}
              disabled={
                createPurchaseBatch.isPending || !confirmPurchasePayload
              }
            >
              {createPurchaseBatch.isPending
                ? t("modals.shared.actions.saving")
                : t("modals.shared.actions.confirm")}
            </Button>
          </>
        }
      >
        {confirmPurchasePayload && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("modals.cash_purchase.messages.on_date")}{" "}
              <Tooltip
                content={formatDateForForm(
                  confirmPurchasePayload.transaction_date
                )}
              >
                <strong>
                  {formatDateForView(confirmPurchasePayload.transaction_date)}
                </strong>
              </Tooltip>
              {confirmPurchasePayload.notes
                ? ` — ${confirmPurchasePayload.notes}`
                : ""}
            </p>
            <DataTable<CashPurchasePreviewRow>
              scrollMaxHeight="15rem"
              tableClassName="min-w-full text-sm border-collapse"
              rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
              columns={cashPurchasePreviewColumns}
              data={confirmPurchasePayload.lines.map((line, idx) => {
                const item = itemList.find((i) => i.id === line.product_id);
                const oldStock = item?.current_stock ?? 0;
                const fromUnit = (line.quantity_unit || item?.unit || "").trim();
                const conv =
                  item && fromUnit
                    ? convertToPrimaryQuantity(
                        globalConversionRows,
                        {
                          unit: item.unit,
                          reference_unit: item.reference_unit,
                          quantity_per_primary: item.quantity_per_primary,
                          item_conversions: item.item_unit_conversions,
                        },
                        line.quantity,
                        fromUnit
                      )
                    : { primaryQuantity: line.quantity };
                const primaryQty =
                  "error" in conv ? line.quantity : conv.primaryQuantity;
                return {
                  id: idx + 1,
                  product: line.product_name || item?.name || "—",
                  oldStock,
                  qty: primaryQty,
                  totalAfter: oldStock + primaryQty,
                  amountDisplay: `₹${formatDecimal(line.amount)}`,
                };
              })}
              pagination={{ type: "client" }}
              tableFrame={false}
            />
            <p className="text-sm font-medium">
              {t("modals.cash_purchase.messages.total_amount")}: ₹
              {formatDecimal(
                confirmPurchasePayload.lines.reduce((s, l) => s + l.amount, 0)
              )}
            </p>
          </div>
        )}
      </FormModal>
    </>
  );
}
