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
import { formatDecimal, roundDecimal } from "../../shared/numbers";
import { computeLineGst, GST_SLABS } from "../../shared/gst";

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
  gst_rate: number;
  gst_inclusive: boolean;
}

const PAYMENT_METHODS = [
  {
    value: "cash",
    labelKey: "modals.shared.payment_methods.cash.label",
  },
  {
    value: "bank",
    labelKey: "modals.shared.payment_methods.bank.label",
  },
  {
    value: "upi",
    labelKey: "modals.shared.payment_methods.upi.label",
  },
  {
    value: "cheque",
    labelKey: "modals.shared.payment_methods.cheque.label",
  },
] as const;

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
    gst_rate: 0,
    gst_inclusive: false,
  };
}

function lineDisplayTotalRupees(
  line: PurchaseLine,
  gstEnabled: boolean
): number {
  const rate = gstEnabled ? line.gst_rate : 0;
  if (rate > 0) {
    return roundDecimal(
      computeLineGst(line.amount, rate, line.gst_inclusive).total_amount
    );
  }
  return roundDecimal(line.amount);
}

interface CashPurchaseEntryModalsProps {
  open: boolean;
  onClose: () => void;
  /** Stable ids for the entry vs confirm dialogs (see `shared/test-ids`). */
  modalTestIds: { entry: string; confirm: string };
}

