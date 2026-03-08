import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  // Items
  getItems: () => ipcRenderer.invoke("items:getAll"),
  getItemsWithUnits: () => ipcRenderer.invoke("items:getAllWithUnits"),
  getItemsPage: (opts: { search?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("items:getPage", opts),
  getItemById: (id: number) => ipcRenderer.invoke("items:getById", id),
  createItem: (item: {
    name: string;
    code?: string;
    unit: string;
    reference_unit?: string | null;
    quantity_per_primary?: number | null;
    retail_primary_unit?: string | null;
    selling_price?: number | null;
    selling_price_unit?: string | null;
    gst_rate?: number;
    hsn_code?: string | null;
    current_stock?: number;
    current_stock_value?: number;
    current_stock_unit?: string;
    reorder_level?: number;
    other_units?: { unit: string; sort_order?: number }[];
    conversions?: { to_unit: string; factor: number }[];
  }) => ipcRenderer.invoke("items:create", item),
  updateItem: (
    id: number,
    item: {
      name?: string;
      code?: string;
      unit?: string;
      reference_unit?: string | null;
      quantity_per_primary?: number | null;
      retail_primary_unit?: string | null;
      selling_price?: number | null;
      selling_price_unit?: string | null;
      gst_rate?: number;
      hsn_code?: string | null;
      current_stock?: number;
      current_stock_value?: number;
      current_stock_unit?: string;
      reorder_level?: number;
      other_units?: { unit: string; sort_order?: number }[];
      conversions?: { to_unit: string; factor: number }[];
    }
  ) => ipcRenderer.invoke("items:update", id, item),
  deleteItem: (id: number) => ipcRenderer.invoke("items:delete", id),
  addStock: (
    id: number,
    quantityOrPayload: number | { quantity: number; unit: string }
  ) => ipcRenderer.invoke("items:addStock", id, quantityOrPayload),
  reduceStock: (
    id: number,
    quantityOrPayload: number | { quantity: number; unit: string }
  ) => ipcRenderer.invoke("items:reduceStock", id, quantityOrPayload),
  getUnitConversions: () => ipcRenderer.invoke("unitConversions:getAll"),
  createUnitConversion: (payload: {
    from_unit: string;
    to_unit: string;
    factor: number;
  }) => ipcRenderer.invoke("unitConversions:create", payload),
  updateUnitConversion: (
    id: number,
    payload: { from_unit?: string; to_unit?: string; factor?: number }
  ) => ipcRenderer.invoke("unitConversions:update", id, payload),
  deleteUnitConversion: (id: number) =>
    ipcRenderer.invoke("unitConversions:delete", id),

  getUnitTypes: () => ipcRenderer.invoke("unitTypes:getAll"),
  createUnitType: (name: string) =>
    ipcRenderer.invoke("unitTypes:create", name),
  updateUnitType: (id: number, payload: { name?: string }) =>
    ipcRenderer.invoke("unitTypes:update", id, payload),
  deleteUnitType: (id: number) => ipcRenderer.invoke("unitTypes:delete", id),

  getUnits: () => ipcRenderer.invoke("units:getAll"),
  createUnit: (
    nameOrPayload:
      | string
      | { name: string; symbol?: string | null; unit_type_id?: number | null }
  ) => ipcRenderer.invoke("units:create", nameOrPayload),
  updateUnit: (
    id: number,
    payload: {
      name?: string;
      symbol?: string | null;
      unit_type_id?: number | null;
    }
  ) => ipcRenderer.invoke("units:update", id, payload),
  deleteUnit: (id: number) => ipcRenderer.invoke("units:delete", id),

  getInvoiceUnits: () => ipcRenderer.invoke("invoiceUnits:getAll"),
  createInvoiceUnit: (payload: {
    name: string;
    symbol?: string | null;
    unit_type_id?: number | null;
  }) => ipcRenderer.invoke("invoiceUnits:create", payload),
  updateInvoiceUnit: (
    id: number,
    payload: { name?: string; symbol?: string | null }
  ) => ipcRenderer.invoke("invoiceUnits:update", id, payload),
  deleteInvoiceUnit: (id: number) =>
    ipcRenderer.invoke("invoiceUnits:delete", id),

  getSettings: () => ipcRenderer.invoke("settings:getAll"),
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke("settings:set", key, value),
  setSettings: (obj: Record<string, string>) =>
    ipcRenderer.invoke("settings:setBulk", obj),

  getInvoices: () => ipcRenderer.invoke("invoices:getAll"),
  getInvoiceTotalForDate: (saleDate: string) =>
    ipcRenderer.invoke("invoices:getTotalForDate", saleDate) as Promise<{
      total: number;
    }>,
  getInvoicesPage: (opts: {
    search?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => ipcRenderer.invoke("invoices:getPage", opts),
  getInvoiceById: (id: number) => ipcRenderer.invoke("invoices:getById", id),
  getCustomerByPhone: (phone: string) =>
    ipcRenderer.invoke("customers:getByPhone", phone),
  createInvoice: (payload: {
    invoice_number?: string | null;
    customer_name?: string | null;
    customer_address?: string | null;
    customer_phone?: string | null;
    invoice_date: string;
    notes?: string | null;
    lines: {
      product_id: number;
      product_name: string;
      quantity: number;
      unit: string;
      price: number;
    }[];
  }) => ipcRenderer.invoke("invoices:create", payload),
  updateInvoice: (
    id: number,
    payload: {
      invoice_number?: string | null;
      customer_name?: string | null;
      customer_address?: string | null;
      customer_phone?: string | null;
      invoice_date?: string;
      notes?: string | null;
      lines: {
        product_id: number;
        product_name: string;
        quantity: number;
        unit: string;
        price: number;
      }[];
    }
  ) => ipcRenderer.invoke("invoices:update", id, payload),
  deleteInvoice: (id: number) => ipcRenderer.invoke("invoices:delete", id),

  // Lenders
  getLenders: () => ipcRenderer.invoke("lenders:getAll"),
  getLendersPage: (opts: { search?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("lenders:getPage", opts),
  createLender: (m: {
    name: string;
    address?: string;
    phone?: string;
    gstin?: string;
  }) => ipcRenderer.invoke("lenders:create", m),
  updateLender: (
    id: number,
    m: { name?: string; address?: string; phone?: string; gstin?: string }
  ) => ipcRenderer.invoke("lenders:update", id, m),
  deleteLender: (id: number) => ipcRenderer.invoke("lenders:delete", id),

  // Credit Purchases
  getCreditPurchases: (lenderId?: number) =>
    ipcRenderer.invoke("creditPurchases:getAll", lenderId),
  createCreditPurchase: (l: {
    lender_id: number;
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    transaction_date: string;
    amount: number;
    notes?: string;
    lender_invoice_number?: string;
    invoice_file_path?: string;
    gst_rate?: number;
    gst_inclusive?: boolean;
    taxable_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
  }) => ipcRenderer.invoke("creditPurchases:create", l),
  saveCreditPurchaseInvoice: (opts: {
    batchUuid: string;
    buffer: ArrayBuffer;
    extension: string;
  }) => ipcRenderer.invoke("creditPurchase:saveInvoice", opts),
  openCreditPurchaseInvoice: (relativePath: string) =>
    ipcRenderer.invoke("creditPurchase:openInvoice", relativePath),
  createCreditPurchaseBatch: (payload: {
    lender_id: number;
    transaction_date: string;
    notes?: string;
    lender_invoice_number?: string;
    invoice_file_path?: string;
    batch_uuid?: string;
    lines: {
      product_id: number;
      product_name?: string;
      quantity: number;
      amount: number;
      gst_rate?: number;
      gst_inclusive?: boolean;
      taxable_amount?: number;
      cgst_amount?: number;
      sgst_amount?: number;
    }[];
  }) => ipcRenderer.invoke("creditPurchases:createBatch", payload),
  updateCreditPurchase: (
    id: number,
    l: {
      lender_id?: number;
      product_id?: number | null;
      product_name?: string;
      quantity?: number;
      transaction_date?: string;
      amount?: number;
      notes?: string;
      lender_invoice_number?: string;
      invoice_file_path?: string;
      gst_rate?: number;
      gst_inclusive?: boolean;
      taxable_amount?: number;
      cgst_amount?: number;
      sgst_amount?: number;
    }
  ) => ipcRenderer.invoke("creditPurchases:update", id, l),
  deleteCreditPurchase: (id: number) =>
    ipcRenderer.invoke("creditPurchases:delete", id),

  // Settlements
  getSettlements: (lenderId?: number) =>
    ipcRenderer.invoke("settlements:getAll", lenderId),
  getCreditPurchasesWithAllocated: (lenderId: number) =>
    ipcRenderer.invoke("creditPurchases:getWithAllocated", lenderId),

  // Lender Ledger (unified credit purchases + settlements, paginated)
  getLenderLedgerPage: (opts: {
    lenderId?: number | null;
    mahajanId?: number | null;
    transactionType?: "all" | "credit_purchase" | "settlement" | "cash_purchase";
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => ipcRenderer.invoke("lenderLedger:getPage", opts),
  createSettlement: (d: {
    lender_id: number;
    transaction_date: string;
    amount: number;
    notes?: string;
    payment_method?: string;
    reference_number?: string;
    allocations?: { credit_purchase_id: number; amount: number }[];
  }) => ipcRenderer.invoke("settlements:create", d),
  updateSettlement: (
    id: number,
    d: {
      transaction_date?: string;
      amount?: number;
      notes?: string;
      payment_method?: string;
      reference_number?: string;
    }
  ) => ipcRenderer.invoke("settlements:update", id, d),
  deleteSettlement: (id: number) =>
    ipcRenderer.invoke("settlements:delete", id),

  // Aliases for backward compatibility
  getMahajans: () => ipcRenderer.invoke("lenders:getAll"),
  getMahajansPage: (opts: { search?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("lenders:getPage", opts),
  createMahajan: (m: { name: string; address?: string; phone?: string; gstin?: string }) =>
    ipcRenderer.invoke("lenders:create", m),
  updateMahajan: (id: number, m: { name?: string; address?: string; phone?: string; gstin?: string }) =>
    ipcRenderer.invoke("lenders:update", id, m),
  deleteMahajan: (id: number) => ipcRenderer.invoke("lenders:delete", id),
  getMahajanLends: (id?: number) => ipcRenderer.invoke("creditPurchases:getAll", id),
  createMahajanLend: (l: { mahajan_id: number; product_id?: number | null; product_name?: string; quantity?: number; transaction_date: string; amount: number; notes?: string }) =>
    ipcRenderer.invoke("creditPurchases:create", { ...l, lender_id: l.mahajan_id }),
  createMahajanLendBatch: (p: {
    mahajan_id: number;
    transaction_date: string;
    notes?: string;
    lender_invoice_number?: string;
    invoice_file_path?: string;
    batch_uuid?: string;
    lines: {
      product_id: number;
      product_name?: string;
      quantity: number;
      amount: number;
      gst_rate?: number;
      gst_inclusive?: boolean;
      taxable_amount?: number;
      cgst_amount?: number;
      sgst_amount?: number;
    }[];
  }) =>
    ipcRenderer.invoke("creditPurchases:createBatch", {
      ...p,
      lender_id: p.mahajan_id,
    }),
  updateMahajanLend: (id: number, l: { mahajan_id?: number; product_id?: number | null; product_name?: string; quantity?: number; transaction_date?: string; amount?: number; notes?: string }) =>
    ipcRenderer.invoke("creditPurchases:update", id, { ...l, lender_id: l.mahajan_id }),
  deleteMahajanLend: (id: number) => ipcRenderer.invoke("creditPurchases:delete", id),
  getMahajanDeposits: (id?: number) => ipcRenderer.invoke("settlements:getAll", id),
  getMahajanLedgerPage: (opts: { mahajanId?: number | null; transactionType?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    ipcRenderer.invoke("lenderLedger:getPage", { ...opts, lenderId: opts.mahajanId, transactionType: opts.transactionType === "lend" ? "credit_purchase" : opts.transactionType === "deposit" ? "settlement" : opts.transactionType }),
  createMahajanDeposit: (d: {
    mahajan_id: number;
    transaction_date: string;
    amount: number;
    notes?: string;
    payment_method?: string;
    reference_number?: string;
    allocations?: { credit_purchase_id: number; amount: number }[];
  }) =>
    ipcRenderer.invoke("settlements:create", {
      ...d,
      lender_id: d.mahajan_id,
    }),
  updateMahajanDeposit: (id: number, d: { transaction_date?: string; amount?: number; notes?: string }) =>
    ipcRenderer.invoke("settlements:update", id, d),
  deleteMahajanDeposit: (id: number) => ipcRenderer.invoke("settlements:delete", id),

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
    sale_amount?: number;
    misc_sales?: number;
    cash_in_hand: number;
    expenditure_amount?: number;
    notes?: string;
  }) => ipcRenderer.invoke("dailySales:create", s),
  updateDailySale: (
    id: number,
    s: {
      sale_date?: string;
      sale_amount?: number;
      misc_sales?: number;
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
  getReportSummary: () =>
    ipcRenderer.invoke("reports:getReportSummary") as Promise<{
      todaySale: number;
      weekSale: number;
      weekExpenditure: number;
      monthSale: number;
      monthExpenditure: number;
    }>,
  getLowStockItems: () =>
    ipcRenderer.invoke("reports:getLowStockItems") as Promise<
      { id: number; name: string; current_stock: number; reorder_level: number; unit: string }[]
    >,
  getTotalCreditPurchase: () =>
    ipcRenderer.invoke("reports:getTotalCreditPurchase") as Promise<{
      totalCreditPurchase: number;
    }>,
  getLenderSummary: () =>
    ipcRenderer.invoke("reports:getLenderSummary") as Promise<{
      totalCreditPurchase: number;
      totalSettlement: number;
      totalLend: number;
      totalDeposit: number;
      balance: number;
      countOweMe: number;
      countIOwe: number;
    }>,
  getAllLenderBalances: () =>
    ipcRenderer.invoke("reports:getAllLenderBalances") as Promise<{
      balances: Record<number, number>;
    }>,
  getLenderBalance: (lenderId: number) =>
    ipcRenderer.invoke("reports:getLenderBalance", lenderId),
  getLenderLedger: (lenderId: number) =>
    ipcRenderer.invoke("reports:getLenderLedger", lenderId),
  getTotalLend: () =>
    ipcRenderer.invoke("reports:getTotalCreditPurchase") as Promise<{ totalCreditPurchase: number }>,
  getMahajanSummary: () =>
    ipcRenderer.invoke("reports:getLenderSummary") as Promise<{
      totalLend: number;
      totalDeposit: number;
      balance: number;
      countOweMe: number;
      countIOwe: number;
    }>,
  getAllMahajanBalances: () =>
    ipcRenderer.invoke("reports:getAllLenderBalances") as Promise<{ balances: Record<number, number> }>,
  getMahajanBalance: (id: number) => ipcRenderer.invoke("reports:getLenderBalance", id),
  getMahajanLedger: (id: number) => ipcRenderer.invoke("reports:getLenderLedger", id),
  getWeeklySale: (fromDate: string) =>
    ipcRenderer.invoke("reports:getWeeklySale", fromDate),
  getTotalSale: (fromDate: string, toDate: string) =>
    ipcRenderer.invoke("reports:getTotalSale", fromDate, toDate) as Promise<{
      total: number;
      expenditure: number;
      invoice_sales: number;
      misc_sales: number;
    }>,
  getOpeningBalance: (year: number) =>
    ipcRenderer.invoke("reports:getOpeningBalance", year),
  setOpeningBalance: (year: number, amount: number) =>
    ipcRenderer.invoke("reports:setOpeningBalance", year, amount),
  getProfitLoss: (year: number, closingBalance: number) =>
    ipcRenderer.invoke("reports:getProfitLoss", year, closingBalance),

  // Database danger zone (Settings)
  getDbPath: () => ipcRenderer.invoke("db:getPath") as Promise<string>,
  clearDbTables: () => ipcRenderer.invoke("db:clearTables") as Promise<void>,
  clearEntireDb: () => ipcRenderer.invoke("db:clearEntireDb") as Promise<void>,
  populateSampleData: () =>
    ipcRenderer.invoke("db:populateSampleData") as Promise<void>,
  exportDb: () =>
    ipcRenderer.invoke("db:exportDb") as Promise<
      { canceled: true } | { canceled: false; path: string }
    >,
  importDb: () =>
    ipcRenderer.invoke("db:importDb") as Promise<
      { canceled: true } | { canceled: false }
    >,
};

contextBridge.exposeInMainWorld("electron", electronAPI);
