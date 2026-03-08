import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import DateInput from "./DateInput";
import Button from "./Button";
import { todayISO } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import { formatDecimal } from "../../shared/numbers";

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

export interface AddDepositModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, mahajan selector is hidden and this mahajan is used. */
  fixedMahajanId?: number;
}

export default function AddDepositModal({
  open,
  onClose,
  fixedMahajanId,
}: AddDepositModalProps) {
  const queryClient = useQueryClient();
  const api = getElectron();
  const [depositFormDate, setDepositFormDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [allocExpand, setAllocExpand] = useState(false);
  const [allocations, setAllocations] = useState<
    { credit_purchase_id: number; amount: number }[]
  >([]);
  const [selectedLenderId, setSelectedLenderId] = useState<number | null>(
    fixedMahajanId ?? null
  );
  const [settlementAmount, setSettlementAmount] = useState<number>(0);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setDepositFormDate(todayISO()));
      queueMicrotask(() => setPaymentMethod(""));
      queueMicrotask(() => setReferenceNumber(""));
      queueMicrotask(() => setAllocExpand(false));
      queueMicrotask(() => setAllocations([]));
      queueMicrotask(() => setSelectedLenderId(fixedMahajanId ?? null));
      queueMicrotask(() => setSettlementAmount(0));
    }
  }, [open, fixedMahajanId]);

  const lenderIdForAlloc = fixedMahajanId ?? selectedLenderId;

  const { data: creditPurchases = [] } = useQuery({
    queryKey: ["creditPurchasesWithAllocated", lenderIdForAlloc],
    queryFn: () => api.getCreditPurchasesWithAllocated(lenderIdForAlloc!),
    enabled: open && !!lenderIdForAlloc && allocExpand,
  });

  const { data: mahajans = [] } = useQuery({
    queryKey: ["mahajans"],
    queryFn: () => api.getMahajans(),
    enabled: open && fixedMahajanId == null,
  });

  const createDeposit = useMutation({
    mutationFn: (d: {
      mahajan_id: number;
      transaction_date: string;
      amount: number;
      notes?: string;
      payment_method?: string;
      reference_number?: string;
      allocations?: { credit_purchase_id: number; amount: number }[];
    }) => api.createMahajanDeposit(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      onClose();
      toast.success("Settlement saved");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to save settlement"),
  });

  const mahajanList = mahajans as { id: number; name: string }[];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const mahajanId =
      fixedMahajanId ?? Number((form.mahajan_id as HTMLSelectElement)?.value);
    if (!mahajanId || !depositFormDate) return;
    const amount = settlementAmount || Number((form.amount as HTMLInputElement).value);
    const allocs =
      allocations.length > 0 ? allocations : undefined;
    createDeposit.mutate({
      mahajan_id: mahajanId,
      transaction_date: depositFormDate,
      amount,
      notes: (form.notes as HTMLInputElement)?.value?.trim() || undefined,
      payment_method:
        paymentMethod && paymentMethod !== "none"
          ? paymentMethod
          : undefined,
      reference_number: referenceNumber.trim() || undefined,
      allocations: allocs,
    });
  };

  return (
    <FormModal
      title="Add Settlement"
      open={open}
      onClose={onClose}
      footer={
        <Button
          type="submit"
          form="add-deposit-form"
          variant="green"
          disabled={createDeposit.isPending}
        >
          <CheckIcon className="w-5 h-5 mr-1.5" aria-hidden />
          {createDeposit.isPending ? "Saving…" : "Save"}
        </Button>
      }
    >
      <form id="add-deposit-form" className="space-y-3" onSubmit={handleSubmit}>
        {fixedMahajanId == null && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lender *
            </label>
            <select
              name="mahajan_id"
              required
              className="w-full border rounded px-3 py-2 input-base"
              onChange={(e) =>
                setSelectedLenderId(Number(e.target.value) || null)
              }
            >
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date * (dd/mm/yyyy)
          </label>
          <DateInput
            value={depositFormDate}
            onChange={setDepositFormDate}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="settlement-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Amount *
          </label>
          <input
            id="settlement-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={settlementAmount || ""}
            onChange={(e) =>
              setSettlementAmount(Number(e.target.value) || 0)
            }
            className="w-full border rounded px-3 py-2 input-base"
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Payment details (optional)
          </p>
          <div>
            <label
              htmlFor="payment-method"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              Payment Method
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
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
          {paymentMethod && (
            <div>
              <label
                htmlFor="reference-number"
                className="block text-sm font-medium text-gray-600 mb-1"
              >
                {PAYMENT_METHODS.find((p) => p.value === paymentMethod)
                  ?.refLabel ?? "Reference"}
              </label>
              <input
                id="reference-number"
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={
                  PAYMENT_METHODS.find((p) => p.value === paymentMethod)
                    ?.placeholder
                }
                className="input-base w-full"
              />
            </div>
          )}
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setAllocExpand((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
          >
            <span>Allocate to Credit Purchase(s)</span>
            {allocExpand ? (
              <ChevronUpIcon className="w-5 h-5" aria-hidden />
            ) : (
              <ChevronDownIcon className="w-5 h-5" aria-hidden />
            )}
          </button>
          {allocExpand && (
            <div className="p-4 border-t border-gray-200 bg-white space-y-3">
              {!lenderIdForAlloc ? (
                <p className="text-sm text-gray-500">
                  Select a lender first to see credit purchases.
                </p>
              ) : creditPurchases.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No credit purchases to allocate. Add credit purchases first.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Link this settlement to specific credit purchases for better
                    tracking.
                  </p>
                  <div className="max-h-48 overflow-auto space-y-2">
                    {(
                      creditPurchases as {
                        id: number;
                        amount: number;
                        transaction_date: string;
                        product_name: string | null;
                        lender_invoice_number: string | null;
                        outstanding: number;
                      }[]
                    ).map((cp) => {
                      const alloc = allocations.find(
                        (a) => a.credit_purchase_id === cp.id
                      );
                      return (
                        <div
                          key={cp.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="flex-1 min-w-0 truncate">
                            {cp.transaction_date} – ₹{formatDecimal(cp.amount)}
                            {cp.lender_invoice_number &&
                              ` (${cp.lender_invoice_number})`}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={cp.outstanding}
                            step="0.01"
                            placeholder="0"
                            value={alloc?.amount ?? ""}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAllocations((prev) => {
                                const rest = prev.filter(
                                  (a) => a.credit_purchase_id !== cp.id
                                );
                                if (Number.isNaN(val) || val <= 0)
                                  return rest;
                                return [
                                  ...rest,
                                  { credit_purchase_id: cp.id, amount: val },
                                ];
                              });
                            }}
                            className="input-base w-24 text-right"
                          />
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const totalAlloc = allocations.reduce(
                      (s, a) => s + a.amount,
                      0
                    );
                    const mismatch =
                      settlementAmount > 0 &&
                      totalAlloc > 0 &&
                      Math.abs(totalAlloc - settlementAmount) > 0.01;
                    return (
                      <p
                        className={
                          mismatch
                            ? "text-sm text-amber-600 font-medium"
                            : "text-sm text-gray-600"
                        }
                      >
                        Total allocated: ₹{formatDecimal(totalAlloc)}
                        {mismatch && " (differs from settlement amount)"}
                      </p>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="settlement-notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes
          </label>
          <input
            id="settlement-notes"
            name="notes"
            className="w-full border rounded px-3 py-2 input-base"
          />
        </div>
      </form>
    </FormModal>
  );
}
