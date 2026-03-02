import { BookOpenIcon } from "@heroicons/react/24/outline";

const Section = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => {
  const shortLabel = id.split("-")[0] ?? id;
  return (
    <section
      id={id}
      className="bg-white rounded-lg border border-gray-200 p-6 scroll-mt-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-600 text-sm font-medium">
          {shortLabel}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
};

const SubSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-6 last:mb-0">
    <h3 className="text-base font-medium text-gray-800 mb-2">{title}</h3>
    <div className="text-sm text-gray-600 space-y-2">{children}</div>
  </div>
);

const StepList = ({ steps }: { steps: string[] }) => (
  <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
    {steps.map((step) => (
      <li key={step.slice(0, 80)}>{step}</li>
    ))}
  </ol>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="list-disc list-inside space-y-1 text-gray-600">
    {items.map((item) => (
      <li key={item.slice(0, 80)}>{item}</li>
    ))}
  </ul>
);

const NavAnchor = ({
  sectionId,
  label,
}: {
  sectionId: string;
  label: string;
}) => (
  <button
    type="button"
    onClick={() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }}
    className="block w-full py-1.5 text-left text-sm text-blue-600 hover:text-blue-800 hover:underline"
  >
    {label}
  </button>
);

export default function Help() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <BookOpenIcon className="w-7 h-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            How to Use This App
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Detailed guide to manage stock, mahajans, sales, and reports
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">
          Quick navigation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
          <NavAnchor sectionId="1-overview" label="1. Overview" />
          <NavAnchor sectionId="2-getting-started" label="2. Getting Started" />
          <NavAnchor sectionId="3-units" label="3. Units" />
          <NavAnchor sectionId="4-products-stock" label="4. Products & Stock" />
          <NavAnchor sectionId="5-mahajans" label="5. Mahajans" />
          <NavAnchor sectionId="6-transactions" label="6. Transactions" />
          <NavAnchor sectionId="7-daily-sales" label="7. Daily Sales" />
          <NavAnchor sectionId="8-invoices" label="8. Invoices" />
          <NavAnchor sectionId="9-reports" label="9. Reports" />
          <NavAnchor sectionId="10-settings" label="10. Settings & Data" />
        </div>
      </div>

      <Section id="1-overview" title="Overview">
        <p className="text-gray-600 mb-4">
          This application helps you manage a godown (warehouse) or retail stock:
          products, units, stock levels, daily sales, mahajan (parties you take lend
          from and deposit to) ledgers, transactions (take lend from mahajan,
          deposit to mahajan, cash purchase), invoices, and reports. Data is stored locally in a database on your computer.
        </p>
        <SubSection title="Main areas">
          <BulletList
            items={[
              "Home: Dashboard with shortcuts to Stock, Add Sale, and Reports.",
              "Units: Define stock units (e.g. kg, pcs) and invoice units for billing.",
              "Products & Stock: Add products, track current stock, add or reduce stock.",
              "Mahajans: Manage mahajans (parties you take lend from and deposit to); view balance and ledger.",
              "Transactions: Record lend taken from mahajan, deposit to mahajan, and cash purchase.",
              "Daily Sales: Log daily sale amount, cash in hand, and expenditure.",
              "Invoices: Create and edit customer invoices with line items.",
              "Reports: Weekly sale, total sale for a date range, and profit/loss.",
              "Settings: Company details, app display name, and database backup/restore.",
            ]}
          />
        </SubSection>
      </Section>

      <Section id="2-getting-started" title="Getting Started">
        <SubSection title="Recommended setup order">
          <StepList
            steps={[
              "Go to Settings and fill in Company name, Address, GSTIN, Owner name, and Phone. Optionally set an App display name (used in header and PDFs).",
              "Open Units and add Stock units (e.g. Kg, Pcs, Box) that you will use for products. Add Invoice units if you use different units on invoices.",
              "Go to Products & Stock and add your products (name, code, unit, optional reorder level and retail/other units).",
              "If you work with mahajans, add them under Mahajans, then use Transactions to record lend taken from mahajan and deposit to mahajan.",
              "Use Daily Sales to record each day’s sale and cash position; use Reports to view weekly sale, total sale, and P&L.",
            ]}
          />
        </SubSection>
        <SubSection title="Trial mode">
          <p>
            If you see a &quot;Trial&quot; badge, the app is running in trial
            mode. A timer may limit usage. The full version will be provided
            after payment; functionality is the same.
          </p>
        </SubSection>
      </Section>

      <Section id="3-units" title="Units">
        <SubSection title="Stock units">
          <p className="mb-2">
            Stock units are used for products (e.g. Kg, Pcs, Box, Ltr). Each
            unit has a <strong>name</strong> and an optional <strong>symbol</strong> (short
            label for display).
          </p>
          <StepList
            steps={[
              "Open Units from the sidebar.",
              "Ensure the “Stock units” tab is selected.",
              "Click “Add unit”, enter name (e.g. Kilogram) and symbol (e.g. Kg), then save.",
              "Edit or delete units from the table. Deleting a unit that is used by products may not be allowed.",
            ]}
          />
        </SubSection>
        <SubSection title="Invoice units">
          <p className="mb-2">
            Invoice units are used on invoice line items. They can have a name,
            symbol, and sort order (to control display order on invoices).
          </p>
          <StepList
            steps={[
              "In Units, switch to the “Invoice units” tab.",
              "Click “Add invoice unit”, enter name and symbol, set sort order if needed, then save.",
              "Edit or delete from the table as required.",
            ]}
          />
        </SubSection>
      </Section>

      <Section id="4-products-stock" title="Products & Stock">
        <SubSection title="Adding a product">
          <StepList
            steps={[
              "Go to Products & Stock and click “Add Product”.",
              "Enter product Name and optional Code.",
              "Select the primary Unit (stock unit). You can create a new unit by choosing “Add new unit” and entering the name.",
              "Optionally set Current stock and Reorder level.",
              "Optionally set Retail primary unit and add Other units (e.g. for selling in different units). Use “Import units from another product” to copy units from an existing product.",
              "Save. The product appears in the table with current stock and unit.",
            ]}
          />
        </SubSection>
        <SubSection title="Editing or deleting a product">
          <p className="mb-2">
            Click the edit (pencil) icon on a row to change name, code, unit,
            retail/other units, reorder level, etc. To delete a product, use the
            delete (trash) icon; deletion may require current stock to be zero.
          </p>
        </SubSection>
        <SubSection title="Add Stock / Reduce Stock">
          <StepList
            steps={[
              "Add Stock: Click “Add Stock”, select the product, enter the quantity to add, and confirm. Current stock increases.",
              "Reduce Stock: Click “Reduce Stock”, select the product, enter the quantity to reduce, and confirm. Use this for sales or write-offs (quantity must not exceed current stock).",
            ]}
          />
        </SubSection>
        <SubSection title="Search and pagination">
          <p>
            Use the search box to filter by product name or code. The table is
            paginated; use the pagination controls at the bottom to move between
            pages.
          </p>
        </SubSection>
        <SubSection title="Export and print">
          <p>
            Click “Export” to choose: Export as CSV, Export as PDF, or Print. CSV
            and PDF save a snapshot of the product list (all items when
            exporting). Print opens the browser print dialog for the current
            table view.
          </p>
        </SubSection>
      </Section>

      <Section id="5-mahajans" title="Mahajans">
        <p className="text-gray-600 mb-4">
          Mahajans are parties you take lend from (receive goods/money) and
          deposit to (pay back). Each mahajan has a ledger of lend and deposit
          transactions and a running balance.
        </p>
        <SubSection title="Adding a mahajan">
          <StepList
            steps={[
              "Go to Mahajans and click “Add Mahajan”.",
              "Enter Name and optionally Phone, Address, and GSTIN.",
              "Save. The mahajan appears in the list.",
            ]}
          />
        </SubSection>
        <SubSection title="Viewing balance and ledger">
          <BulletList
            items={[
              "Balance: Click “Balance” on a row to load and show that mahajan’s current balance. Positive balance means you owe the mahajan (you have received more than you have deposited); negative means the mahajan owes you.",
              "Ledger: Click the mahajan name or “Ledger” to open the full ledger. There you can add Lend (take from mahajan) or Deposit (pay to mahajan), filter by type and date, and export or print.",
            ]}
          />
        </SubSection>
        <SubSection title="Export and print">
          <p>
            From the Mahajans list, use “Export” for CSV/PDF or “Print” for the
            mahajan list. From a mahajan’s ledger page, use Export/Print for
            that ledger’s transactions.
          </p>
        </SubSection>
      </Section>

      <Section id="6-transactions" title="Transactions">
        <p className="text-gray-600 mb-4">
          The Transactions page shows all ledger-style entries: Lend from
          Mahajan (take lend), Deposit to Mahajan (pay back), and Cash Purchase.
          You can filter by mahajan and type, and export or print.
        </p>
        <SubSection title="Take Lend from Mahajan">
          <StepList
            steps={[
              "Click “Add Lend”.",
              "Select the Mahajan and Transaction date.",
              "Add one or more lines: select Product, enter Quantity and Amount per line (goods/money received from the mahajan). Add optional Notes.",
              "Save. Stock for the product increases automatically because you received goods from the mahajan.",
            ]}
          />
        </SubSection>
        <SubSection title="Deposit to Mahajan">
          <StepList
            steps={[
              "Click “Add Deposit”.",
              "Select the Mahajan and Transaction date.",
              "Enter Amount and optional Notes (money you are paying to the mahajan).",
              "Save. This records your deposit (payment) to the mahajan.",
            ]}
          />
        </SubSection>
        <SubSection title="Cash Purchase">
          <StepList
            steps={[
              "Click “Cash Purchase” (or “Add Cash Purchase”).",
              "Select Transaction date and add lines: Product, Quantity, Amount.",
              "Save. Stock for the product is increased automatically.",
            ]}
          />
        </SubSection>
        <SubSection title="Filters and list">
          <p>
            Use the mahajan filter and type filter (All / Lend from mahajan / Deposit to
            mahajan / Cash purchase) to narrow the list. Edit or delete existing transactions
            from the row actions. Export and Print work on the currently
            filtered list.
          </p>
        </SubSection>
      </Section>

      <Section id="7-daily-sales" title="Daily Sales">
        <SubSection title="Adding a daily sale">
          <StepList
            steps={[
              "Go to Daily Sales and click “Add Sale”.",
              "Enter Sale date, Sale amount, Cash in hand, and optionally Expenditure amount and Notes.",
              "Save. The entry appears in the list.",
            ]}
          />
        </SubSection>
        <SubSection title="Date filter and pagination">
          <p>
            Set “From” and “To” dates to filter by sale date. The table shows
            paginated results. Use Edit/Delete on a row to correct or remove an
            entry.
          </p>
        </SubSection>
        <SubSection title="Export and print">
          <p>
            Use “Export” for CSV/PDF or “Print” to print the (filtered) daily
            sales list.
          </p>
        </SubSection>
      </Section>

      <Section id="8-invoices" title="Invoices">
        <SubSection title="Creating an invoice">
          <StepList
            steps={[
              "Go to Invoices and click “Add Invoice”.",
              "Enter optional Invoice number and Customer name.",
              "Add lines: select Product, enter Quantity, choose Unit (invoice unit), and enter Price. You can switch to “Total” mode to enter the line total instead of per-unit price.",
              "Add more lines as needed. The total updates automatically.",
              "Save. The invoice is stored and can be viewed, edited, or printed.",
            ]}
          />
        </SubSection>
        <SubSection title="Viewing, editing, and printing">
          <p>
            From the invoice list, use the view (eye) icon to open the invoice,
            edit (pencil) to change it, or print/PDF to generate a printable
            copy. Invoice PDF uses your company details from Settings.
          </p>
        </SubSection>
      </Section>

      <Section id="9-reports" title="Reports">
        <SubSection title="Weekly Sale">
          <p className="mb-2">
            Select a date; the report shows 7 days of daily sales ending on that
            date (descending). Columns: Date, Sale, Cash in Hand, Expenditure.
          </p>
        </SubSection>
        <SubSection title="Total Sale">
          <p className="mb-2">
            Enter “From” and “To” dates to get the total sale amount and total
            expenditure for that range (from daily sales entries).
          </p>
        </SubSection>
        <SubSection title="Profit / Loss">
          <StepList
            steps={[
              "Select the Year.",
              "Set Opening balance for that year (you can save it for the year).",
              "Enter Closing balance and click Calculate.",
              "The result shows Opening, Total Sale, Total Expenditure, Closing, and Profit/Loss.",
            ]}
          />
        </SubSection>
      </Section>

      <Section id="10-settings" title="Settings & Data">
        <SubSection title="Company / Business">
          <p>
            Enter Company name, Address, GSTIN, Owner name, and Phone. These can
            be used in invoices and PDFs. Click Save to store.
          </p>
        </SubSection>
        <SubSection title="Appearance">
          <p>
            App display name: optional short name shown in the header and in
            PDFs/print (max 25 characters). Leave blank to use the default app
            name.
          </p>
        </SubSection>
        <SubSection title="Danger zone — use with care">
          <BulletList
            items={[
              "Export database: Saves a full copy of your database to a file. Use for backup or moving to another computer.",
              "Import database: Replaces the current database with the file you select. All existing data is overwritten; export a backup first if needed.",
              "Clear all data: Empties all tables (items, mahajans, transactions, invoices, daily sales, etc.) but keeps the database structure. Use to start fresh without losing units/schema.",
              "Reset database: Deletes the database file and creates a new empty database. Everything is lost. Export a backup first if you might need the data.",
            ]}
          />
        </SubSection>
        <SubSection title="Database location">
          <p>
            Settings shows the path to the database file on your computer. You
            can copy or back up this file manually if needed.
          </p>
        </SubSection>
      </Section>

      <div className="pt-4 pb-2 text-center text-sm text-gray-500">
        For more support, contact your provider or refer to your purchase
        documentation.
      </div>
    </div>
  );
}
