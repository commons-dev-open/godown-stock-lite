export interface WeeklyRow {
  sale_date: string;
  sale_amount: number;
  cash_in_hand: number;
  expenditure_amount: number | null;
  invoice_sales?: number;
  misc_sales?: number;
}

export interface ThemePalette {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentSubtle: string;
  success: string;
  warning: string;
}

export interface DatePreset {
  label: string;
  getFrom: () => string;
  getTo: () => string;
}

export interface LowStockItem {
  id: number;
  name: string;
  current_stock: number;
  reorder_level: number;
  unit: string;
}
