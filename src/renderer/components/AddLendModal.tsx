import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import { OptionSelectButton } from "./OptionSelectButton";
import DateInput from "./DateInput";
import Tooltip from "./Tooltip";
import MahajanBalanceCard from "./MahajanBalanceCard";
import { ClipboardCheck, FileUp, X, Plus, Trash2 } from "lucide-react";
import Button from "./Button";
import DataTable from "./DataTable";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import type { Item, Unit, UnitConversion } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";
import { computeLineGst, GST_SLABS } from "../../shared/gst";
import { convertToPrimaryQuantity } from "../../shared/unitConversion";
import { getItemCatalogUnitsAsc } from "../../shared/itemCatalogUnits";

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

type ItemWithUnitGraph = Item & {
  other_units?: { unit: string; sort_order: number }[];
  item_unit_conversions?: { to_unit: string; factor: number }[];
};

function unitOptionLabel(u: Unit): string {
  return (u.symbol && u.symbol.trim()) || u.name;
}

export type LendLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  /** Quantity entered in this unit; defaults to item primary (stock) unit. */
  quantity_unit: string;
  amount: number;
  gst_rate: number;
  gst_inclusive: boolean;
};

interface LendConfirmPreviewRow {
  id: number;
  productLabel: string;
  oldStock: number;
  quantity: number;
  after: number;
}

const emptyLine = (): LendLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
  quantity_unit: "",
  amount: 0,
  gst_rate: 0,
  gst_inclusive: false,
});

export interface AddLendModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, mahajan selector is hidden and this mahajan is used. */
  fixedMahajanId?: number;
  /** Display name for confirm step when fixedMahajanId is set. */
  fixedMahajanName?: string;
}

