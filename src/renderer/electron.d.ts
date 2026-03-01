export interface ElectronAPI {
  getItems: () => Promise<unknown[]>;
  getItemsPage: (opts: {
    search?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: unknown[]; total: number }>;
  getItemById: (id: number) => Promise<{
    id: number;
    name: string;
    code: string | null;
    unit: string;
    retail_primary_unit: string | null;
    current_stock: number;
    reorder_level: number | null;
    created_at: string;
    updated_at: string;
    other_units: { id: number; unit: string; sort_order: number }[];
  }>;
  createItem: (item: {
    name: string;
    code?: string;
    unit: string;
    retail_primary_unit?: string | null;
    current_stock?: number;
    reorder_level?: number;
    other_units?: { unit: string; sort_order?: number }[];
  }) => Promise<number>;
  updateItem: (
    id: number,
    item: {
      name?: string;
      code?: string;
      unit?: string;
      retail_primary_unit?: string | null;
      current_stock?: number;
      reorder_level?: number;
      other_units?: { unit: string; sort_order?: number }[];
    }
  ) => Promise<number>;
  deleteItem: (id: number) => Promise<number>;
  addStock: (id: number, quantity: number) => Promise<number>;
  reduceStock: (id: number, quantity: number) => Promise<number>;
  getUnits: () => Promise<
    { id: number; name: string; symbol: string | null; created_at: string }[]
  >;
  createUnit: (
    nameOrPayload: string | { name: string; symbol?: string | null }
  ) => Promise<string>;
  updateUnit: (
    id: number,
    payload: { name?: string; symbol?: string | null }
  ) => Promise<number>;
  deleteUnit: (id: number) => Promise<number>;
  getInvoiceUnits: () => Promise<
    {
      id: number;
      name: string;
      symbol: string | null;
      sort_order: number;
      created_at: string;
    }[]
  >;
  createInvoiceUnit: (payload: {
    name: string;
    symbol?: string | null;
    sort_order?: number;
  }) => Promise<number>;
  updateInvoiceUnit: (
    id: number,
    payload: { name?: string; symbol?: string | null; sort_order?: number }
  ) => Promise<number>;
  deleteInvoiceUnit: (id: number) => Promise<number>;
  getSettings: () => Promise<Record<string, string>>;
  getSetting: (key: string) => Promise<string>;
  setSetting: (key: string, value: string) => Promise<void>;
  setSettings: (obj: Record<string, string>) => Promise<void>;
  getInvoices: () => Promise<unknown[]>;
  getInvoicesPage: (opts: {
    search?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => Promise<{ data: unknown[]; total: number }>;
  getInvoiceById: (id: number) => Promise<unknown>;
  createInvoice: (payload: {
    invoice_number?: string | null;
    customer_name?: string | null;
    customer_address?: string | null;
    invoice_date: string;
    notes?: string | null;
    lines: {
      product_id: number;
      product_name: string;
      quantity: number;
      unit: string;
      price: number;
      amount: number;
      price_entered_as: "per_unit" | "total";
    }[];
  }) => Promise<number>;
  updateInvoice: (
    id: number,
    payload: {
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_address?: string | null;
      invoice_date?: string;
      notes?: string | null;
      lines: {
        product_id: number;
        product_name: string;
        quantity: number;
        unit: string;
        price: number;
        amount: number;
        price_entered_as: "per_unit" | "total";
      }[];
    }
  ) => Promise<number>;
  deleteInvoice: (id: number) => Promise<number>;
  getMahajans: () => Promise<unknown[]>;
  getMahajansPage: (opts: {
    search?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: unknown[]; total: number }>;
  createMahajan: (m: {
    name: string;
    address?: string;
    phone?: string;
    gstin?: string;
  }) => Promise<number>;
  updateMahajan: (
    id: number,
    m: { name?: string; address?: string; phone?: string; gstin?: string }
  ) => Promise<number>;
  deleteMahajan: (id: number) => Promise<number>;
  getMahajanLends: (mahajanId?: number) => Promise<unknown[]>;
  createMahajanLend: (l: {
    mahajan_id: number;
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    transaction_date: string;
    amount: number;
    notes?: string;
  }) => Promise<number>;
  createMahajanLendBatch: (payload: {
    mahajan_id: number;
    transaction_date: string;
    notes?: string;
    lines: {
      product_id: number;
      product_name?: string;
      quantity: number;
      amount: number;
    }[];
  }) => Promise<number[]>;
  updateMahajanLend: (
    id: number,
    l: {
      mahajan_id?: number;
      product_id?: number | null;
      product_name?: string;
      quantity?: number;
      transaction_date?: string;
      amount?: number;
      notes?: string;
    }
  ) => Promise<number>;
  deleteMahajanLend: (id: number) => Promise<number>;
  getMahajanDeposits: (mahajanId?: number) => Promise<unknown[]>;
  getMahajanLedgerPage: (opts: {
    mahajanId?: number | null;
    transactionType?: "all" | "lend" | "deposit" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: unknown[]; total: number }>;
  createMahajanDeposit: (d: {
    mahajan_id: number;
    transaction_date: string;
    amount: number;
    notes?: string;
  }) => Promise<number>;
  updateMahajanDeposit: (
    id: number,
    d: { transaction_date?: string; amount?: number; notes?: string }
  ) => Promise<number>;
  deleteMahajanDeposit: (id: number) => Promise<number>;
  getDailySales: (fromDate?: string, toDate?: string) => Promise<unknown[]>;
  getDailySalesPage: (opts: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: unknown[]; total: number }>;
  createDailySale: (s: {
    sale_date: string;
    sale_amount: number;
    cash_in_hand: number;
    expenditure_amount?: number;
    notes?: string;
  }) => Promise<number>;
  updateDailySale: (
    id: number,
    s: {
      sale_date?: string;
      sale_amount?: number;
      cash_in_hand?: number;
      expenditure_amount?: number;
      notes?: string;
    }
  ) => Promise<number>;
  deleteDailySale: (id: number) => Promise<number>;
  getPurchases: (fromDate?: string, toDate?: string) => Promise<unknown[]>;
  getPurchasesPage: (opts: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: unknown[]; total: number }>;
  createPurchase: (p: {
    product_id: number;
    transaction_date: string;
    quantity: number;
    amount: number;
    notes?: string;
  }) => Promise<number>;
  createPurchaseBatch: (payload: {
    transaction_date: string;
    notes?: string;
    lines: { product_id: number; quantity: number; amount: number }[];
  }) => Promise<number[]>;
  updatePurchase: (
    id: number,
    p: {
      transaction_date?: string;
      quantity?: number;
      amount?: number;
      notes?: string;
    }
  ) => Promise<number>;
  deletePurchase: (id: number) => Promise<number>;
  getTotalLend: () => Promise<{ totalLend: number }>;
  getMahajanSummary: () => Promise<{
    totalLend: number;
    totalDeposit: number;
    balance: number;
    countOweMe: number;
    countIOwe: number;
  }>;
  getAllMahajanBalances: () => Promise<{ balances: Record<number, number> }>;
  getMahajanBalance: (
    mahajanId: number
  ) => Promise<{ totalLends: number; totalDeposits: number; balance: number }>;
  getMahajanLedger: (mahajanId: number) => Promise<unknown[]>;
  getWeeklySale: (fromDate: string) => Promise<unknown[]>;
  getTotalSale: (
    fromDate: string,
    toDate: string
  ) => Promise<{ total: number; expenditure: number }>;
  getOpeningBalance: (year: number) => Promise<number>;
  setOpeningBalance: (year: number, amount: number) => Promise<number>;
  getProfitLoss: (
    year: number,
    closingBalance: number
  ) => Promise<{
    openingBalance: number;
    totalSale: number;
    totalExpenditure: number;
    closingBalance: number;
    profitLoss: number;
  }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
