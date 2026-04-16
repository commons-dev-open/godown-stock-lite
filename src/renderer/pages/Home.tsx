import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ExternalLink,
  AlertTriangle,
  FilePlus,
  Banknote,
} from "lucide-react";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import Table from "../components/Table";
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
  if (balance > 0) return "text-[var(--color-danger)]";
  if (balance < 0) return "text-[var(--color-success)]";
  return "text-[var(--color-text-primary)]";
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
  const api = getElectron();
  const defaultTotalFrom = useMemo(() => getMonthStart(), []);
  const defaultTotalTo = useMemo(() => todayISO(), []);

  const [weeklyDate, setWeeklyDate] = useState(todayISO());
  const [totalFrom, setTotalFrom] = useState(defaultTotalFrom);
  const [totalTo, setTotalTo] = useState(defaultTotalTo);

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

  const applyPreset = (preset: (typeof DATE_PRESETS)[number]) => {
    setTotalFrom(preset.getFrom());
    setTotalTo(preset.getTo());
  };

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-20 bg-[var(--color-bg-app)] pt-6 pb-3 -mb-5">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">Home</h1>
      </div>

      {/* Executive Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportSummary && (
          <>
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
              <p className="text-sm text-[var(--color-text-tertiary)]">Today&apos;s Sale</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)] mt-1">
                {formatRupee(reportSummary.todaySale)}
              </p>
            </div>
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
              <p className="text-sm text-[var(--color-text-tertiary)]">This Week (7 days)</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)] mt-1">
                {formatRupee(reportSummary.weekSale)}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Expenditure: {formatRupee(reportSummary.weekExpenditure)}
              </p>
            </div>
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
              <p className="text-sm text-[var(--color-text-tertiary)]">This Month</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)] mt-1">
                {formatRupee(reportSummary.monthSale)}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Expenditure: {formatRupee(reportSummary.monthExpenditure)}
              </p>
            </div>
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
              <p className="text-sm text-[var(--color-text-tertiary)]">Lender Net</p>
              <p
                className={`text-xl font-semibold mt-1 ${mahajanSummary ? netBalanceClass(mahajanSummary.balance) : "text-[var(--color-text-primary)]"}`}
              >
                {mahajanSummary
                  ? formatRupee(Math.abs(mahajanSummary.balance))
                  : formatRupee(0)}
              </p>
              {mahajanSummary &&
                (mahajanSummary.countOweMe > 0 ||
                  mahajanSummary.countIOwe > 0) && (
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    {mahajanSummary.countOweMe} receivable,{" "}
                    {mahajanSummary.countIOwe} payable
                  </p>
                )}
            </div>
          </>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          to="/invoices"
          state={{ openCreate: true }}
          className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow flex items-center gap-3"
        >
          <FilePlus size={24} className="text-[var(--color-accent)] shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">New Invoice</span>
        </Link>
        <Link
          to="/transactions"
          state={{ openLend: true }}
          className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow flex items-center gap-3"
        >
          <Banknote size={24} className="text-[var(--color-success)] shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">New Credit Purchase</span>
        </Link>
      </section>

      {/* Weekly Sale */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">Weekly Sale</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-2">
          Select a date to see 7 days of entries (descending from that date).
        </p>
        <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] overflow-hidden mb-4">
          <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
            Date
            <DateInput
              value={weeklyDate}
              onChange={setWeeklyDate}
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
            />
          </label>
          <button
            type="button"
            onClick={() => setWeeklyDate(todayISO())}
            className="inline-flex items-center gap-1 shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Today
          </button>
        </div>
        {weeklyLoading ? (
          <TableLoader />
        ) : (
          <Table<WeeklyRow>
            columns={[
              {
                key: "sale_date",
                label: "Date",
                render: (s) => (
                  <Tooltip content={formatDateForForm(s.sale_date)}>
                    <span>{formatDateForView(s.sale_date)}</span>
                  </Tooltip>
                ),
              },
              {
                key: "sale_amount",
                label: "Sale",
                align: "right",
                render: (s) => formatRupee(s.sale_amount),
              },
              {
                key: "invoice_sales",
                label: "Invoice",
                align: "right",
                render: (s) => formatRupee(s.invoice_sales ?? 0),
              },
              {
                key: "misc_sales",
                label: "Misc",
                align: "right",
                render: (s) => formatRupee(s.misc_sales ?? 0),
              },
              {
                key: "cash_in_hand",
                label: "Cash in Hand",
                align: "right",
                render: (s) => formatRupee(s.cash_in_hand),
              },
              {
                key: "expenditure_amount",
                label: "Expenditure",
                align: "right",
                render: (s) => formatRupee(s.expenditure_amount ?? 0),
              },
            ]}
            data={weeklySales as WeeklyRow[]}
            getRowKey={(s) => s.sale_date}
          />
        )}
      </section>

      {/* Total Sale */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">Total Sale</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-2">
          Enter date range or use presets to get total sale and breakdown.
        </p>
        <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] mb-4">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm text-[var(--color-text-secondary)]">From</label>
            <DateInput
              value={totalFrom}
              onChange={setTotalFrom}
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-sm text-[var(--color-text-secondary)]">To</label>
            <DateInput
              value={totalTo}
              onChange={setTotalTo}
              className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-surface-raised)]"
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
            className="inline-flex items-center gap-1 shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X size={16} aria-hidden="true" />
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

      {/* Lender Summary */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Lender Summary</h2>
          <Link
            to="/mahajans"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            View Lenders
            <ExternalLink size={16} aria-hidden="true" />
          </Link>
        </div>
        {mahajanSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[var(--color-text-tertiary)]">Total Credit Purchase</p>
              <p className="font-medium">
                {formatRupee((mahajanSummary as any).totalCreditPurchase ?? mahajanSummary.totalLend)}
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text-tertiary)]">Total Settlements</p>
              <p className="font-medium">
                {formatRupee((mahajanSummary as any).totalSettlement ?? mahajanSummary.totalDeposit)}
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text-tertiary)]">Net Balance</p>
              <p
                className={`font-medium ${netBalanceClass(mahajanSummary.balance)}`}
              >
                {formatRupee(Math.abs(mahajanSummary.balance))}
                {mahajanSummary.balance > 0 && (
                  <span className="text-[var(--color-text-tertiary)] font-normal"> (payable)</span>
                )}
                {mahajanSummary.balance < 0 && (
                  <span className="text-[var(--color-text-tertiary)] font-normal">
                    {" "}
                    (receivable)
                  </span>
                )}
              </p>
              {mahajanSummary.countOweMe > 0 && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {mahajanSummary.countOweMe} receivable
                </p>
              )}
              {mahajanSummary.countIOwe > 0 && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {mahajanSummary.countIOwe} payable
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-tertiary)]">No lender data.</p>
        )}
      </section>

      {/* Low Stock Alerts */}
      <section className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-xs p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            Low Stock Alerts
            {lowStockItems.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning-text)]">
                <AlertTriangle size={14} aria-hidden="true" />
                {lowStockItems.length}
              </span>
            )}
          </h2>
          <Link
            to="/stock"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            View Stock
            <ExternalLink size={16} aria-hidden="true" />
          </Link>
        </div>
        {lowStockError ? (
          <p className="text-sm text-[var(--color-danger)]">
            Error loading low stock items. Try refreshing.
          </p>
        ) : lowStockLoading ? (
          <TableLoader />
        ) : lowStockItems.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No items below reorder level. Set a reorder level on items (Products
            & Stock page) to see alerts.
          </p>
        ) : (
          <Table
            columns={[
              { key: "name", label: "Item" },
              {
                key: "current_stock",
                label: "Current",
                align: "right",
                render: (item) => {
                  const isZero = item.current_stock === 0;
                  const colorClass = isZero ? "text-[var(--color-danger)]" : "text-[var(--color-warning-text)]";
                  const dotClass = isZero ? "bg-[var(--color-danger-subtle)]0" : "bg-[var(--color-warning-subtle)]0";
                  return (
                    <span className={`inline-flex items-center ${colorClass}`}>
                      <span className={`w-2 h-2 rounded-full inline-block mr-2 ${dotClass}`} />
                      {formatDecimal(item.current_stock)}
                    </span>
                  );
                },
              },
              {
                key: "reorder_level",
                label: "Reorder At",
                align: "right",
                render: (item) => formatDecimal(item.reorder_level),
              },
              { key: "unit", label: "Unit" },
            ]}
            data={lowStockItems}
            getRowKey={(item) => item.id}
          />
        )}
      </section>

    </div>
  );
}
