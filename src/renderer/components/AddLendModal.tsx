import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getElectron } from "../api/client";
import FormModal from "./FormModal";
import DateInput from "./DateInput";
import Tooltip from "./Tooltip";
import MahajanBalanceCard from "./MahajanBalanceCard";
import Button from "./Button";
import { todayISO, formatDateForView, formatDateForForm } from "../lib/date";
import { setLedgerUpdatesAvailable } from "../lib/ledgerUpdatesFlag";
import type { Item } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

export type LendLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  amount: number;
};

const emptyLine = (): LendLine => ({
  product_id: 0,
  product_name: "",
  quantity: 0,
  amount: 0,
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
  const [confirmLendOpen, setConfirmLendOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    mahajan_id: number;
    mahajanName: string;
    transaction_date: string;
    notes: string;
    lines: LendLine[];
  } | null>(null);

  useEffect(() => {
    if (open) queueMicrotask(() => setLendFormDate(todayISO()));
  }, [open]);
  useEffect(() => {
    if (open) queueMicrotask(() => setLendLines([emptyLine()]));
  }, [open]);

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

  const createLendBatch = useMutation({
    mutationFn: (payload: {
      mahajan_id: number;
      transaction_date: string;
      notes?: string;
      lines: {
        product_id: number;
        product_name?: string;
        quantity: number;
        amount: number;
      }[];
    }) => api.createMahajanLendBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mahajanLedger"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanLends"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanBalance"] });
      queryClient.invalidateQueries({ queryKey: ["mahajanSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allMahajanBalances"] });
      setLedgerUpdatesAvailable(true);
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setConfirmLendOpen(false);
      setConfirmPayload(null);
      setLendLines([emptyLine()]);
      onClose();
      toast.success("Lend saved");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save lend");
    },
  });

  const mahajanList = mahajans as { id: number; name: string }[];
  const itemList = items as Item[];

  const handleClose = () => {
    onClose();
    setConfirmLendOpen(false);
    setConfirmPayload(null);
    setLendLines([emptyLine()]);
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
        const item = itemList.find((i) => i.id === productId);
        return productId && quantity > 0 && amount >= 0
          ? {
              product_id: productId,
              product_name: item?.name ?? "",
              quantity,
              amount,
            }
          : null;
      })
      .filter((l): l is LendLine => l != null);
    if (!lines.length) {
      toast.error("Add at least one product with quantity and amount.");
      return;
    }
    const mahajan = mahajanList.find((m) => m.id === mahajanId);
    setConfirmPayload({
      mahajan_id: mahajanId,
      mahajanName: fixedMahajanName || (mahajan?.name ?? ""),
      transaction_date: lendFormDate,
      notes,
      lines,
    });
    setConfirmLendOpen(true);
  };

  return (
    <>
      <FormModal
        title="Add Lend"
        open={open && !confirmLendOpen}
        onClose={handleClose}
        maxWidth="max-w-3xl"
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
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
              value={lendFormDate}
              onChange={setLendFormDate}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="border rounded p-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Products
              </span>
              <button
                type="button"
                onClick={() => setLendLines((prev) => [...prev, emptyLine()])}
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                + Add product
              </button>
            </div>
            {lendLines.map((line, idx) => {
              const selectedItem = line.product_id
                ? itemList.find((i) => i.id === line.product_id)
                : undefined;
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Product
                    </label>
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
                          };
                          return next;
                        });
                      }}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {itemList.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Qty{selectedItem?.unit ? ` (${selectedItem.unit})` : ""}
                    </label>
                    <input
                      name={`quantity_${idx}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
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
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Amount
                    </label>
                    <input
                      name={`amount_${idx}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
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
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex items-end">
                    {lendLines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLendLines((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-red-600 hover:text-red-700 text-sm py-1.5"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input name="notes" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 text-white rounded"
            >
              Review &amp; confirm
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        title="Confirm Lend"
        open={confirmLendOpen}
        onClose={() => {
          setConfirmLendOpen(false);
          setConfirmPayload(null);
        }}
        maxWidth="max-w-3xl"
      >
        {confirmPayload && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Receive lend from <strong>{confirmPayload.mahajanName}</strong> on{" "}
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
                    <th className="text-right p-2">Received (lent to us)</th>
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
              Total lend amount (this transaction): ₹
              {formatDecimal(
                confirmPayload.lines.reduce((s, l) => s + l.amount, 0)
              )}
            </p>
            <MahajanBalanceCard
              balance={mahajanBalance}
              loading={balanceLoading}
              variant="compact"
              balanceAfter={
                mahajanBalance
                  ? mahajanBalance.balance +
                    confirmPayload.lines.reduce((s, l) => s + l.amount, 0)
                  : undefined
              }
              balanceAfterLabel="After this lend:"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmLendOpen(false);
                  setConfirmPayload(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  createLendBatch.mutate({
                    mahajan_id: confirmPayload.mahajan_id,
                    transaction_date: confirmPayload.transaction_date,
                    notes: confirmPayload.notes || undefined,
                    lines: confirmPayload.lines.map((l) => ({
                      product_id: l.product_id,
                      product_name: l.product_name,
                      quantity: l.quantity,
                      amount: l.amount,
                    })),
                  });
                }}
                disabled={createLendBatch.isPending}
              >
                {createLendBatch.isPending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}
