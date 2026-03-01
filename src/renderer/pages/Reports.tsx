import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import { formatDateForView, formatDateForForm } from "../lib/date";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import { formatDecimal } from "../../shared/numbers";

export default function Reports() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const currentYear = new Date().getFullYear();
  const [weeklyDate, setWeeklyDate] = useState("");
  const [totalFrom, setTotalFrom] = useState("");
  const [totalTo, setTotalTo] = useState("");
  const [plYear, setPlYear] = useState(currentYear);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [plResult, setPlResult] = useState<{
    openingBalance: number;
    totalSale: number;
    totalExpenditure: number;
    closingBalance: number;
    profitLoss: number;
  } | null>(null);

  const { data: weeklySales = [], isLoading: weeklyLoading } = useQuery({
    queryKey: ["weeklySale", weeklyDate],
    queryFn: () => api.getWeeklySale(weeklyDate),
    enabled: !!weeklyDate,
  });

  const { data: totalSaleResult } = useQuery({
    queryKey: ["totalSale", totalFrom, totalTo],
    queryFn: () => api.getTotalSale(totalFrom, totalTo),
    enabled: !!totalFrom && !!totalTo,
  });

  const { data: savedOpening } = useQuery({
    queryKey: ["openingBalance", plYear],
    queryFn: () => api.getOpeningBalance(plYear),
  });

  const setOpening = useMutation({
    mutationFn: ({ year, amount }: { year: number; amount: number }) =>
      api.setOpeningBalance(year, amount),
    onSuccess: (_, { year }) =>
      queryClient.invalidateQueries({ queryKey: ["openingBalance", year] }),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Weekly Sale</h2>
        <p className="text-sm text-gray-500 mb-2">
          Select a date to see 7 days of entries (descending from that date).
        </p>
        <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
            Date
            <DateInput
              value={weeklyDate}
              onChange={setWeeklyDate}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </label>
          {weeklyDate && (
            <button
              type="button"
              onClick={() => setWeeklyDate("")}
              className="shrink-0 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear
            </button>
          )}
        </div>
        {weeklyDate && (
          <>
            {weeklyLoading ? (
              <TableLoader />
            ) : (
            <div className="table-scroll-wrap overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Sale</th>
                  <th className="text-right py-2">Cash in Hand</th>
                  <th className="text-right py-2">Expenditure</th>
                </tr>
              </thead>
              <tbody>
                {(
                  weeklySales as {
                    sale_date: string;
                    sale_amount: number;
                    cash_in_hand: number;
                    expenditure_amount: number | null;
                  }[]
                ).map((s) => (
                  <tr key={s.sale_date} className="border-b">
                    <td className="py-2">
                    <Tooltip content={formatDateForForm(s.sale_date)}>
                      <span>{formatDateForView(s.sale_date)}</span>
                    </Tooltip>
                  </td>
                    <td className="text-right py-2">
                      {formatDecimal(s.sale_amount)}
                    </td>
                    <td className="text-right py-2">
                      {formatDecimal(s.cash_in_hand)}
                    </td>
                    <td className="text-right py-2">
                      {formatDecimal(s.expenditure_amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Total Sale</h2>
        <p className="text-sm text-gray-500 mb-2">
          Enter date range to get total sale and expenditure.
        </p>
        <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
            From
            <DateInput
              value={totalFrom}
              onChange={setTotalFrom}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </label>
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-gray-600">
            To
            <DateInput
              value={totalTo}
              onChange={setTotalTo}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </label>
          {(totalFrom || totalTo) && (
            <button
              type="button"
              onClick={() => {
                setTotalFrom("");
                setTotalTo("");
              }}
              className="shrink-0 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear filters
            </button>
          )}
        </div>
        {totalSaleResult && (
          <div className="text-sm">
            <p>
              <strong>Total Sale:</strong>{" "}
              {formatDecimal((totalSaleResult as { total: number }).total)}
            </p>
            <p>
              <strong>Total Expenditure:</strong>{" "}
              {formatDecimal((totalSaleResult as { expenditure: number }).expenditure)}
            </p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">
          Profit / Loss
        </h2>
        <p className="text-sm text-gray-500 mb-2">
          Set opening balance for the year, then enter closing balance to
          calculate.
        </p>
        <div className="space-y-3 mb-4">
          <div className="flex gap-2 items-center">
            <label className="w-24">Year</label>
            <input
              type="number"
              value={plYear}
              onChange={(e) => setPlYear(Number(e.target.value))}
              className="border rounded px-3 py-1.5 w-24"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-24">Opening</label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder={savedOpening != null ? String(savedOpening) : ""}
              className="border rounded px-3 py-1.5"
            />
            <button
              type="button"
              onClick={() => {
                const amt = Number(openingBalance);
                if (!Number.isFinite(amt)) return;
                setOpening.mutate({ year: plYear, amount: amt });
              }}
              className="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200"
            >
              Set Opening
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-24">Closing</label>
            <input
              type="number"
              step="0.01"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              className="border rounded px-3 py-1.5"
            />
            <button
              type="button"
              onClick={async () => {
                const closing = Number(closingBalance);
                if (!Number.isFinite(closing)) return;
                const result = await api.getProfitLoss(plYear, closing);
                setPlResult(result);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Calculate
            </button>
          </div>
        </div>
        {plResult && (
          <div className="text-sm space-y-1 border-t pt-3">
            <p>Opening Balance: {formatDecimal(plResult.openingBalance)}</p>
            <p>Total Sale: {formatDecimal(plResult.totalSale)}</p>
            <p>Total Expenditure: {formatDecimal(plResult.totalExpenditure)}</p>
            <p>Closing Balance: {formatDecimal(plResult.closingBalance)}</p>
            <p className="font-medium pt-2">
              Profit/Loss:{" "}
              <span
                className={
                  plResult.profitLoss >= 0 ? "text-green-700" : "text-red-700"
                }
              >
                {formatDecimal(plResult.profitLoss)}
              </span>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
