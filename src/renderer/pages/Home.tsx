import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import DataTable from "../components/DataTable";
import { formatDateForView, formatDateForForm, todayISO } from "../lib/date";
import Tooltip from "../components/Tooltip";
import {
  DashboardEmptyState,
  DashboardHero,
  DashboardSectionBoundary,
  LenderSummarySection,
  LowStockAlertsSection,
  QuickActionsSection,
  RangeCompositionSection,
  WeeklyDetailsSection,
  WeeklyMomentumSection,
} from "../components/home-dashboard";
import {
  DATE_PRESETS,
  getMonthStart,
} from "../components/home-dashboard/datePresets";
import {
  createCashExpenditureOption,
  createRangeBreakdownOption,
  createWeeklyTrendOption,
  getThemePalette,
} from "../components/home-dashboard/chartOptions";
import {
  type DatePreset,
  type LowStockItem,
  type WeeklyRow,
} from "../components/home-dashboard/types";
import {
  formatDecimal,
  formatAbbreviatedRupee,
  formatRupee,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";

interface ReportSummary {
  todaySale: number;
  weekSale: number;
  monthSale: number;
}

interface MahajanSummary {
  totalLend: number;
  totalDeposit: number;
  balance: number;
  countOweMe: number;
  countIOwe: number;
  totalCreditPurchase?: number;
  totalSettlement?: number;
}

interface TotalSaleResult {
  invoice_sales?: number;
  misc_sales?: number;
  expenditure?: number;
  total: number;
}

function netBalanceClass(balance: number): string {
  if (balance > 0) return "text-[var(--color-danger)]";
  if (balance < 0) return "text-[var(--color-success)]";
  return "text-[var(--color-text-primary)]";
}

export default function Home() {
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const defaultTotalFrom = useMemo(() => getMonthStart(), []);
  const defaultTotalTo = useMemo(() => todayISO(), []);
  const [weeklyDate, setWeeklyDate] = useState(todayISO());
  const [totalFrom, setTotalFrom] = useState(defaultTotalFrom);
  const [totalTo, setTotalTo] = useState(defaultTotalTo);

  const { data: reportSummary, isLoading: reportSummaryLoading } =
    useQuery<ReportSummary>({
      queryKey: ["reportSummary"],
      queryFn: () => api.getReportSummary(),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });
  const { data: mahajanSummary, isLoading: mahajanSummaryLoading } =
    useQuery<MahajanSummary>({
      queryKey: ["mahajanSummary"],
      queryFn: () => api.getMahajanSummary(),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });
  const {
    data: lowStockItemsData,
    isLoading: lowStockLoading,
    isError: lowStockError,
  } = useQuery<LowStockItem[]>({
    queryKey: ["lowStockItems"],
    queryFn: async () => (await api.getLowStockItems()) as LowStockItem[],
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
  const {
    data: weeklySalesData,
    isLoading: weeklyLoading,
    isError: weeklyError,
  } = useQuery<WeeklyRow[]>({
    queryKey: ["weeklySale", weeklyDate],
    queryFn: async () => (await api.getWeeklySale(weeklyDate)) as WeeklyRow[],
    enabled: !!weeklyDate,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const { data: totalSaleResult, isLoading: totalSaleLoading } =
    useQuery<TotalSaleResult>({
      queryKey: ["totalSale", totalFrom, totalTo],
      queryFn: () => api.getTotalSale(totalFrom, totalTo),
      enabled: !!totalFrom && !!totalTo,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    });

  const lowStockItems = lowStockItemsData ?? [];
  const weeklySales = weeklySalesData ?? [];

  const applyPreset = useCallback((preset: DatePreset) => {
    setTotalFrom(preset.getFrom());
    setTotalTo(preset.getTo());
  }, []);
  const handlePresetClick = useCallback(
    (label: string) => {
      const selectedPreset = DATE_PRESETS.find(
        (preset) => preset.label === label
      );
      if (!selectedPreset) {
        return;
      }
      applyPreset(selectedPreset);
    },
    [applyPreset]
  );
  const isPresetActive = useCallback(
    (preset: DatePreset) => {
      return totalFrom === preset.getFrom() && totalTo === preset.getTo();
    },
    [totalFrom, totalTo]
  );
  const isPresetLabelActive = useCallback(
    (label: string) => {
      const selectedPreset = DATE_PRESETS.find(
        (preset) => preset.label === label
      );
      if (!selectedPreset) {
        return false;
      }
      return isPresetActive(selectedPreset);
    },
    [isPresetActive]
  );

  const palette = useMemo(
    () => getThemePalette(),
    [weeklySales.length, totalSaleResult]
  );
  const orderedWeeklyData = useMemo(
    () => [...weeklySales].reverse(),
    [weeklySales]
  );
  const totalWeekSales = useMemo(
    () =>
      orderedWeeklyData.reduce((sum, row) => sum + (row.sale_amount ?? 0), 0),
    [orderedWeeklyData]
  );
  const totalWeekExpenditure = useMemo(
    () =>
      orderedWeeklyData.reduce(
        (sum, row) => sum + (row.expenditure_amount ?? 0),
        0
      ),
    [orderedWeeklyData]
  );

  const peakWeekSale = useMemo(
    () =>
      orderedWeeklyData.reduce(
        (maxValue, row) => Math.max(maxValue, row.sale_amount ?? 0),
        0
      ),
    [orderedWeeklyData]
  );
  const hasWeeklySales = orderedWeeklyData.length > 0;
  const hasRangeData =
    (totalSaleResult?.invoice_sales ?? 0) > 0 ||
    (totalSaleResult?.misc_sales ?? 0) > 0 ||
    (totalSaleResult?.expenditure ?? 0) > 0;
  const todaySaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.todaySale ?? 0, abbreviationStyle);
  const weekSaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.weekSale ?? 0, abbreviationStyle);
  const monthSaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.monthSale ?? 0, abbreviationStyle);
  const lenderNetLabel = mahajanSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(
        Math.abs(mahajanSummary?.balance ?? 0),
        abbreviationStyle
      );

  const weeklyTrendOption = useMemo(
    () => createWeeklyTrendOption(orderedWeeklyData, palette),
    [orderedWeeklyData, palette]
  );
  const breakdownOption = useMemo(
    () => createRangeBreakdownOption(totalSaleResult ?? {}, palette),
    [totalSaleResult, palette]
  );
  const cashExpenditureOption = useMemo(
    () => createCashExpenditureOption(orderedWeeklyData, palette),
    [orderedWeeklyData, palette]
  );

  const lowStockContent = useMemo(() => {
    if (lowStockError) {
      return (
        <p className="text-sm text-[var(--color-danger)]">
          Error loading low stock items. Try refreshing.
        </p>
      );
    }
    if (lowStockLoading) {
      return <TableLoader />;
    }
    if (lowStockItems.length === 0) {
      return (
        <DashboardEmptyState
          title="No low stock items"
          description="All tracked items are above reorder level right now. Update reorder values in Products & Stock to get actionable alerts."
          actionLabel="Go to Stock"
          actionTo="/stock"
        />
      );
    }
    return (
      <DataTable<LowStockItem>
        scrollHeightPreset="compact"
        columns={[
          { key: "name", label: "Item" },
          {
            key: "current_stock",
            label: "Current",
            render: (item: LowStockItem) => {
              const isZero = item.current_stock === 0;
              const colorClass = isZero
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-warning-text)]";
              const dotClass = isZero
                ? "bg-[var(--color-danger)]"
                : "bg-[var(--color-warning)]";
              return (
                <span className={`inline-flex items-center justify-end ${colorClass}`}>
                  <span
                    className={`w-2 h-2 rounded-full inline-block mr-2 ${dotClass}`}
                  />
                  {formatDecimal(item.current_stock)}
                </span>
              );
            },
          },
          {
            key: "reorder_level",
            label: "Reorder At",
            render: (item: LowStockItem) => (
              <span className="block text-right">
                {formatDecimal(item.reorder_level)}
              </span>
            ),
          },
          { key: "unit", label: "Unit" },
        ]}
        data={lowStockItems}
        pagination={{ type: "client" }}
      />
    );
  }, [lowStockError, lowStockItems, lowStockLoading]);

  let weeklyTrendContent: ReactNode;
  if (weeklyLoading) {
    weeklyTrendContent = <div className="dashboard-chart-skeleton" />;
  } else if (weeklyError) {
    weeklyTrendContent = (
      <DashboardEmptyState
        title="Unable to load weekly trend"
        description="Something went wrong while fetching weekly sales. Please refresh and try again."
      />
    );
  } else if (hasWeeklySales) {
    weeklyTrendContent = (
      <ReactECharts
        option={weeklyTrendOption}
        notMerge
        lazyUpdate
        style={{ height: 280 }}
      />
    );
  } else {
    weeklyTrendContent = (
      <DashboardEmptyState
        title="No sales in this week"
        description="No sale entries were found for the selected date window. Add invoices or misc sales to populate this trend."
        actionLabel="Create Invoice"
        actionTo="/invoices"
      />
    );
  }

  let rangeCompositionContent: ReactNode;
  if (totalSaleLoading) {
    rangeCompositionContent = (
      <div className="dashboard-chart-skeleton h-[240px]" />
    );
  } else if (totalSaleResult && hasRangeData) {
    rangeCompositionContent = (
      <>
        <ReactECharts
          option={breakdownOption}
          notMerge
          lazyUpdate
          style={{ height: 228 }}
        />
      </>
    );
  } else {
    rangeCompositionContent = (
      <DashboardEmptyState
        title="No range data yet"
        description="There are no invoices, misc sales, or expenditure records for the selected date range."
        actionLabel="Create Invoice"
        actionTo="/invoices"
      />
    );
  }

  let cashExpenditureContent: ReactNode;
  if (weeklyLoading) {
    cashExpenditureContent = (
      <div className="dashboard-chart-skeleton h-[148px]" />
    );
  } else if (hasWeeklySales) {
    cashExpenditureContent = (
      <ReactECharts
        option={cashExpenditureOption}
        notMerge
        lazyUpdate
        style={{ height: 148 }}
      />
    );
  } else {
    cashExpenditureContent = (
      <DashboardEmptyState
        title="No weekly cash trend"
        description="Cash in hand and expenditure chart appears when weekly sales records are available."
      />
    );
  }

  let weeklyDetailsContent: ReactNode;
  if (weeklyLoading) {
    weeklyDetailsContent = <TableLoader />;
  } else if (weeklyError) {
    weeklyDetailsContent = (
      <DashboardEmptyState
        title="Unable to load sale details"
        description="Weekly entries could not be loaded right now. Refresh and try again."
      />
    );
  } else if (hasWeeklySales) {
    weeklyDetailsContent = (
      <DataTable<WeeklyRow>
        columns={[
          {
            key: "sale_date",
            label: "Date",
            render: (sale) => (
              <Tooltip content={formatDateForForm(sale.sale_date)}>
                <span>{formatDateForView(sale.sale_date)}</span>
              </Tooltip>
            ),
          },
          {
            key: "sale_amount",
            label: "Sale",
            render: (sale) => (
              <span className="block text-right tabular-nums">
                {formatRupee(sale.sale_amount)}
              </span>
            ),
          },
          {
            key: "invoice_sales",
            label: "Invoice",
            render: (sale) => (
              <span className="block text-right tabular-nums">
                {formatRupee(sale.invoice_sales ?? 0)}
              </span>
            ),
          },
          {
            key: "misc_sales",
            label: "Misc",
            render: (sale) => (
              <span className="block text-right tabular-nums">
                {formatRupee(sale.misc_sales ?? 0)}
              </span>
            ),
          },
          {
            key: "cash_in_hand",
            label: "Cash in Hand",
            render: (sale) => (
              <span className="block text-right tabular-nums">
                {formatRupee(sale.cash_in_hand)}
              </span>
            ),
          },
          {
            key: "expenditure_amount",
            label: "Expenditure",
            render: (sale) => (
              <span className="block text-right tabular-nums">
                {formatRupee(sale.expenditure_amount ?? 0)}
              </span>
            ),
          },
        ]}
        data={weeklySales}
        pagination={{ type: "client" }}
      />
    );
  } else {
    weeklyDetailsContent = (
      <DashboardEmptyState
        title="No sale entries found"
        description="No 7-day entries exist for the selected date. Change the date or add a new invoice."
        actionLabel="Create Invoice"
        actionTo="/invoices"
      />
    );
  }

  let lenderSummaryContent: ReactNode;
  if (mahajanSummaryLoading) {
    lenderSummaryContent = (
      <div className="space-y-3">
        <div className="dashboard-chart-skeleton h-[74px]" />
        <div className="dashboard-chart-skeleton h-[74px]" />
        <div className="dashboard-chart-skeleton h-[86px]" />
      </div>
    );
  } else if (mahajanSummary) {
    lenderSummaryContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="dashboard-mini-stat">
          <p className="text-[var(--color-text-tertiary)]">
            Total Credit Purchase
          </p>
          <p className="font-medium text-[var(--color-text-primary)]">
            {formatRupee(
              mahajanSummary.totalCreditPurchase ?? mahajanSummary.totalLend
            )}
          </p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-[var(--color-text-tertiary)]">Total Settlements</p>
          <p className="font-medium text-[var(--color-text-primary)]">
            {formatRupee(
              mahajanSummary.totalSettlement ?? mahajanSummary.totalDeposit
            )}
          </p>
        </div>
        <div className="dashboard-mini-stat sm:col-span-2">
          <p className="text-[var(--color-text-tertiary)]">Net Balance</p>
          <p
            className={`font-semibold ${netBalanceClass(mahajanSummary.balance)}`}
          >
            {formatRupee(Math.abs(mahajanSummary.balance))}
            {mahajanSummary.balance > 0 ? (
              <span className="text-[var(--color-text-tertiary)] font-normal">
                {" "}
                (payable)
              </span>
            ) : null}
            {mahajanSummary.balance < 0 ? (
              <span className="text-[var(--color-text-tertiary)] font-normal">
                {" "}
                (receivable)
              </span>
            ) : null}
          </p>
          {mahajanSummary.countOweMe > 0 || mahajanSummary.countIOwe > 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {mahajanSummary.countOweMe} receivable, {mahajanSummary.countIOwe}{" "}
              payable
            </p>
          ) : null}
        </div>
      </div>
    );
  } else {
    lenderSummaryContent = (
      <DashboardEmptyState
        title="No lender data"
        description="Lender summary appears after credit purchases or settlements are recorded."
        actionLabel="View Lenders"
        actionTo="/mahajans"
      />
    );
  }

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <DashboardHero
        todaySaleLabel={todaySaleLabel}
        weekSaleLabel={weekSaleLabel}
        monthSaleLabel={monthSaleLabel}
        lenderNetLabel={lenderNetLabel}
        lenderNetClassName={netBalanceClass(mahajanSummary?.balance ?? 0)}
      />
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DashboardSectionBoundary
          sectionTitle="7-Day Sale Momentum"
          containerClassName="dashboard-panel xl:col-span-2 min-h-[23rem]"
          resetKeys={[weeklyDate, orderedWeeklyData.length]}
        >
          <WeeklyMomentumSection
            weeklyDate={weeklyDate}
            content={weeklyTrendContent}
            totalWeekSales={totalWeekSales}
            totalWeekExpenditure={totalWeekExpenditure}
            peakWeekSale={peakWeekSale}
            entriesCount={orderedWeeklyData.length}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle="Range Composition"
          containerClassName="dashboard-panel min-h-[23rem]"
          resetKeys={[totalFrom, totalTo, totalSaleResult?.total ?? 0]}
        >
          <RangeCompositionSection
            totalFrom={totalFrom}
            totalTo={totalTo}
            onFromChange={setTotalFrom}
            onToChange={setTotalTo}
            onPresetClick={handlePresetClick}
            isPresetActive={isPresetLabelActive}
            content={rangeCompositionContent}
          />
        </DashboardSectionBoundary>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <DashboardSectionBoundary
          sectionTitle="Quick Actions"
          containerClassName="dashboard-panel xl:col-span-4"
          resetKeys={[weeklyDate, orderedWeeklyData.length]}
        >
          <QuickActionsSection
            cashExpenditureContent={cashExpenditureContent}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle="Low Stock Alerts"
          containerClassName="dashboard-panel xl:col-span-8"
          resetKeys={[lowStockItems.length, lowStockLoading, lowStockError]}
        >
          <LowStockAlertsSection
            count={lowStockItems.length}
            content={lowStockContent}
          />
        </DashboardSectionBoundary>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DashboardSectionBoundary
          sectionTitle="Weekly Sale Detail"
          containerClassName="dashboard-panel xl:col-span-2"
          resetKeys={[weeklyDate, orderedWeeklyData.length, weeklyLoading]}
        >
          <WeeklyDetailsSection
            weeklyDate={weeklyDate}
            onWeeklyDateChange={setWeeklyDate}
            onSetToday={() => setWeeklyDate(todayISO())}
            content={weeklyDetailsContent}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle="Lender Summary"
          containerClassName="dashboard-panel"
          resetKeys={[mahajanSummaryLoading, mahajanSummary?.balance ?? 0]}
        >
          <LenderSummarySection content={lenderSummaryContent} />
        </DashboardSectionBoundary>
      </section>
    </div>
  );
}
