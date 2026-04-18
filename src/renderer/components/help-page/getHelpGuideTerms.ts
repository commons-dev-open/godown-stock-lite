import type { i18n as I18n } from "i18next";

/** Screen and settings labels reused inside Help copy (stays aligned with live UI). */
export function getHelpGuideTerms(i18n: I18n) {
  const lng = i18n.language;
  const tCommon = i18n.getFixedT(lng, "common");
  const tNav = i18n.getFixedT(lng, "navigation");
  const tSettings = i18n.getFixedT(lng, "settings");
  const tUsers = i18n.getFixedT(lng, "users");
  const tHome = i18n.getFixedT(lng, "home");
  const tTx = i18n.getFixedT(lng, "transactions");
  const tUnits = i18n.getFixedT(lng, "units");
  const tMahajans = i18n.getFixedT(lng, "mahajans");
  const tSales = i18n.getFixedT(lng, "sales");
  const tInvoices = i18n.getFixedT(lng, "invoices");
  const tItems = i18n.getFixedT(lng, "items");

  return {
    appName: tCommon("app.name"),
    navHome: tNav("home"),
    navUnits: tNav("units"),
    navStock: tNav("stock"),
    navMahajans: tNav("mahajans"),
    navTransactions: tNav("transactions"),
    navSales: tNav("sales"),
    navInvoices: tNav("invoices"),
    navTeam: tNav("team"),
    navSettings: tNav("settings"),
    navHelp: tNav("help"),
    lockApp: tNav("sidebar.lockApp"),
    trialBadge: tNav("sidebar.trial"),
    setBusiness: tSettings("tabs.business"),
    setTax: tSettings("tabs.tax"),
    setDiscounts: tSettings("tabs.discounts"),
    setAppearance: tSettings("tabs.appearance"),
    setSecurity: tSettings("tabs.security"),
    setActivity: tSettings("tabs.activity"),
    setData: tSettings("tabs.data"),
    roleOwner: tUsers("roles.owner"),
    roleAdmin: tUsers("roles.admin"),
    roleMember: tUsers("roles.member"),
    qaCreateInvoice: tHome("quickActions.createInvoice.title"),
    qaCreditPurchase: tHome("quickActions.creditPurchase.title"),
    qaCashVsExp: tHome("quickActions.cashVsExpenditure"),
    txAddCreditPurchase: tTx("actions.add_credit_purchase"),
    txAddSettlement: tTx("actions.add_settlement"),
    txSettlementType: tTx("types.settlement"),
    txCashPurchase: tTx("actions.cash_purchase"),
    unitsTabAll: tUnits("tabs.all"),
    unitsTabTypes: tUnits("tabs.types"),
    unitsTabConv: tUnits("tabs.conversions"),
    unitsAddUnit: tUnits("actions.addUnit"),
    unitsAddType: tUnits("actions.addType"),
    unitsAddConversion: tUnits("actions.addConversion"),
    unitsColFromUnit: tUnits("columns.fromUnit"),
    unitsColToUnit: tUnits("columns.toUnit"),
    unitsColFactor: tUnits("columns.factor"),
    itemsPrimaryStockUnit: tItems("form.primaryStockUnit"),
    itemsUnitsAndConversions: tItems("form.unitsAndConversions"),
    mahajanAdd: tMahajans("actions.addMahajan"),
    mahajanFetchLatest: tMahajans("hero.fetchLatest"),
    mahajanShowBalance: tMahajans("actions.showBalance"),
    mahajanViewBalance: tMahajans("actions.viewBalance"),
    salesAddSale: tSales("dailyRegister.actions.addSale"),
    invoicePageCreate: tInvoices("page.createInvoice"),
    itemsAddProduct: tItems("actions.addProduct"),
    itemsAddStock: tItems("actions.addStock"),
    itemsReduceStock: tItems("actions.reduceStock"),
    itemsImportFromProduct: tItems("actions.importFromProduct"),
    usersAddUser: tUsers("actions.addUser"),
    salesInvoiceSales: tSales("dailyRegister.table.invoiceSales"),
    salesMiscCashSales: tSales("dailyRegister.table.miscCashSales"),
    salesCashInHand: tSales("dailyRegister.table.cashInHand"),
    salesExpenditure: tSales("dailyRegister.table.expenditure"),
    homeWeeklyTableSale: tHome("weeklyDetails.table.sale"),
    homeWeeklyTableInvoice: tHome("weeklyDetails.table.invoice"),
    homeWeeklyTableMisc: tHome("weeklyDetails.table.misc"),
    homeWeeklyTableCashInHand: tHome("weeklyDetails.table.cashInHand"),
    homeWeeklyTableExpenditure: tHome("weeklyDetails.table.expenditure"),
    homeHeroMetricToday: tHome("hero.metrics.today"),
    homeHeroMetricThisWeek: tHome("hero.metrics.thisWeek"),
    homeHeroMetricThisMonth: tHome("hero.metrics.thisMonth"),
    homeHeroMetricLenderNet: tHome("hero.metrics.lenderNet"),
    homeSectionQuickActions: tHome("sections.quickActions"),
    homeSectionWeeklyMomentum: tHome("sections.weeklyMomentum"),
    homeSectionWeeklyDetails: tHome("sections.weeklyDetails"),
    homeSectionRangeComposition: tHome("sections.rangeComposition"),
    homeSectionLenderSummary: tHome("sections.lenderSummary"),
    homeSectionLowStockAlerts: tHome("sections.lowStockAlerts"),
  };
}
