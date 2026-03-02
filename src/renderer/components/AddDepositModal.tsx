import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckIcon } from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import DateInput from "./DateInput";
import Button from "./Button";
import { todayISO } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";

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

  useEffect(() => {
    if (open) queueMicrotask(() => setDepositFormDate(todayISO()));
  }, [open]);

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
    }) => api.createMahajanDeposit(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanDeposits"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      onClose();
      toast.success("Deposit saved");
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to save deposit"),
  });

  const mahajanList = mahajans as { id: number; name: string }[];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const mahajanId =
      fixedMahajanId ?? Number((form.mahajan_id as HTMLSelectElement)?.value);
    if (!mahajanId || !depositFormDate) return;
    createDeposit.mutate({
      mahajan_id: mahajanId,
      transaction_date: depositFormDate,
      amount: Number((form.amount as HTMLInputElement).value),
      notes: (form.notes as HTMLInputElement)?.value?.trim() || undefined,
    });
  };

  return (
    <FormModal
      title="Add Deposit"
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
              Mahajan *
            </label>
            <select
              name="mahajan_id"
              required
              className="w-full border rounded px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount *
          </label>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <input name="notes" className="w-full border rounded px-3 py-2" />
        </div>
      </form>
    </FormModal>
  );
}
