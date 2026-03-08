import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import DateInput from "./DateInput";
import Tooltip from "./Tooltip";
import MahajanBalanceCard from "./MahajanBalanceCard";
import {
  ClipboardDocumentCheckIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Button from "./Button";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import type { Item } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";
import { computeLineGst, GST_SLABS } from "../../shared/gst";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", refLabel: "Receipt No. / Voucher No." },
  {
    value: "bank",
    label: "Bank (NEFT/RTGS/IMPS)",
    refLabel: "UTR No.",
    placeholder: "e.g. 123456789012",
  },
  { value: "upi", label: "UPI", refLabel: "UPI Reference ID" },
  { value: "cheque", label: "Cheque", refLabel: "Cheque No." },
] as const;

export type LendLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  amount: number;
  gst_rate: number;
  gst_inclusive: boolean;
};

const emptyLine = (): LendLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
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
  const queryClient = useQueryClient();
  const api = getElectron();
  const [lendLines, setLendLines] = useState<LendLine[]>([emptyLine()]);
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
    }
  }, [open]);

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: open,
  });
  const gstEnabled = (settings as Record<string, string>).gst_enabled === "true";

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

  const mahajanIdForBalance = confirmPayload?.mahajan_id ?? fixedMahajanId;
  const { data: mahajanBalance, isFetching: balanceLoading } = useQuery({
    queryKey: ["mahajanBalance", mahajanIdForBalance],
    queryFn: () => api.getMahajanBalance(mahajanIdForBalance!),
    enabled: confirmLendOpen && !!mahajanIdForBalance,
  });

  const buildLinesWithGst = useCallback(
    (lines: LendLine[]) =>
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
      lines: ReturnType<typeof buildLinesWithGst>;
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
      await api.createMahajanLendBatch({
        mahajan_id: payload.mahajan_id,
        transaction_date: payload.transaction_date,
        notes: payload.notes,
        lender_invoice_number:
          payload.lender_invoice_number || undefined,
        invoice_file_path: invoicePath,
        batch_uuid: batchUuid,
        lines: payload.lines,
      });

      const payNow = payload.pay_now_amount ?? 0;
      if (payNow > 0) {
        await api.createMahajanDeposit({
          mahajan_id: payload.mahajan_id,
          transaction_date: payload.transaction_date,
          amount: payNow,
          notes: `Paid at credit purchase (partial)`,
          payment_method:
            payload.pay_now_payment_method || undefined,
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
          ? "Credit purchase and partial payment saved"
          : "Credit purchase saved"
      );
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save credit purchase");
    },
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const itemList = items as Item[];

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
    const mahajanId =
      fixedMahajanId ?? Number((form.mahajan_id as HTMLSelectElement)?.value);
    if (!mahajanId || !lendFormDate) return;
    const notes = (form.notes as HTMLInputElement)?.value?.trim() || "";
    const lines: LendLine[] = lendLines
      .map((_, idx) => {
        const productId = Number(
          (form[`product_id_${idx}`] as HTMLSelectElement)?.value
        );
        const quantity = Number(
          (form[`quantity_${idx}`] as HTMLInputElement)?.value
        );
        const amount = Number(
          (form[`amount_${idx}`] as HTMLInputElement)?.value
        );
        const gstRate = gstEnabled
          ? Number((form[`gst_rate_${idx}`] as HTMLSelectElement)?.value) ?? 0
          : 0;
        const gstInclusive =
          gstEnabled &&
          (form[`gst_inclusive_${idx}`] as HTMLSelectElement)?.value ===
            "inclusive";
        const item = itemList.find((i) => i.id === productId);
        return productId && quantity > 0 && amount >= 0
          ? {
              product_id: productId,
              product_name: item?.name ?? "",
              quantity,
              amount,
              gst_rate: gstRate,
              gst_inclusive: gstInclusive,
            }
          : null;
      })
      .filter((l): l is LendLine => l != null);
    if (!lines.length) {
      toast.error("Add at least one product with quantity and amount.");
      return;
    }
    const mahajan = mahajanList.find((m) => m.id === mahajanId);
    const totalAmount = buildLinesWithGst(lines).reduce((s, l) => s + l.amount, 0);
    const payNow = payNowAmount || 0;
    if (payNow > 0 && payNow > totalAmount) {
      toast.error("Pay now amount cannot exceed total credit purchase amount.");
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
        title="Add Credit Purchase"
        open={open && !confirmLendOpen}
        onClose={handleClose}
        maxWidth="max-w-3xl"
        footer={
          <Button type="submit" form="add-lend-form" variant="amber">
            <ClipboardDocumentCheckIcon
              className="w-5 h-5 mr-1.5"
              aria-hidden
            />
            Review &amp; confirm
          </Button>
        }
      >
        <form id="add-lend-form" className="space-y-5" onSubmit={handleSubmit}>
          {fixedMahajanId == null && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lender *
              </label>
              <select name="mahajan_id" required className="input-base w-full">
                <option value="">Select</option>
                {mahajanList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date * (dd/mm/yyyy)
            </label>
            <DateInput
              value={lendFormDate}
              onChange={setLendFormDate}
              className="input-base w-full"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[32rem]">
                {lendLines.length > 0 && (
                  <div
                    className={`grid gap-3 items-center text-sm font-medium text-gray-700 mb-2 px-1 ml-2 ${
                      gstEnabled
                        ? "grid-cols-[12rem_5rem_4rem_7rem_5rem_6rem_2.5rem]"
                        : "grid-cols-[12rem_6rem_4rem_8rem_2.5rem]"
                    }`}
                  >
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Amount</span>
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
                        className={`grid gap-3 items-center p-3 rounded-md bg-white border border-gray-100 shadow-sm ${
                          gstEnabled
                            ? "grid-cols-[12rem_5rem_4rem_7rem_5rem_6rem_2.5rem]"
                            : "grid-cols-[12rem_6rem_4rem_8rem_2.5rem]"
                        }`}
                      >
                        <select
                          name={`product_id_${idx}`}
                          required={idx === 0}
                          value={line.product_id || ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            const item = itemList.find((i) => i.id === id);
                            setLendLines((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx],
                                product_id: id,
                                product_name: item?.name ?? "",
                                gst_rate:
                                  (item as Item & { gst_rate?: number })
                                    ?.gst_rate ?? 0,
                              };
                              return next;
                            });
                          }}
                          className="input-base w-full min-w-0"
                          aria-label="Product"
                        >
                          <option value="">Select product</option>
                          {itemList.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name={`quantity_${idx}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="0"
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
                            selectedItem?.unit
                              ? `Quantity (${selectedItem.unit})`
                              : "Quantity"
                          }
                        />
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          {selectedItem?.unit ?? "—"}
                        </span>
                        <input
                          name={`amount_${idx}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0"
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
                          aria-label="Amount"
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
                              value={line.gst_inclusive ? "inclusive" : "exclusive"}
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
                              <option value="exclusive">Exclusive</option>
                              <option value="inclusive">Inclusive</option>
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-medium py-1.5 px-2 rounded transition-colors inline-flex items-center gap-1 disabled:invisible"
                          aria-label="Remove line"
                          disabled={lendLines.length <= 1}
                        >
                          <TrashIcon className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLendLines((prev) => [...prev, emptyLine()])}
                  className="mt-3 !text-blue-600 hover:!text-blue-700 hover:!bg-transparent focus:outline-none focus:ring-0"
                >
                  <PlusIcon className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Invoice details (optional)
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Lender&apos;s Invoice Number
              </label>
              <input
                type="text"
                value={lenderInvoiceNumber}
                onChange={(e) => setLenderInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="input-base w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Upload Invoice
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) =>
                    setInvoiceFile(e.target.files?.[0] ?? null)
                  }
                  className="hidden"
                  id="credit-purchase-invoice-upload"
                />
                <label
                  htmlFor="credit-purchase-invoice-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <DocumentArrowUpIcon className="w-5 h-5" aria-hidden />
                  {invoiceFile
                    ? invoiceFile.name
                    : "Choose file (PDF, images)"}
                </label>
                {invoiceFile && (
                  <button
                    type="button"
                    onClick={() => setInvoiceFile(null)}
                    className="text-red-600 hover:text-red-700 p-1 rounded"
                    aria-label="Remove file"
                  >
                    <XMarkIcon className="w-5 h-5" aria-hidden />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Max 10 MB. Stored in app data.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Pay now (optional)</p>
            <p className="text-xs text-gray-500">
              Pay part of this credit purchase immediately. Remaining amount stays
              as liability.
            </p>
            <div>
              <label
                htmlFor="pay-now-amount"
                className="block text-sm font-medium text-gray-600 mb-1"
              >
                Amount to pay now
              </label>
              <input
                id="pay-now-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={payNowAmount || ""}
                onChange={(e) =>
                  setPayNowAmount(Number(e.target.value) || 0)
                }
                placeholder="0"
                className="input-base w-full"
              />
            </div>
            {payNowAmount > 0 && (
              <>
                <div>
                  <label
                    htmlFor="pay-now-method"
                    className="block text-sm font-medium text-gray-600 mb-1"
                  >
                    Payment Method
                  </label>
                  <select
                    id="pay-now-method"
                    value={payNowPaymentMethod}
                    onChange={(e) => setPayNowPaymentMethod(e.target.value)}
                    className="input-base w-full"
                  >
                    <option value="">None</option>
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
                {payNowPaymentMethod && (
                  <div>
                    <label
                      htmlFor="pay-now-reference"
                      className="block text-sm font-medium text-gray-600 mb-1"
                    >
                      {PAYMENT_METHODS.find(
                        (p) => p.value === payNowPaymentMethod
                      )?.refLabel ?? "Reference"}
                    </label>
                    <input
                      id="pay-now-reference"
                      type="text"
                      value={payNowReferenceNumber}
                      onChange={(e) =>
                        setPayNowReferenceNumber(e.target.value)
                      }
                      placeholder={
                        PAYMENT_METHODS.find(
                          (p) => p.value === payNowPaymentMethod
                        )?.placeholder
                      }
                      className="input-base w-full"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Optional notes for this transaction"
              className="input-base w-full resize-y min-h-[4.5rem]"
            />
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Confirm Credit Purchase"
        open={confirmLendOpen}
        onClose={() => {
          setConfirmLendOpen(false);
          setConfirmPayload(null);
        }}
        maxWidth="max-w-3xl"
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
                Back
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  if (!confirmPayload) return;
                  const linesWithGst = buildLinesWithGst(confirmPayload.lines);
                  createLendBatch.mutate({
                    mahajan_id: confirmPayload.mahajan_id,
                    transaction_date: confirmPayload.transaction_date,
                    notes: confirmPayload.notes || undefined,
                    lender_invoice_number: confirmPayload.lender_invoice_number || undefined,
                    invoice_file: confirmPayload.invoice_file,
                    batch_uuid: crypto.randomUUID(),
                    lines: linesWithGst,
                    pay_now_amount: confirmPayload.pay_now_amount,
                    pay_now_payment_method:
                      confirmPayload.pay_now_payment_method || undefined,
                    pay_now_reference_number:
                      confirmPayload.pay_now_reference_number?.trim() || undefined,
                  });
                }}
                disabled={createLendBatch.isPending}
              >
                {createLendBatch.isPending ? "Saving…" : "Confirm"}
              </Button>
            </>
          ) : null
        }
      >
        {confirmPayload && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Receive credit purchase from <strong>{confirmPayload.mahajanName}</strong> on{" "}
              <Tooltip
                content={formatDateForForm(confirmPayload.transaction_date)}
              >
                <span>
                  {formatDateForView(confirmPayload.transaction_date)}
                </span>
              </Tooltip>
            </p>
            <div className="table-scroll-wrap overflow-auto max-h-60">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Old stock</th>
                    <th className="text-right p-2">Received (credit purchase)</th>
                    <th className="text-right p-2">Total after update</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmPayload.lines.map((line, idx) => {
                    const item = (
                      items as {
                        id: number;
                        name: string;
                        current_stock: number;
                      }[]
                    ).find((i) => i.id === line.product_id);
                    const oldStock = item?.current_stock ?? 0;
                    const after = oldStock + line.quantity;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="p-2">
                          {line.product_name || item?.name || "—"}
                        </td>
                        <td className="p-2 text-right">{oldStock}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2 text-right">{after}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-medium">
              Total credit purchase amount (this transaction): ₹
              {formatDecimal(
                buildLinesWithGst(confirmPayload.lines).reduce(
                  (s, l) => s + l.amount,
                  0
                )
              )}
            </p>
            {confirmPayload.pay_now_amount > 0 && (
              <p className="text-sm text-gray-600">
                Paying ₹{formatDecimal(confirmPayload.pay_now_amount)} now
                {confirmPayload.pay_now_payment_method && (
                  <> via {confirmPayload.pay_now_payment_method}</>
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
              balanceAfterLabel="After this credit purchase:"
            />
          </div>
        )}
      </FormModal>
    </>
  );
}
