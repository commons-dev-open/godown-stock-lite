import { todayISO } from "../../lib/date";
import { type DatePreset } from "./types";

export function getMonthStart(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function getWeekStart(): string {
  return getDaysAgo(6);
}

export function getYearStart(): string {
  const year = new Date().getFullYear();
  return `${year}-01-01`;
}

export function getQuarterStart(): string {
  const date = new Date();
  const year = date.getFullYear();
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  const month = String(quarterStartMonth + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function getYesterday(): string {
  return getDaysAgo(1);
}

export function getLastMonthStart(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 10);
}

export function getLastMonthEnd(): string {
  const date = new Date();
  date.setDate(0);
  return date.toISOString().slice(0, 10);
}

export const DATE_PRESETS: readonly DatePreset[] = [
  {
    key: "today",
    label: "Today",
    getFrom: () => todayISO(),
    getTo: () => todayISO(),
  },
  {
    key: "yesterday",
    label: "Yesterday",
    getFrom: getYesterday,
    getTo: getYesterday,
  },
  {
    key: "last7Days",
    label: "Last 7 Days",
    getFrom: getWeekStart,
    getTo: () => todayISO(),
  },
  {
    key: "last14Days",
    label: "Last 14 Days",
    getFrom: () => getDaysAgo(13),
    getTo: () => todayISO(),
  },
  {
    key: "thisMonth",
    label: "This Month",
    getFrom: getMonthStart,
    getTo: () => todayISO(),
  },
  {
    key: "lastMonth",
    label: "Last Month",
    getFrom: getLastMonthStart,
    getTo: getLastMonthEnd,
  },
  {
    key: "last30Days",
    label: "Last 30 Days",
    getFrom: () => getDaysAgo(29),
    getTo: () => todayISO(),
  },
  {
    key: "last90Days",
    label: "Last 90days",
    getFrom: () => getDaysAgo(89),
    getTo: () => todayISO(),
  },
  {
    key: "thisQuarter",
    label: "This Quarter",
    getFrom: getQuarterStart,
    getTo: () => todayISO(),
  },
  { key: "thisYear", label: "This Year", getFrom: getYearStart, getTo: () => todayISO() },
];