export default function AddLendModal({
  open,
  onClose,
  fixedMahajanId,
  fixedMahajanName = "",
}: AddLendModalProps) {
  const { t } = useTranslation("transactions");
  const queryClient = useQueryClient();
  const api = getElectron();
  const [lendLines, setLendLines] = useState<LendLine[]>([emptyLine()]);
  const [selectedLenderId, setSelectedLenderId] = useState<number | null>(null);
  const [lendFormDate, setLendFormDate] = useState(todayISO());
  const [lenderInvoiceNumber, setLenderInvoiceNumber] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [payNowAmount, setPayNowAmount] = useState(0);
  const [payNowPaymentMethod, setPayNowPaymentMethod] = useState("");
  const [payNowReferenceNumber, setPayNowReferenceNumber] = useState("");
  const [confirmLendOpen, setConfirmLendOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    mahajan_id: number;
    mahajanName: string;
    transaction_date: string;
    notes: string;
    lender_invoice_number: string;
    invoice_file: File | null;
    pay_now_amount: number;
    pay_now_payment_method: string;
    pay_now_reference_number: string;
    lines: LendLine[];
  } | null>(null);

  useEffect(() => {
    if (open) queueMicrotask(() => setLendFormDate(todayISO()));
  }, [open]);
  useEffect(() => {
    if (open) {
      queueMicrotask(() => setLendLines([emptyLine()]));
      queueMicrotask(() => setLenderInvoiceNumber(""));
      queueMicrotask(() => setInvoiceFile(null));
      queueMicrotask(() => setPayNowAmount(0));
      queueMicrotask(() => setPayNowPaymentMethod(""));
      queueMicrotask(() => setPayNowReferenceNumber(""));
      queueMicrotask(() => setSelectedLenderId(fixedMahajanId ?? null));
    }
  }, [open, fixedMahajanId]);

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: open,
  });
  const gstEnabled =
    (settings as Record<string, string>).gst_enabled === "true";

  const { data: mahajans = [] } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
    enabled: open && fixedMahajanId == null,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
    enabled: open,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.getUnits(),
    enabled: open,
  });

  const { data: unitConversions = [] } = useQuery({
    queryKey: ["unitConversions"],
    queryFn: () => api.getUnitConversions(),
    enabled: open,
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

  const mahajanIdForBalance = confirmPayload?.mahajan_id ?? fixedMahajanId;
  const { data: mahajanBalance, isFetching: balanceLoading } = useQuery({
    queryKey: ["mahajanBalance", mahajanIdForBalance],
    queryFn: () => api.getMahajanBalance(mahajanIdForBalance!),
    enabled: confirmLendOpen && !!mahajanIdForBalance,
  });

  const buildLinesWithGst = useCallback(
    (lines: ReadonlyArray<LendLine>) =>
      lines.map((l) => {
        const gross = l.amount || 0;
        const rate = gstEnabled ? l.gst_rate : 0;
        const inclusive = l.gst_inclusive;
        const computed =
          rate > 0 ? computeLineGst(gross, rate, inclusive) : null;
        return {
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          amount: computed ? computed.total_amount : gross,
          gst_rate: rate,
          gst_inclusive: inclusive,
          taxable_amount: computed ? computed.taxable_amount : gross,
          cgst_amount: computed ? computed.cgst_amount : 0,
          sgst_amount: computed ? computed.sgst_amount : 0,
        };
      }),
    [gstEnabled]
  );

  const lendConfirmColumns = useMemo(
    () => [
      { key: "productLabel", label: "Product" },
      {
        key: "oldStock",
        label: "Old stock",
        align: "right" as const,
        render: (r: LendConfirmPreviewRow) => (
          <span className="tabular-nums">{r.oldStock}</span>
        ),
      },
      {
        key: "quantity",
        label: "Received (credit purchase)",
        align: "right" as const,
        render: (r: LendConfirmPreviewRow) => (
          <span className="tabular-nums">{r.quantity}</span>
        ),
      },
      {
        key: "after",
        label: "Total after update",
        align: "right" as const,
        render: (r: LendConfirmPreviewRow) => (
          <span className="tabular-nums">{r.after}</span>
        ),
      },
    ],
    []
  );

  const createLendBatch = useMutation({
    mutationFn: async (payload: {
      mahajan_id: number;
      transaction_date: string;
      notes?: string;
      lender_invoice_number?: string;
      invoice_file_path?: string;
      batch_uuid?: string;
      invoice_file?: File | null;
      pay_now_amount?: number;
      pay_now_payment_method?: string;
      pay_now_reference_number?: string;
      lines: LendLine[];
      globalConversionRows: {
        from_unit: string;
        to_unit: string;
        factor: number;
      }[];
    }) => {
      let invoicePath = payload.invoice_file_path;
      const batchUuid = payload.batch_uuid ?? crypto.randomUUID();
      if (payload.invoice_file) {
        const buf = await payload.invoice_file.arrayBuffer();
        const ext =
          payload.invoice_file.name.includes(".") &&
          /\.(pdf|png|jpg|jpeg|webp)$/i.test(
            payload.invoice_file.name.slice(
              payload.invoice_file.name.lastIndexOf(".")
            )
          )
            ? payload.invoice_file.name.slice(
                payload.invoice_file.name.lastIndexOf(".")
              )
            : ".pdf";
        invoicePath = await api.saveCreditPurchaseInvoice({
          batchUuid,
          buffer: buf,
          extension: ext,
        });
      }
      const convRows = payload.globalConversionRows;
      const linesPrimaryQty = payload.lines.map((l) => {
        const item = itemList.find((i) => i.id === l.product_id);
        if (!item) {
          return l;
        }
        const fromUnit = (l.quantity_unit || item.unit).trim();
        const conv = convertToPrimaryQuantity(
          convRows,
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
        return { ...l, quantity: conv.primaryQuantity };
      });
      const linesWithGst = buildLinesWithGst(linesPrimaryQty);
      await api.createMahajanLendBatch({
        mahajan_id: payload.mahajan_id,
        transaction_date: payload.transaction_date,
        notes: payload.notes,
        lender_invoice_number: payload.lender_invoice_number || undefined,
        invoice_file_path: invoicePath,
        batch_uuid: batchUuid,
        lines: linesWithGst,
      });

      const payNow = payload.pay_now_amount ?? 0;
      if (payNow > 0) {
        await api.createMahajanDeposit({
          mahajan_id: payload.mahajan_id,
          transaction_date: payload.transaction_date,
          amount: payNow,
          notes: t("modals.add_credit_purchase.defaults.pay_now_note"),
          payment_method: payload.pay_now_payment_method || undefined,
          reference_number:
            payload.pay_now_reference_number?.trim() || undefined,
        });
      }
      return { hadPayNow: payNow > 0 };
    },
    onSuccess: (data: { hadPayNow: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["lowStockItems"] });
      setConfirmLendOpen(false);
      setConfirmPayload(null);
      setLendLines([emptyLine()]);
      onClose();
      toast.success(
        data?.hadPayNow
          ? t("modals.add_credit_purchase.toasts.saved_with_partial")
          : t("modals.add_credit_purchase.toasts.saved")
      );
    },
    onError: (err: Error) => {
      toast.error(
        err.message ?? t("modals.add_credit_purchase.toasts.save_failed")
      );
    },
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const itemList = items as ItemWithUnitGraph[];
  const mahajanOptions = useMemo(
    () => mahajanList.map((m) => ({ value: m.id, label: m.name })),
    [mahajanList]
  );
  const itemSelectOptions = useMemo(
    () => itemList.map((i) => ({ value: i.id, label: i.name })),
    [itemList]
  );

  const handleClose = () => {
    onClose();
    setConfirmLendOpen(false);
    setConfirmPayload(null);
    setLendLines([emptyLine()]);
    setLenderInvoiceNumber("");
    setInvoiceFile(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const mahajanId = fixedMahajanId ?? selectedLenderId;
    if (!mahajanId || !lendFormDate) return;
    const notes = (form.notes as HTMLInputElement)?.value?.trim() || "";
    const lines: LendLine[] = lendLines
      .map((line) => {
        const productId = line.product_id;
        const quantity = line.quantity;
        const amount = line.amount;
        const gstRate = gstEnabled ? line.gst_rate : 0;
        const gstInclusive = gstEnabled && line.gst_inclusive;
        const item = itemList.find((i) => i.id === productId);
        return productId && quantity > 0 && amount >= 0
          ? {
              product_id: productId,
              product_name: item?.name ?? "",
              quantity,
              quantity_unit: line.quantity_unit || item?.unit || "",
              amount,
              gst_rate: gstRate,
              gst_inclusive: gstInclusive,
            }
          : null;
      })
      .filter((l): l is LendLine => l != null);
    if (!lines.length) {
      toast.error(t("modals.add_credit_purchase.toasts.add_one_item"));
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
    const mahajan = mahajanList.find((m) => m.id === mahajanId);
    const totalAmount = buildLinesWithGst(lines).reduce(
      (s, l) => s + l.amount,
      0
    );
    const payNow = payNowAmount || 0;
    if (payNow > 0 && payNow > totalAmount) {
      toast.error(t("modals.add_credit_purchase.toasts.pay_now_exceeds_total"));
      return;
    }
    setConfirmPayload({
      mahajan_id: mahajanId,
      mahajanName: fixedMahajanName || (mahajan?.name ?? ""),
      transaction_date: lendFormDate,
      notes,
      lender_invoice_number: lenderInvoiceNumber.trim(),
      invoice_file: invoiceFile,
      pay_now_amount: payNow,
      pay_now_payment_method: payNow > 0 ? payNowPaymentMethod : "",
      pay_now_reference_number: payNow > 0 ? payNowReferenceNumber : "",
      lines,
    });
    setConfirmLendOpen(true);
  };

  return (
    <>
      <FormModal
        title={t("modals.add_credit_purchase.title")}
        open={open && !confirmLendOpen}
        onClose={handleClose}
        maxWidth="max-w-4xl"
        footer={
          <Button type="submit" form="add-lend-form" variant="amber">
            <ClipboardCheck size={20} className="mr-1.5" aria-hidden="true" />
            {t("modals.shared.actions.review_confirm")}
          </Button>
        }
      >
        <form id="add-lend-form" className="space-y-5" onSubmit={handleSubmit}>
          {fixedMahajanId == null && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("modals.shared.fields.lender_required")}
              </label>
              <OptionSelectButton
                name="mahajan_id"
                required
                options={mahajanOptions}
                value={selectedLenderId}
                onChange={(next) => setSelectedLenderId(next)}
                placeholder={t("modals.shared.placeholders.select")}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("modals.shared.fields.date_required")}
            </label>
            <DateInput
              value={lendFormDate}
              onChange={setLendFormDate}
              className="input-base w-full"
            />
          </div>
          <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[32rem]">
                {lendLines.length > 0 && (
                  <div
                    className={`grid gap-3 items-center text-sm font-medium text-[var(--color-text-secondary)] mb-2 px-1 ml-2 ${
                      gstEnabled
                        ? "grid-cols-[12rem_5rem_4rem_7rem_5rem_6rem_2.5rem]"
                        : "grid-cols-[12rem_6rem_4rem_8rem_2.5rem]"
                    }`}
                  >
                    <span>{t("columns.product")}</span>
                    <span>{t("columns.qty")}</span>
                    <span>{t("columns.unit")}</span>
                    <span>{t("columns.amount")}</span>
                    {gstEnabled && (
                      <>
                        <span>GST %</span>
                        <span>Mode</span>
                      </>
                    )}
                    <span aria-hidden="true" />
                  </div>
                )}
                <div className="space-y-3">
                  {lendLines.map((line, idx) => {
                    const selectedItem = line.product_id
                      ? itemList.find((i) => i.id === line.product_id)
                      : undefined;
                    return (
                      <div
                        key={idx}
                        className={`grid gap-3 items-center p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-sm ${
                          gstEnabled
                            ? "grid-cols-[12rem_5rem_4rem_7rem_5rem_6rem_2.5rem]"
                            : "grid-cols-[12rem_6rem_4rem_8rem_2.5rem]"
                        }`}
                      >
                        <OptionSelectButton
                          options={itemSelectOptions}
                          value={line.product_id > 0 ? line.product_id : null}
                          onChange={(next) => {
                            const id = next ?? 0;
                            const item = itemList.find((i) => i.id === id);
                            setLendLines((prev) => {
                              const n = [...prev];
                              n[idx] = {
                                ...n[idx],
                                product_id: id,
                                product_name: item?.name ?? "",
                                quantity_unit: item?.unit ?? "",
                                gst_rate:
                                  (item as Item & { gst_rate?: number })
                                    ?.gst_rate ?? 0,
                              };
                              return n;
                            });
                          }}
                          className="min-w-0"
                          aria-label="Product"
                          placeholder={t(
                            "modals.shared.placeholders.select_product"
                          )}
                          required={idx === 0}
                          name={idx === 0 ? "product_id_0" : undefined}
                        />
                        <input
                          name={`quantity_${idx}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          placeholder={t("modals.shared.placeholders.zero")}
                          value={line.quantity || ""}
                          onChange={(e) =>
                            setLendLines((prev) => {
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
                            line.quantity_unit ||
                            selectedItem?.unit ||
                            ""
                          }
                          onChange={(e) =>
                            setLendLines((prev) => {
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
                          placeholder={t("modals.shared.placeholders.zero")}
                          value={line.amount || ""}
                          onChange={(e) =>
                            setLendLines((prev) => {
                              const n = [...prev];
                              n[idx] = {
                                ...n[idx],
                                amount: Number(e.target.value) || 0,
                              };
                              return n;
                            })
                          }
                          className="input-base w-full text-right"
                          aria-label={t("columns.amount")}
                        />
                        {gstEnabled && (
                          <>
                            <select
                              name={`gst_rate_${idx}`}
                              value={line.gst_rate}
                              onChange={(e) =>
                                setLendLines((prev) => {
                                  const n = [...prev];
                                  n[idx] = {
                                    ...n[idx],
                                    gst_rate: Number(e.target.value) || 0,
                                  };
                                  return n;
                                })
                              }
                              className="input-base w-full"
                              aria-label="GST rate"
                            >
                              {GST_SLABS.map((r) => (
                                <option key={r} value={r}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                            <select
                              name={`gst_inclusive_${idx}`}
                              value={
                                line.gst_inclusive ? "inclusive" : "exclusive"
                              }
                              onChange={(e) =>
                                setLendLines((prev) => {
                                  const n = [...prev];
                                  n[idx] = {
                                    ...n[idx],
                                    gst_inclusive:
                                      e.target.value === "inclusive",
                                  };
                                  return n;
                                })
                              }
                              className="input-base w-full"
                              aria-label="GST mode"
                            >
                              <option value="exclusive">
                                {t("modals.add_credit_purchase.gst.exclusive")}
                              </option>
                              <option value="inclusive">
                                {t("modals.add_credit_purchase.gst.inclusive")}
                              </option>
                            </select>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setLendLines((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-subtle)] text-xs font-medium py-1.5 px-2 rounded-lg transition-colors inline-flex items-center gap-1 disabled:invisible"
                          aria-label={t("modals.shared.actions.remove_line")}
                          disabled={lendLines.length <= 1}
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
                  onClick={() => setLendLines((prev) => [...prev, emptyLine()])}
                  className="mt-3 !text-[var(--color-accent)] hover:!text-[var(--color-accent)] hover:!bg-transparent focus:outline-none focus:ring-0"
                >
                  <Plus size={20} className="mr-1.5" aria-hidden="true" />
                  {t("modals.shared.actions.add_item")}
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t(
                "modals.add_credit_purchase.sections.invoice_details_optional"
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.add_credit_purchase.fields.lender_invoice_number")}
              </label>
              <input
                type="text"
                value={lenderInvoiceNumber}
                onChange={(e) => setLenderInvoiceNumber(e.target.value)}
                placeholder={t(
                  "modals.add_credit_purchase.placeholders.invoice_number"
                )}
                className="input-base w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("modals.add_credit_purchase.fields.upload_invoice")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="credit-purchase-invoice-upload"
                />
                <label
                  htmlFor="credit-purchase-invoice-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--color-border-strong)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-raised)] cursor-pointer"
                >
                  <FileUp size={20} aria-hidden="true" />
                  {invoiceFile
                    ? invoiceFile.name
                    : t("modals.add_credit_purchase.placeholders.choose_file")}
                </label>
                {invoiceFile && (
                  <button
                    type="button"
                    onClick={() => setInvoiceFile(null)}
                    className="text-[var(--color-danger)] hover:text-[var(--color-danger-text)] p-1 rounded-lg"
                    aria-label={t(
                      "modals.add_credit_purchase.actions.remove_file"
                    )}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t("modals.add_credit_purchase.messages.max_file_size")}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t("modals.add_credit_purchase.sections.pay_now_optional")}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {t("modals.add_credit_purchase.messages.pay_now_help")}
            </p>
            <div>
              <label
                htmlFor="pay-now-amount"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                {t("modals.add_credit_purchase.fields.amount_to_pay_now")}
              </label>
              <input
                id="pay-now-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={payNowAmount || ""}
                onChange={(e) => setPayNowAmount(Number(e.target.value) || 0)}
                placeholder={t("modals.shared.placeholders.zero")}
                className="input-base w-full"
              />
            </div>
            {payNowAmount > 0 && (
              <>
                <div>
                  <label
                    htmlFor="pay-now-method"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
                  >
                    {t("modals.shared.fields.payment_method")}
                  </label>
                  <select
                    id="pay-now-method"
                    value={payNowPaymentMethod}
                    onChange={(e) => setPayNowPaymentMethod(e.target.value)}
                    className="input-base w-full"
                  >
                    <option value="">
                      {t("modals.shared.placeholders.none")}
                    </option>
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {t(pm.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                {payNowPaymentMethod && (
                  <div>
                    <label
                      htmlFor="pay-now-reference"
                      className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
                    >
                      {PAYMENT_METHODS.find(
                        (p) => p.value === payNowPaymentMethod
                      )
                        ? t(
                            PAYMENT_METHODS.find(
                              (p) => p.value === payNowPaymentMethod
                            )!.refLabelKey
                          )
                        : t("modals.shared.fields.reference")}
                    </label>
                    <input
                      id="pay-now-reference"
                      type="text"
                      value={payNowReferenceNumber}
                      onChange={(e) => setPayNowReferenceNumber(e.target.value)}
                      placeholder={(() => {
                        const pm = PAYMENT_METHODS.find(
                          (p) => p.value === payNowPaymentMethod
                        );
                        return pm && "placeholderKey" in pm && pm.placeholderKey
                          ? t(pm.placeholderKey)
                          : undefined;
                      })()}
                      className="input-base w-full"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("modals.shared.fields.notes")}
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder={t("modals.shared.placeholders.optional_notes")}
              className="input-base w-full resize-y min-h-[4.5rem]"
            />
          </div>
        </form>
      </FormModal>

      <FormModal
        title={t("modals.add_credit_purchase.confirm.title")}
        open={confirmLendOpen}
        onClose={() => {
          setConfirmLendOpen(false);
          setConfirmPayload(null);
        }}
        maxWidth="max-w-4xl"
        footer={
          confirmPayload ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmLendOpen(false);
                  setConfirmPayload(null);
                }}
              >
                {t("modals.shared.actions.back")}
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  if (!confirmPayload) return;
                  createLendBatch.mutate({
                    mahajan_id: confirmPayload.mahajan_id,
                    transaction_date: confirmPayload.transaction_date,
                    notes: confirmPayload.notes || undefined,
                    lender_invoice_number:
                      confirmPayload.lender_invoice_number || undefined,
                    invoice_file: confirmPayload.invoice_file,
                    batch_uuid: crypto.randomUUID(),
                    lines: confirmPayload.lines,
                    globalConversionRows,
                    pay_now_amount: confirmPayload.pay_now_amount,
                    pay_now_payment_method:
                      confirmPayload.pay_now_payment_method || undefined,
                    pay_now_reference_number:
                      confirmPayload.pay_now_reference_number?.trim() ||
                      undefined,
                  });
                }}
                disabled={createLendBatch.isPending}
              >
                {createLendBatch.isPending
                  ? t("modals.shared.actions.saving")
                  : t("modals.shared.actions.confirm")}
              </Button>
            </>
          ) : null
        }
      >
        {confirmPayload && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("modals.add_credit_purchase.confirm.receive_from", {
                lender: confirmPayload.mahajanName,
              })}{" "}
              <Tooltip
                content={formatDateForForm(confirmPayload.transaction_date)}
              >
                <span>
                  {formatDateForView(confirmPayload.transaction_date)}
                </span>
              </Tooltip>
            </p>
            <DataTable<LendConfirmPreviewRow>
              scrollMaxHeight="15rem"
              tableClassName="min-w-full text-sm border-collapse"
              rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
              columns={lendConfirmColumns}
              data={confirmPayload.lines.map((line, idx) => {
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
                  productLabel: line.product_name || item?.name || "\u2014",
                  oldStock,
                  quantity: primaryQty,
                  after: oldStock + primaryQty,
                };
              })}
              pagination={{ type: "client" }}
              tableFrame={false}
            />
            <p className="text-sm font-medium">
              {t("modals.add_credit_purchase.confirm.total_amount")}: ₹
              {formatDecimal(
                buildLinesWithGst(confirmPayload.lines).reduce(
                  (s, l) => s + l.amount,
                  0
                )
              )}
            </p>
            {confirmPayload.pay_now_amount > 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("modals.add_credit_purchase.confirm.paying_now", {
                  amount: formatDecimal(confirmPayload.pay_now_amount),
                })}
                {confirmPayload.pay_now_payment_method && (
                  <>
                    {" "}
                    {t("modals.add_credit_purchase.confirm.via_method", {
                      method: confirmPayload.pay_now_payment_method,
                    })}
                  </>
                )}
              </p>
            )}
            <MahajanBalanceCard
              balance={mahajanBalance}
              loading={balanceLoading}
              variant="compact"
              balanceAfter={
                mahajanBalance
                  ? mahajanBalance.balance +
                    buildLinesWithGst(confirmPayload.lines).reduce(
                      (s, l) => s + l.amount,
                      0
                    ) -
                    (confirmPayload.pay_now_amount ?? 0)
                  : undefined
              }
              balanceAfterLabel={t(
                "modals.add_credit_purchase.confirm.balance_after"
              )}
            />
          </div>
        )}
      </FormModal>
    </>
  );
}
