import type { ReactNode } from "react";
import type { HelpTabId } from "./types";
import { HelpBulletList, HelpStepList, HelpSubSection } from "./HelpPrimitives";

export const HELP_TAB_BODIES: Record<HelpTabId, ReactNode> = {
  overview: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        This application helps you manage a godown (warehouse) or retail stock:
        products, units, stock levels, daily sales, lender (parties you receive
        credit purchase from and make settlement to) ledgers, transactions
        (credit purchase from lender, settlement to lender, cash purchase),
        invoices, and reports. Data is stored locally in a database on your
        computer.
      </p>
      <HelpSubSection title="Main areas">
        <HelpBulletList
          items={[
            "Home: Dashboard with shortcuts to Stock, Add Sale, and Reports.",
            "Units: Define stock units (e.g. kg, pcs) and invoice units for billing.",
            "Products & Stock: Add products, track current stock, add or reduce stock.",
            "Lenders: Manage lenders (parties you receive credit purchase from and make settlement to); view balance and ledger.",
            "Transactions: Record credit purchase from lender, settlement to lender, and cash purchase.",
            "Daily Sales: Log daily summary (invoice sales auto from invoices, misc/cash sales, cash in hand, expenditure).",
            "Invoices: Create and edit customer invoices with line items.",
            "Reports: Weekly sale, total sale for a date range, and profit/loss.",
            "Settings: Company details, app display name, and database backup/restore.",
          ]}
        />
      </HelpSubSection>
    </div>
  ),

  "getting-started": (
    <div className="space-y-1">
      <HelpSubSection title="Recommended setup order">
        <HelpStepList
          steps={[
            "Go to Settings and fill in Company name, Address, GSTIN, Owner name, and Phone. Optionally set an App display name (used in header and PDFs).",
            "Open Units and add Stock units (e.g. Kg, Pcs, Box) that you will use for products. Add Invoice units if you use different units on invoices.",
            "Go to Products & Stock and add your products (name, code, unit, optional reorder level and retail/other units).",
            "If you work with lenders, add them under Lenders, then use Transactions to record credit purchase from lender and settlement to lender.",
            "Use Daily Sales to record each day’s sale and cash position; use Reports to view weekly sale, total sale, and P&L.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Trial mode">
        <p>
          If you see a &quot;Trial&quot; badge, the app is running in trial
          mode. A timer may limit usage. The full version will be provided
          after payment; functionality is the same.
        </p>
      </HelpSubSection>
    </div>
  ),

  units: (
    <div className="space-y-1">
      <HelpSubSection title="Stock units">
        <p className="mb-2">
          Stock units are used for products (e.g. Kg, Pcs, Box, Ltr). Each
          unit has a <strong>name</strong> and an optional <strong>symbol</strong> (short
          label for display).
        </p>
        <HelpStepList
          steps={[
            "Open Units from the sidebar.",
            "Ensure the “Stock units” tab is selected.",
            "Click “Add unit”, enter name (e.g. Kilogram) and symbol (e.g. Kg), then save.",
            "Edit or delete units from the table. Deleting a unit that is used by products may not be allowed.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Invoice units">
        <p className="mb-2">
          Invoice units are used on invoice line items. They can have a name,
          symbol, and sort order (to control display order on invoices).
        </p>
        <HelpStepList
          steps={[
            "In Units, switch to the “Invoice units” tab.",
            "Click “Add invoice unit”, enter name and symbol, set sort order if needed, then save.",
            "Edit or delete from the table as required.",
          ]}
        />
      </HelpSubSection>
    </div>
  ),

  products: (
    <div className="space-y-1">
      <HelpSubSection title="Adding a product">
        <HelpStepList
          steps={[
            "Go to Products & Stock and click “Add Product”.",
            "Enter product Name and optional Code.",
            "Select the primary Unit (stock unit).",
            "Optionally set Current stock and Reorder level.",
            "Optionally set Retail primary unit and add Other units (e.g. for selling in different units). Use “Import units from another product” to copy units from an existing product.",
            "Save. The product appears in the table with current stock and unit.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Editing or deleting a product">
        <p className="mb-2">
          Click the edit (pencil) icon on a row to change name, code, unit,
          retail/other units, reorder level, etc. To delete a product, use the
          delete (trash) icon; deletion may require current stock to be zero.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Add Stock / Reduce Stock">
        <HelpStepList
          steps={[
            "Add Stock: Click “Add Stock”, select the product, enter the quantity to add, and confirm. Current stock increases.",
            "Reduce Stock: Click “Reduce Stock”, select the product, enter the quantity to reduce, and confirm. Use this for sales or write-offs (quantity must not exceed current stock).",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Search and pagination">
        <p>
          Use the search box to filter by product name or code. The table is
          paginated; use the pagination controls at the bottom to move between
          pages.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Export and print">
        <p>
          Click “Export” to choose: Export as CSV, Export as PDF, or Print. CSV
          and PDF save a snapshot of the product list (all items when
          exporting). Print opens the browser print dialog for the current
          table view.
        </p>
      </HelpSubSection>
    </div>
  ),

  lenders: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Lenders are parties you receive credit purchase from (goods/money) and
        make settlement to (pay back). Each lender has a ledger of credit
        purchase and settlement transactions and a running balance.
      </p>
      <HelpSubSection title="Adding a lender">
        <HelpStepList
          steps={[
            "Go to Lenders and click “Add Lender”.",
            "Enter Name and optionally Phone, Address, and GSTIN.",
            "Save. The lender appears in the list.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Viewing balance and ledger">
        <HelpBulletList
          items={[
            "Balance: Click “Balance” on a row to load and show that lender’s current balance. Positive balance means you owe the lender (you have received more than you have settled); negative means the lender owes you.",
            "Ledger: Click the lender name or “Ledger” to open the full ledger. There you can add Credit Purchase (receive from lender) or Settlement (pay to lender), filter by type and date, and export or print.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Export and print">
        <p>
          From the Lenders list, use “Export” for CSV/PDF or “Print” for the
          lender list. From a lender’s ledger page, use Export/Print for
          that ledger’s transactions.
        </p>
      </HelpSubSection>
    </div>
  ),

  transactions: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        The Transactions page shows all ledger-style entries: Credit Purchase
        from Lender, Settlement to Lender, and Cash Purchase. You can filter
        by lender and type, and export or print.
      </p>
      <HelpSubSection title="Add Credit Purchase from Lender">
        <HelpStepList
          steps={[
            "Click “Add Credit Purchase”.",
            "Select the Lender and Transaction date.",
            "Add one or more lines: select Product, enter Quantity and Amount per line (goods/money received from the lender). Add optional Notes.",
            "Save. Stock for the product increases automatically because you received goods from the lender.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Add Settlement to Lender">
        <HelpStepList
          steps={[
            "Click “Add Settlement”.",
            "Select the Lender and Transaction date.",
            "Enter Amount and optional Notes (money you are paying to the lender).",
            "Save. This records your settlement (payment) to the lender.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Cash Purchase">
        <HelpStepList
          steps={[
            "Click “Cash Purchase” (or “Add Cash Purchase”).",
            "Select Transaction date and add lines: Product, Quantity, Amount.",
            "Save. Stock for the product is increased automatically.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Filters and list">
        <p>
          Use the lender filter and type filter (All / Credit Purchase / Settlement
          / Cash purchase) to narrow the list. Edit or delete existing transactions
          from the row actions. Export and Print work on the currently
          filtered list.
        </p>
      </HelpSubSection>
    </div>
  ),

  "daily-sales": (
    <div className="space-y-1">
      <HelpSubSection title="How daily sales work">
        <p>
          Daily Sales track each day’s revenue and cash position.{" "}
          <strong>Invoice Sales</strong> are filled automatically from invoices
          for that date. Add <strong>Misc / Cash Sales</strong> for sales
          without an invoice (e.g. walk-in cash, small items). Total Sale =
          Invoice Sales + Misc Sales. <strong>Cash in Hand</strong> is the
          amount physically in your till at end of day.{" "}
          <strong>Expenditure</strong> is money spent that day.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Adding a daily sale">
        <HelpStepList
          steps={[
            "Go to Daily Sales and click “Add Sale”.",
            "Enter Sale date. If you have invoices for that date, their total is shown as Invoice Sales (read-only).",
            "Enter Misc / Cash Sales (sales without an invoice), Cash in hand, and optionally Expenditure and Notes.",
            "Save. The entry appears in the list. One entry per date; adding for an existing date updates that row.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Date filter and pagination">
        <p>
          Set “From” and “To” dates to filter by sale date. The table shows
          paginated results. Use Edit/Delete on a row to correct or remove an
          entry.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Export and print">
        <p>
          Use “Export” for CSV/PDF or “Print” to print the (filtered) daily
          sales list.
        </p>
      </HelpSubSection>
    </div>
  ),

  invoices: (
    <div className="space-y-1">
      <HelpSubSection title="Creating an invoice">
        <HelpStepList
          steps={[
            "Go to Invoices and click “Add Invoice”.",
            "Enter optional Invoice number and Customer name.",
            "Add lines: select Product, enter Quantity, choose Unit (invoice unit), and enter Price. You can switch to “Total” mode to enter the line total instead of per-unit price.",
            "Add more lines as needed. The total updates automatically.",
            "Save. The invoice is stored and can be viewed, edited, or printed.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Viewing, editing, and printing">
        <p>
          From the invoice list, use the view (eye) icon to open the invoice,
          edit (pencil) to change it, or print/PDF to generate a printable
          copy. Invoice PDF uses your company details from Settings.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Invoices and Daily Sales">
        <p>
          When you create, edit, or delete an invoice, the Daily Sales for
          that invoice date are updated automatically. Invoice totals for each
          date appear as Invoice Sales on the Daily Sales page.
        </p>
      </HelpSubSection>
    </div>
  ),

  reports: (
    <div className="space-y-1">
      <HelpSubSection title="Executive Summary">
        <p className="mb-2">
          At the top, you see key metrics without selecting dates: today&apos;s
          sale, this week&apos;s total and expenditure, this month&apos;s
          totals, and lender net balance (total credit purchase minus settlements). Data
          loads automatically.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Weekly Sale">
        <p className="mb-2">
          The report shows 7 days of daily sales ending on the selected date
          (newest first). It includes Sale, Invoice Sales, Misc Sales, Cash in
          Hand, and Expenditure. The date defaults to today.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Total Sale">
        <p className="mb-2">
          Enter From and To dates or use presets (This Week, This Month, Last
          30 Days, This Year) to get total sale, invoice sales, misc sales, and
          expenditure for that range.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Lender Summary">
        <p className="mb-2">
          Shows total credit purchase, total settlements, and net balance (₹). Also shows
          receivable count (lenders who owe you) and payable count (you owe).
          Green = receivable, red = payable. Links to the Lenders page for
          details.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Low Stock Alerts">
        <p className="mb-2">
          Lists items where current stock is at or below the reorder level.
          Use this to plan restocking. Links to the Stock page to update items.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Profit / Loss">
        <p className="mb-2">
          <strong>Profit/Loss</strong> = Total Sale − Total Expenditure (actual
          operating result for the year). Credit purchase and settlement do not affect
          P&L—they are balance-sheet items (receivables and repayments).
        </p>
        <HelpStepList
          steps={[
            "Select the Year.",
            "Set Opening balance for that year (you can save it for the year).",
            "Enter Closing balance (or leave empty and use 0) and click Calculate.",
            "Result shows Opening, Total Sale, Total Expenditure, Credit Purchase/Settlement (if any), Closing, Profit/Loss, and Cash variance for reconciliation.",
          ]}
        />
      </HelpSubSection>
    </div>
  ),

  "settings-data": (
    <div className="space-y-1">
      <HelpSubSection title="Company / Business">
        <p>
          Enter Company name, Address, GSTIN, Owner name, and Phone. These can
          be used in invoices and PDFs. Click Save to store.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Appearance">
        <p>
          App display name: optional short name shown in the header and in
          PDFs/print (max 25 characters). Leave blank to use the default app
          name.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Danger zone — use with care">
        <HelpBulletList
          items={[
            "Export database: Saves a full copy of your database to a file. Use for backup or moving to another computer.",
            "Import database: Replaces the current database with the file you select. All existing data is overwritten; export a backup first if needed.",
            "Clear all data: Empties all tables (items, lenders, transactions, invoices, daily sales, etc.) but keeps the database structure. Use to start fresh without losing units/schema.",
            "Reset database: Deletes the database file and creates a new empty database. Everything is lost. Export a backup first if you might need the data.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Database location">
        <p>
          Settings shows the path to the database file on your computer. You
          can copy or back up this file manually if needed.
        </p>
      </HelpSubSection>
    </div>
  ),
};
