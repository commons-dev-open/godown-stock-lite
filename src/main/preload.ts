import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  // Items
  getItems: () => ipcRenderer.invoke("items:getAll"),
  getItemsPage: (opts: { search?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("items:getPage", opts),
  createItem: (item: {
    name: string;
    code?: string;
    unit: string;
    current_stock: number;
    reorder_level?: number;
  }) => ipcRenderer.invoke("items:create", item),
  updateItem: (
    id: number,
    item: {
      name?: string;
      code?: string;
      unit?: string;
      current_stock?: number;
      reorder_level?: number;
    }
  ) => ipcRenderer.invoke("items:update", id, item),
  deleteItem: (id: number) => ipcRenderer.invoke("items:delete", id),
  addStock: (id: number, quantity: number) =>
    ipcRenderer.invoke("items:addStock", id, quantity),
  reduceStock: (id: number, quantity: number) =>
    ipcRenderer.invoke("items:reduceStock", id, quantity),

  // Mahajans
  getMahajans: () => ipcRenderer.invoke("mahajans:getAll"),
  getMahajansPage: (opts: { search?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("mahajans:getPage", opts),
  createMahajan: (m: {
    name: string;
    address?: string;
    phone?: string;
    gstin?: string;
  }) => ipcRenderer.invoke("mahajans:create", m),
  updateMahajan: (
    id: number,
    m: { name?: string; address?: string; phone?: string; gstin?: string }
  ) => ipcRenderer.invoke("mahajans:update", id, m),
  deleteMahajan: (id: number) => ipcRenderer.invoke("mahajans:delete", id),

  // Mahajan Lends
  getMahajanLends: (mahajanId?: number) =>
    ipcRenderer.invoke("mahajanLends:getAll", mahajanId),
  createMahajanLend: (l: {
    mahajan_id: number;
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    transaction_date: string;
    amount: number;
    notes?: string;
  }) => ipcRenderer.invoke("mahajanLends:create", l),
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
  }) => ipcRenderer.invoke("mahajanLends:createBatch", payload),
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
  ) => ipcRenderer.invoke("mahajanLends:update", id, l),
  deleteMahajanLend: (id: number) =>
    ipcRenderer.invoke("mahajanLends:delete", id),

  // Mahajan Deposits
  getMahajanDeposits: (mahajanId?: number) =>
    ipcRenderer.invoke("mahajanDeposits:getAll", mahajanId),

  // Mahajan Ledger (unified lends + deposits, paginated)
  getMahajanLedgerPage: (opts: {
    mahajanId?: number | null;
    transactionType?: "all" | "lend" | "deposit" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => ipcRenderer.invoke("mahajanLedger:getPage", opts),
  createMahajanDeposit: (d: {
    mahajan_id: number;
    transaction_date: string;
    amount: number;
    notes?: string;
  }) => ipcRenderer.invoke("mahajanDeposits:create", d),
  updateMahajanDeposit: (
    id: number,
    d: { transaction_date?: string; amount?: number; notes?: string }
  ) => ipcRenderer.invoke("mahajanDeposits:update", id, d),
  deleteMahajanDeposit: (id: number) =>
    ipcRenderer.invoke("mahajanDeposits:delete", id),

  // Daily Sales
  getDailySales: (fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke("dailySales:getAll", fromDate, toDate),
  getDailySalesPage: (opts: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => ipcRenderer.invoke("dailySales:getPage", opts),
  createDailySale: (s: {
    sale_date: string;
    sale_amount: number;
    cash_in_hand: number;
    expenditure_amount?: number;
    notes?: string;
  }) => ipcRenderer.invoke("dailySales:create", s),
  updateDailySale: (
    id: number,
    s: {
      sale_date?: string;
      sale_amount?: number;
      cash_in_hand?: number;
      expenditure_amount?: number;
      notes?: string;
    }
  ) => ipcRenderer.invoke("dailySales:update", id, s),
  deleteDailySale: (id: number) => ipcRenderer.invoke("dailySales:delete", id),

  // Purchases
  getPurchases: (fromDate?: string, toDate?: string) =>
    ipcRenderer.invoke("purchases:getAll", fromDate, toDate),
  getPurchasesPage: (opts: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => ipcRenderer.invoke("purchases:getPage", opts),
  createPurchase: (p: {
    product_id: number;
    transaction_date: string;
    quantity: number;
    amount: number;
    notes?: string;
  }) => ipcRenderer.invoke("purchases:create", p),
  createPurchaseBatch: (payload: {
    transaction_date: string;
    notes?: string;
    lines: { product_id: number; quantity: number; amount: number }[];
  }) => ipcRenderer.invoke("purchases:createBatch", payload),
  updatePurchase: (
    id: number,
    p: {
      transaction_date?: string;
      quantity?: number;
      amount?: number;
      notes?: string;
    }
  ) => ipcRenderer.invoke("purchases:update", id, p),
  deletePurchase: (id: number) => ipcRenderer.invoke("purchases:delete", id),

  // Reports
  getMahajanBalance: (mahajanId: number) =>
    ipcRenderer.invoke("reports:getMahajanBalance", mahajanId),
  getMahajanLedger: (mahajanId: number) =>
    ipcRenderer.invoke("reports:getMahajanLedger", mahajanId),
  getWeeklySale: (fromDate: string) =>
    ipcRenderer.invoke("reports:getWeeklySale", fromDate),
  getTotalSale: (fromDate: string, toDate: string) =>
    ipcRenderer.invoke("reports:getTotalSale", fromDate, toDate),
  getOpeningBalance: (year: number) =>
    ipcRenderer.invoke("reports:getOpeningBalance", year),
  setOpeningBalance: (year: number, amount: number) =>
    ipcRenderer.invoke("reports:setOpeningBalance", year, amount),
  getProfitLoss: (year: number, closingBalance: number) =>
    ipcRenderer.invoke("reports:getProfitLoss", year, closingBalance),
};

contextBridge.exposeInMainWorld("electron", electronAPI);
