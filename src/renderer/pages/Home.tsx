import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalculatorIcon,
  CheckIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import { formatDateForView, formatDateForForm, todayISO } from "../lib/date";
import DateInput from "../components/DateInput";
import Tooltip from "../components/Tooltip";
import { formatDecimal, formatRupee } from "../../shared/numbers";

function getMonthStart(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getWeekStart(): string {
  return getDaysAgo(6);
}

function getYearStart(): string {
  const y = new Date().getFullYear();
  return `${y}-01-01`;
}

function netBalanceClass(balance: number): string {
  if (balance > 0) return "text-red-600";
  if (balance < 0) return "text-green-600";
  return "text-gray-900";
}

const DATE_PRESETS = [
  { label: "This Week", getFrom: getWeekStart, getTo: () => todayISO() },
  { label: "This Month", getFrom: getMonthStart, getTo: () => todayISO() },
  {
    label: "Last 30 Days",
    getFrom: () => getDaysAgo(29),
    getTo: () => todayISO(),
  },
  { label: "This Year", getFrom: getYearStart, getTo: () => todayISO() },
] as const;

type WeeklyRow = {
  sale_date: string;
  sale_amount: number;
  cash_in_hand: number;
  expenditure_amount: number | null;
  invoice_sales?: number;
  misc_sales?: number;
};

export default function Home() {
  const queryClient = useQueryClient();
  const api = getElectron();
  const currentYear = new Date().getFullYear();
  const defaultTotalFrom = useMemo(() => getMonthStart(), []);
  const defaultTotalTo = useMemo(() => todayISO(), []);

  const [weeklyDate, setWeeklyDate] = useState(todayISO());
  const [totalFrom, setTotalFrom] = useState(defaultTotalFrom);
  const [totalTo, setTotalTo] = useState(defaultTotalTo);
  const [plYear, setPlYear] = useState(currentYear);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [plResult, setPlResult] = useState<{
    openingBalance: number;
    totalSale: number;
    totalExpenditure: number;
    totalLend: number;
    totalDeposit: number;
    closingBalance: number;
    profitLoss: number;
    expectedClosing: number;
    cashVariance: number;
  } | null>(null);

  const { data: reportSummary } = useQuery({
    queryKey: ["reportSummary"],
    queryFn: () => api.getReportSummary(),
  });

  const { data: mahajanSummary } = useQuery({
    queryKey: ["mahajanSummary"],
    queryFn: () => api.getMahajanSummary(),
  });

  const {
    data: lowStockItems = [],
    isLoading: lowStockLoading,
    isError: lowStockError,
  } = useQuery({
    queryKey: ["lowStockItems"],
    queryFn: () => api.getLowStockItems(),
  });

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

  const applyPreset = (preset: (typeof DATE_PRESETS)[number]) => {
    setTotalFrom(preset.getFrom());
    setTotalTo(preset.getTo());
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Home</h1>

      {/* Executive Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportSummary && (
          <>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Today&apos;s Sale</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatRupee(reportSummary.todaySale)}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">This Week (7 days)</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatRupee(reportSummary.weekSale)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Expenditure: {formatRupee(reportSummary.weekExpenditure)}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {formatRupee(reportSummary.monthSale)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Expenditure: {formatRupee(reportSummary.monthExpenditure)}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Mahajan Net</p>
              <p
                className={`text-xl font-semibold mt-1 ${mahajanSummary ? netBalanceClass(mahajanSummary.balance) : "text-gray-900"}`}
              >
                {mahajanSummary
                  ? formatRupee(Math.abs(mahajanSummary.balance))
                  : formatRupee(0)}
              </p>
              {mahajanSummary &&
                (mahajanSummary.countOweMe > 0 ||
                  mahajanSummary.countIOwe > 0) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {mahajanSummary.countOweMe} receivable,{" "}
                    {mahajanSummary.countIOwe} payable
                  </p>
                )}
            </div>
          </>
        )}
      </section>

      {/* Weekly Sale */}
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
          <button
            type="button"
            onClick={() => setWeeklyDate(todayISO())}
            className="inline-flex items-center gap-1 shrink-0 text-sm text-gray-600 hover:text-gray-900"
          >
            Today
          </button>
        </div>
        {weeklyLoading ? (
          <TableLoader />
        ) : (
          <div className="table-scroll-wrap overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Sale</th>
                  <th className="text-right py-2">Invoice</th>
                  <th className="text-right py-2">Misc</th>
                  <th className="text-right py-2">Cash in Hand</th>
                  <th className="text-right py-2">Expenditure</th>
                </tr>
              </thead>
              <tbody>
                {(weeklySales as WeeklyRow[]).map((s) => (
                  <tr key={s.sale_date} className="border-b">
                    <td className="py-2">
                      <Tooltip content={formatDateForForm(s.sale_date)}>
                        <span>{formatDateForView(s.sale_date)}</span>
                      </Tooltip>
                    </td>
                    <td className="text-right py-2">
                      {formatRupee(s.sale_amount)}
                    </td>
                    <td className="text-right py-2">
                      {formatRupee(s.invoice_sales ?? 0)}
                    </td>
                    <td className="text-right py-2">
                      {formatRupee(s.misc_sales ?? 0)}
                    </td>
                    <td className="text-right py-2">
                      {formatRupee(s.cash_in_hand)}
                    </td>
                    <td className="text-right py-2">
                      {formatRupee(s.expenditure_amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Total Sale */}
      <section className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Total Sale</h2>
        <p className="text-sm text-gray-500 mb-2">
          Enter date range or use presets to get total sale and breakdown.
        </p>
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm text-gray-600">From</label>
            <DateInput
              value={totalFrom}
              onChange={setTotalFrom}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm text-gray-600">To</label>
            <DateInput
              value={totalTo}
              onChange={setTotalTo}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white w-[10rem] shrink-0 min-w-0"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setTotalFrom(defaultTotalFrom);
              setTotalTo(defaultTotalTo);
            }}
            className="inline-flex items-center gap-1 shrink-0 text-sm text-gray-600 hover:text-gray-900"
          >
            <XMarkIcon className="w-4 h-4" aria-hidden />
            Reset
          </button>
        </div>
        {totalSaleResult && (
          <div className="text-sm space-y-1">
            <p>
              <strong>Total Sale:</strong> {formatRupee(totalSaleResult.total)}
            </p>
            <p>
              <strong>Invoice Sales:</strong>{" "}
              {formatRupee(totalSaleResult.invoice_sales ?? 0)}
            </p>
            <p>
              <strong>Misc / Cash Sales:</strong>{" "}
              {formatRupee(totalSaleResult.misc_sales ?? 0)}
            </p>
            <p>
              <strong>Total Expenditure:</strong>{" "}
              {formatRupee(totalSaleResult.expenditure)}
            </p>
          </div>
        )}
      </section>

      {/* Mahajan Summary */}
      <section className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900">Mahajan Summary</h2>
          <Link
            to="/mahajans"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            View Mahajans
            <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
        {mahajanSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Total Lent</p>
              <p className="font-medium">
                {formatRupee(mahajanSummary.totalLend)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Total Deposited</p>
              <p className="font-medium">
                {formatRupee(mahajanSummary.totalDeposit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Net Balance</p>
              <p
                className={`font-medium ${netBalanceClass(mahajanSummary.balance)}`}
              >
                {formatRupee(Math.abs(mahajanSummary.balance))}
                {mahajanSummary.balance > 0 && (
                  <span className="text-gray-500 font-normal"> (payable)</span>
                )}
                {mahajanSummary.balance < 0 && (
                  <span className="text-gray-500 font-normal">
                    {" "}
                    (receivable)
                  </span>
                )}
              </p>
              {mahajanSummary.countOweMe > 0 && (
                <p className="text-xs text-gray-500">
                  {mahajanSummary.countOweMe} receivable
                </p>
              )}
              {mahajanSummary.countIOwe > 0 && (
                <p className="text-xs text-gray-500">
                  {mahajanSummary.countIOwe} payable
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No mahajan data.</p>
        )}
      </section>

      {/* Low Stock Alerts */}
      <section className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900">
            Low Stock Alerts
            {lowStockItems.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" aria-hidden />
                {lowStockItems.length}
              </span>
            )}
          </h2>
          <Link
            to="/stock"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            View Stock
            <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
        {lowStockError ? (
          <p className="text-sm text-red-600">
            Error loading low stock items. Try refreshing.
          </p>
        ) : lowStockLoading ? (
          <TableLoader />
        ) : lowStockItems.length === 0 ? (
          <p className="text-sm text-gray-500">
            No items below reorder level. Set a reorder level on items (Products
            & Stock page) to see alerts.
          </p>
        ) : (
          <div className="table-scroll-wrap overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Current</th>
                  <th className="text-right py-2">Reorder At</th>
                  <th className="text-left py-2">Unit</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.name}</td>
                    <td className="text-right py-2">
                      {formatDecimal(item.current_stock)}
                    </td>
                    <td className="text-right py-2">
                      {formatDecimal(item.reorder_level)}
                    </td>
                    <td className="py-2">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Profit / Loss */}
      <section className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">
          Profit / Loss
        </h2>
        <p className="text-sm text-gray-500 mb-2">
          Profit/Loss = Total Sale − Total Expenditure (operating result). Lend
          and deposit do not affect P&L. Enter closing balance to reconcile
          cash.
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200"
            >
              <CheckIcon className="w-4 h-4" aria-hidden />
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
                const closing =
                  closingBalance.trim() === "" ? 0 : Number(closingBalance);
                if (!Number.isFinite(closing)) return;
                const result = await api.getProfitLoss(plYear, closing);
                setPlResult(result);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              <CalculatorIcon className="w-4 h-4" aria-hidden />
              Calculate
            </button>
          </div>
        </div>
        {plResult && (
          <div className="text-sm space-y-1 border-t pt-3">
            <p>Opening Balance: {formatRupee(plResult.openingBalance)}</p>
            <p>Total Sale: {formatRupee(plResult.totalSale)}</p>
            <p>Total Expenditure: {formatRupee(plResult.totalExpenditure)}</p>
            {(plResult.totalLend !== 0 || plResult.totalDeposit !== 0) && (
              <>
                <p>Total Lend (cash out): {formatRupee(plResult.totalLend)}</p>
                <p>
                  Total Deposit (cash in): {formatRupee(plResult.totalDeposit)}
                </p>
              </>
            )}
            <p>Closing Balance: {formatRupee(plResult.closingBalance)}</p>
            <p className="font-medium pt-2">
              Profit/Loss (Sale − Expenditure):{" "}
              <span
                className={
                  plResult.profitLoss >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {formatRupee(Math.abs(plResult.profitLoss))}
              </span>
            </p>
            <p className="text-gray-500 pt-2">
              Expected closing (incl. lend/deposit):{" "}
              {formatRupee(plResult.expectedClosing)} · Cash variance:{" "}
              <span
                className={
                  plResult.cashVariance >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {formatRupee(Math.abs(plResult.cashVariance))}
              </span>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
