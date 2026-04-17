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
    _userId?: number | null;
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
      _userId?: number | null;
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

  getCoupons: () => ipcRenderer.invoke("coupons:getAll"),
  getCouponByCode: (code: string) =>
    ipcRenderer.invoke("coupons:getByCode", code),
  validateAndApplyCoupon: (code: string, orderTotal: number) =>
    ipcRenderer.invoke("coupons:validateAndApply", { code, orderTotal }),
  incrementCouponUsed: (code: string) =>
    ipcRenderer.invoke("coupons:incrementUsed", code),
  createCoupon: (payload: {
    code: string;
    discount_type: "percent" | "flat";
    discount_value: number;
    min_order_amount?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
    usage_limit?: number | null;
  }) => ipcRenderer.invoke("coupons:create", payload),
  updateCoupon: (
    id: number,
    payload: {
      code?: string;
      discount_type?: "percent" | "flat";
      discount_value?: number;
      min_order_amount?: number | null;
      valid_from?: string | null;
      valid_to?: string | null;
      usage_limit?: number | null;
    }
  ) => ipcRenderer.invoke("coupons:update", id, payload),
  deleteCoupon: (id: number) => ipcRenderer.invoke("coupons:delete", id),

  getTieredDiscountRules: () =>
    ipcRenderer.invoke("tieredDiscountRules:getAll"),
  upsertTieredDiscountRule: (payload: {
    id?: number;
    min_order_amount: number;
    discount_percent?: number;
    discount_flat?: number;
    max_discount_amount?: number | null;
    sort_order?: number;
  }) => ipcRenderer.invoke("tieredDiscountRules:upsert", payload),
  deleteTieredDiscountRule: (id: number) =>
    ipcRenderer.invoke("tieredDiscountRules:delete", id),

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
    _userId?: number | null;
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
  createMahajan: (m: { name: string; address?: string; phone?: string; gstin?: string; _userId?: number | null }) =>
    ipcRenderer.invoke("lenders:create", m),
  updateMahajan: (id: number, m: { name?: string; address?: string; phone?: string; gstin?: string; _userId?: number | null }) =>
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
    _userId?: number | null;
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
      _userId?: number | null;
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

  openExternal: (url: string) =>
    ipcRenderer.invoke("app:openExternal", url) as Promise<void>,

  // Auth
  auth: {
    setupSuperAdmin: (payload: {
      companyName: string;
      ownerName: string;
      displayName: string;
      pin: string;
      customerMasterKey?: string;
    }) => ipcRenderer.invoke("auth:setupSuperAdmin", payload) as Promise<{ id: number }>,
    listUsers: () =>
      ipcRenderer.invoke("auth:listUsers") as Promise<
        { id: number; name: string; role: string; is_active: number; pin_is_temporary: number; created_at: string }[]
      >,
    verifyPin: (payload: { userId: number; pin: string }) =>
      ipcRenderer.invoke("auth:verifyPin", payload) as Promise<{ valid: boolean; pin_is_temporary: boolean }>,
    changePin: (payload: { userId: number; currentPin: string; newPin: string }) =>
      ipcRenderer.invoke("auth:changePin", payload) as Promise<{ success: boolean }>,
    verifyMasterKey: (key: string) =>
      ipcRenderer.invoke("auth:verifyMasterKey", key) as Promise<{ valid: boolean; keyType: "customer" | "developer" | null }>,
    resetSuperAdminPin: (payload: { newPin: string }) =>
      ipcRenderer.invoke("auth:resetSuperAdminPin", payload) as Promise<{ success: boolean }>,
    setCustomerMasterKey: (payload: { key: string; userId: number }) =>
      ipcRenderer.invoke("auth:setCustomerMasterKey", payload) as Promise<{ success: boolean }>,
    saveRecoveryKeyToDevice: (payload: {
      ownerName: string;
      companyName: string;
      key: string;
      replaceExisting?: boolean;
    }) =>
      ipcRenderer.invoke("auth:saveRecoveryKeyToDevice", payload) as Promise<{
        success: boolean;
        path: string;
      }>,
    forcePinChange: (payload: { userId: number; newPin: string }) =>
      ipcRenderer.invoke("auth:forcePinChange", payload) as Promise<{ success: boolean }>,
  },

  // User management
  users: {
    getAll: () =>
      ipcRenderer.invoke("users:getAll") as Promise<
        { id: number; name: string; role: string; is_active: number; pin_is_temporary: number; created_at: string; created_by: number | null }[]
      >,
    create: (payload: { name: string; pin: string; role: string; createdBy: number }) =>
      ipcRenderer.invoke("users:create", payload) as Promise<{ id: number }>,
    update: (payload: { id: number; name?: string; role?: string; isActive?: boolean; updatedBy: number }) =>
      ipcRenderer.invoke("users:update", payload) as Promise<{ id: number }>,
    resetPin: (payload: { id: number; newPin: string; resetBy: number }) =>
      ipcRenderer.invoke("users:resetPin", payload) as Promise<{ success: boolean }>,
  },

  // Activity log
  activityLog: {
    getPage: (opts: { page?: number; limit?: number; userId?: number | null; entityType?: string | null; action?: string | null; currentUserId: number; currentUserRole: "superadmin" | "admin" | "user" }) =>
      ipcRenderer.invoke("activityLog:getPage", opts) as Promise<{
        data: { id: number; user_id: number | null; user_name: string | null; action: string; entity_type: string; entity_id: number | null; entity_label: string | null; details: string | null; created_at: string }[];
        total: number;
      }>,
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