export function CashPurchaseEntryModals({
  open,
  onClose,
  modalTestIds,
}: Readonly<CashPurchaseEntryModalsProps>) {
  const { t } = useTranslation("transactions");
  const queryClient = useQueryClient();
  const api = getElectron();

  const [purchaseFormDate, setPurchaseFormDate] = useState(todayISO());
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([
    emptyPurchaseLine(),
  ]);
  const [vendorName, setVendorName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [headerInvoiceNumber, setHeaderInvoiceNumber] = useState("");
  const [headerInvoiceFilePath, setHeaderInvoiceFilePath] = useState("");
  const [otherChargesInput, setOtherChargesInput] = useState("");

  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [confirmPurchasePayload, setConfirmPurchasePayload] = useState<{
    transaction_date: string;
    notes: string;
    vendor_name: string;
    payment_method: string;
    lender_invoice_number: string;
    invoice_file_path: string;
    other_charges: number;
    lines: PurchaseLine[];
  } | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: open || confirmPurchaseOpen,
  });
  const gstEnabled =
    (settings as Record<string, string>).gst_enabled === "true";

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
      queueMicrotask(() => {
        setPurchaseFormDate(todayISO());
        setPurchaseLines([emptyPurchaseLine()]);
        setVendorName("");
        setPaymentMethod("cash");
        setHeaderInvoiceNumber("");
        setHeaderInvoiceFilePath("");
        setOtherChargesInput("");
      });
    } else {
      setConfirmPurchaseOpen(false);
      setConfirmPurchasePayload(null);
    }
  }, [open]);

  const createPurchaseBatch = useMutation({
    mutationFn: (payload: {
      transaction_date: string;
      notes?: string;
      vendor_name?: string | null;
      payment_method?: string | null;
      other_charges?: number;
      lender_invoice_number?: string | null;
      invoice_file_path?: string | null;
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
            gst_rate: l.gst_rate,
            gst_inclusive: l.gst_inclusive,
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
          gst_rate: l.gst_rate,
          gst_inclusive: l.gst_inclusive,
        };
      });
      return api.createPurchaseBatch({
        transaction_date: payload.transaction_date,
        notes: payload.notes,
        vendor_name: payload.vendor_name,
        payment_method: payload.payment_method,
        other_charges: payload.other_charges,
        lender_invoice_number: payload.lender_invoice_number,
        invoice_file_path: payload.invoice_file_path,
        lines: linesApi,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchasesPage"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPurchaseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      setLedgerUpdatesAvailable(true);
      setConfirmPurchaseOpen(false);
      setConfirmPurchasePayload(null);
      setPurchaseLines([emptyPurchaseLine()]);
      setVendorName("");
      setPaymentMethod("cash");
      setHeaderInvoiceNumber("");
      setHeaderInvoiceFilePath("");
      setOtherChargesInput("");
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

  const lineGridClass = gstEnabled
    ? "grid-cols-[12rem_5rem_6rem_7rem_5rem_6rem_2.5rem]"
    : "grid-cols-[12rem_6rem_6rem_8rem_2.5rem]";
  const headerGridClass = gstEnabled
    ? "grid grid-cols-[12rem_5rem_6rem_7rem_5rem_6rem_2.5rem] gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1"
    : "grid grid-cols-[12rem_6rem_6rem_8rem_2.5rem] gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1";

  return (
    <>
      <FormModal
        title={t("modals.cash_purchase.title")}
        open={open && !confirmPurchaseOpen}
        onClose={() => {
          if (!createPurchaseBatch.isPending) {
            setPurchaseLines([emptyPurchaseLine()]);
            setVendorName("");
            setPaymentMethod("cash");
            setHeaderInvoiceNumber("");
            setHeaderInvoiceFilePath("");
            setOtherChargesInput("");
            onClose();
          }
        }}
        maxWidth="max-w-4xl"
        testId={modalTestIds.entry}
        footer={
          <>
            <Button
              type="submit"
              form="cash-purchase-entry-form"
              variant="primary"
              testId={`${modalTestIds.entry}-review-submit`}
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
            const ocRaw = otherChargesInput.trim().replace(/,/g, "");
            const ocParsed = ocRaw === "" ? 0 : Number(ocRaw);
            if (!Number.isFinite(ocParsed) || ocParsed < 0) {
              toast.error(t("modals.cash_purchase.toasts.other_charges_invalid"));
              return;
            }
            const other_charges = roundDecimal(ocParsed);

            const lines: PurchaseLine[] = [];
            for (const line of purchaseLines) {
              if (!(line.product_id > 0 && line.quantity > 0)) {
                continue;
              }
              if (!Number.isFinite(line.amount) || line.amount < 0) {
                continue;
              }
              const item = itemList.find((i) => i.id === line.product_id);
              const quantityUnit = line.quantity_unit || item?.unit || "";
              lines.push({
                ...line,
                product_name: item?.name ?? "",
                quantity_unit: quantityUnit,
              });
            }
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
              vendor_name: vendorName.trim(),
              payment_method: paymentMethod.trim() || "cash",
              lender_invoice_number: headerInvoiceNumber.trim(),
              invoice_file_path: headerInvoiceFilePath.trim(),
              other_charges,
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.cash_purchase.fields.vendor")}
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full border rounded px-3 py-2 input-base"
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.cash_purchase.fields.invoice_number")}
              </label>
              <input
                type="text"
                value={headerInvoiceNumber}
                onChange={(e) => setHeaderInvoiceNumber(e.target.value)}
                className="w-full border rounded px-3 py-2 input-base"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.cash_purchase.fields.invoice_file_path")}
              </label>
              <input
                type="text"
                value={headerInvoiceFilePath}
                onChange={(e) => setHeaderInvoiceFilePath(e.target.value)}
                className="w-full border rounded px-3 py-2 input-base"
                placeholder={t(
                  "modals.cash_purchase.placeholders.invoice_file_path"
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.shared.fields.payment_method")}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border rounded px-3 py-2 input-base"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {t(pm.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.cash_purchase.fields.other_charges")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={otherChargesInput}
                onChange={(e) => setOtherChargesInput(e.target.value)}
                className="w-full border rounded px-3 py-2 input-base tabular-nums"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t("modals.cash_purchase.hints.other_charges")}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[32rem]">
                {purchaseLines.length > 0 && (
                  <div className={headerGridClass}>
                    <span>{t("columns.product")}</span>
                    <span>{t("columns.qty")}</span>
                    <span>{t("columns.unit")}</span>
                    <span>{t("columns.amount")}</span>
                    {gstEnabled ? (
                      <>
                        <span>{t("modals.cash_purchase.fields.gst_percent")}</span>
                        <span>{t("modals.cash_purchase.fields.gst_mode")}</span>
                      </>
                    ) : null}
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
                        className={`grid ${lineGridClass} gap-3 items-center p-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm`}
                      >
                        <select
                          name={`product_id_${idx}`}
                          required={idx === 0}
                          value={line.product_id || ""}
                          data-testid={`${modalTestIds.entry}-line-${idx}-product`}
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            const item = itemList.find((i) => i.id === pid);
                            const itemGst =
                              (item as Item & { gst_rate?: number })?.gst_rate ??
                              0;
                            setPurchaseLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                product_id: pid,
                                product_name: item?.name ?? "",
                                quantity_unit: item?.unit ?? "",
                                gst_rate: itemGst,
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
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          required={idx === 0}
                          placeholder={t("modals.shared.placeholders.zero")}
                          value={line.amount === 0 ? "" : line.amount}
                          onChange={(e) =>
                            setPurchaseLines((prev) => {
                              const n = [...prev];
                              const raw = e.target.value;
                              const val =
                                raw === "" ? 0 : roundDecimal(Number(raw));
                              n[idx] = {
                                ...n[idx],
                                amount: Number.isFinite(val) ? val : 0,
                              };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label={t("columns.amount")}
                        />
                        {gstEnabled ? (
                          <>
                            <select
                              value={line.gst_rate}
                              onChange={(e) =>
                                setPurchaseLines((prev) => {
                                  const n = [...prev];
                                  n[idx] = {
                                    ...n[idx],
                                    gst_rate: Number(e.target.value) || 0,
                                  };
                                  return n;
                                })
                              }
                              className="input-base w-full text-sm"
                              aria-label={t(
                                "modals.cash_purchase.fields.gst_percent"
                              )}
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
                                setPurchaseLines((prev) => {
                                  const n = [...prev];
                                  n[idx] = {
                                    ...n[idx],
                                    gst_inclusive:
                                      e.target.value === "inclusive",
                                  };
                                  return n;
                                })
                              }
                              className="input-base w-full text-sm"
                              aria-label={t(
                                "modals.cash_purchase.fields.gst_mode"
                              )}
                            >
                              <option value="exclusive">
                                {t("modals.cash_purchase.gst_modes.exclusive")}
                              </option>
                              <option value="inclusive">
                                {t("modals.cash_purchase.gst_modes.inclusive")}
                              </option>
                            </select>
                          </>
                        ) : null}
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
                  testId={`${modalTestIds.entry}-add-line`}
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
        testId={modalTestIds.confirm}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmPurchaseOpen(false);
                setConfirmPurchasePayload(null);
              }}
              testId={`${modalTestIds.confirm}-back`}
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
                  vendor_name:
                    confirmPurchasePayload.vendor_name.trim() || null,
                  payment_method:
                    confirmPurchasePayload.payment_method.trim() || "cash",
                  other_charges: confirmPurchasePayload.other_charges,
                  lender_invoice_number:
                    confirmPurchasePayload.lender_invoice_number.trim() ||
                    null,
                  invoice_file_path:
                    confirmPurchasePayload.invoice_file_path.trim() || null,
                  lines: confirmPurchasePayload.lines,
                  globalConversionRows,
                });
              }}
              disabled={
                createPurchaseBatch.isPending || !confirmPurchasePayload
              }
              testId={`${modalTestIds.confirm}-save`}
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
              {confirmPurchasePayload.vendor_name.trim()
                ? ` · ${confirmPurchasePayload.vendor_name.trim()}`
                : ""}
              {confirmPurchasePayload.notes
                ? ` — ${confirmPurchasePayload.notes}`
                : ""}
            </p>
            <DataTable<CashPurchasePreviewRow>
              scrollMaxHeight="15rem"
              tableClassName="min-w-full text-sm border-collapse"
              rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
              columns={cashPurchasePreviewColumns}
              testIdPrefix={`${modalTestIds.confirm}-preview`}
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
                const lineTot = lineDisplayTotalRupees(line, gstEnabled);
                return {
                  id: idx + 1,
                  product: line.product_name || item?.name || "—",
                  oldStock,
                  qty: primaryQty,
                  totalAfter: oldStock + primaryQty,
                  amountDisplay: `₹${formatDecimal(lineTot)}`,
                };
              })}
              pagination={{ type: "client" }}
              tableFrame={false}
            />
            {confirmPurchasePayload.other_charges > 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("modals.cash_purchase.messages.other_charges_label")}: ₹
                {formatDecimal(confirmPurchasePayload.other_charges)}
              </p>
            ) : null}
            <p className="text-sm font-medium">
              {t("modals.cash_purchase.messages.grand_total")}: ₹
              {formatDecimal(
                confirmPurchasePayload.lines.reduce(
                  (s, l) => s + lineDisplayTotalRupees(l, gstEnabled),
                  0
                ) + confirmPurchasePayload.other_charges
              )}
            </p>
          </div>
        )}
      </FormModal>
    </>
  );
}
