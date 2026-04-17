import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import DateInput from "./DateInput";
import Button from "./Button";
import { OptionSelectButton } from "./OptionSelectButton";
import { todayISO } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import { formatDecimal } from "../../shared/numbers";

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
  const { t } = useTranslation("transactions");
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
      toast.success(t("modals.add_settlement.toasts.saved"));
    },
    onError: (err: Error) =>
      toast.error(err.message ?? t("modals.add_settlement.toasts.save_failed")),
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const mahajanOptions = useMemo(
    () => mahajanList.map((m) => ({ value: m.id, label: m.name })),
    [mahajanList]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const mahajanId = fixedMahajanId ?? selectedLenderId;
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
      title={t("modals.add_settlement.title")}
      open={open}
      onClose={onClose}
      footer={
        <Button
          type="submit"
          form="add-deposit-form"
          variant="green"
          disabled={createDeposit.isPending}
        >
          <Check size={20} className="mr-1.5" aria-hidden="true" />
          {createDeposit.isPending
            ? t("modals.shared.actions.saving")
            : t("modals.shared.actions.save")}
        </Button>
      }
    >
      <form id="add-deposit-form" className="space-y-3" onSubmit={handleSubmit}>
        {fixedMahajanId == null && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            {t("modals.shared.fields.date_required")}
          </label>
          <DateInput
            value={depositFormDate}
            onChange={setDepositFormDate}
            className="w-full border border-[var(--color-border-strong)] rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="settlement-amount"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            {t("modals.shared.fields.amount_required")}
          </label>
          <input
            id="settlement-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={settlementAmount || ""}
            onChange={(e) =>
              setSettlementAmount(Number(e.target.value) || 0)
            }
            className="w-full border rounded-lg px-3 py-2 input-base"
          />
        </div>
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]/60 p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t("modals.shared.sections.payment_details_optional")}
          </p>
          <div>
            <label
              htmlFor="payment-method"
              className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
            >
              {t("modals.shared.fields.payment_method")}
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t("modals.shared.placeholders.none")}</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {t(pm.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {paymentMethod && (
            <div>
              <label
                htmlFor="reference-number"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                {PAYMENT_METHODS.find((p) => p.value === paymentMethod)
                  ? t(
                      PAYMENT_METHODS.find((p) => p.value === paymentMethod)!
                        .refLabelKey
                    )
                  : t("modals.shared.fields.reference")}
              </label>
              <input
                id="reference-number"
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={
                  PAYMENT_METHODS.find((p) => p.value === paymentMethod)
                    ?.placeholderKey
                    ? t(
                        PAYMENT_METHODS.find((p) => p.value === paymentMethod)!
                          .placeholderKey!
                      )
                    : undefined
                }
                className="input-base w-full"
              />
            </div>
          )}
        </div>
        <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setAllocExpand((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface-sunken)]"
          >
            <span>{t("modals.add_settlement.sections.allocate_to_credit")}</span>
            {allocExpand ? (
              <ChevronUp size={20} aria-hidden="true" />
            ) : (
              <ChevronDown size={20} aria-hidden="true" />
            )}
          </button>
          {allocExpand && (
            <div className="p-4 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] space-y-3">
              {!lenderIdForAlloc ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {t("modals.add_settlement.messages.select_lender_first")}
                </p>
              ) : creditPurchases.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {t("modals.add_settlement.messages.no_credit_purchases")}
                </p>
              ) : (
                <>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("modals.add_settlement.messages.link_for_tracking")}
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
                            placeholder={t("modals.shared.placeholders.zero")}
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
                            ? "text-sm text-[var(--color-warning-text)] font-medium"
                            : "text-sm text-[var(--color-text-secondary)]"
                        }
                      >
                        {t("modals.add_settlement.messages.total_allocated")}: ₹
                        {formatDecimal(totalAlloc)}
                        {mismatch &&
                          ` ${t("modals.add_settlement.messages.differs_from_amount")}`}
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
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            {t("modals.shared.fields.notes")}
          </label>
          <input
            id="settlement-notes"
            name="notes"
            className="w-full border rounded-lg px-3 py-2 input-base"
          />
        </div>
      </form>
    </FormModal>
  );
}
