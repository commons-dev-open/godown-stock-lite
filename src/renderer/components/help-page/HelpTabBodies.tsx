import type { ReactNode } from "react";
import type { HelpTabId } from "./types";
import { HelpBulletList, HelpStepList, HelpSubSection } from "./HelpPrimitives";

export const HELP_TAB_BODIES: Record<HelpTabId, ReactNode> = {
  overview: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Godown Stock Lite is a desktop-first business app for inventory, sales,
        lender credit, and invoicing. Everything you enter is stored in a local
        SQLite database on this machine—there is no cloud account required for
        day-to-day work, which keeps latency low and your books under your
        control. Use the topic tabs above to move through this guide; each
        section lines up with a major area of the sidebar.
      </p>
      <HelpSubSection title="What you can run from here">
        <HelpBulletList
          items={[
            "Home: Rolling KPIs (today, last 7 days, this calendar week through today, month, lender net), sale momentum charts (last 7 days or full calendar week), Range Composition with date presets including This Week, Quick Actions (Create Invoice, Credit Purchase) plus a last-7-days cash vs expenditure strip, low-stock alerts, sale detail table, and a lender summary with navigation into the underlying pages when you need detail.",
            "Units: Master list of stock units with optional types, plus standard conversions so quantities stay consistent when you bill or move stock in different measures.",
            "Products & Stock: Catalogue, on-hand quantity, reorder hints, per-product selling defaults and GST/HSN, product-level unit conversions, manual add/reduce stock, search, export, print, and row shortcuts into Stock history.",
            "Lenders: Parties you buy from on credit and pay back; balances, ledgers, and exports. The screen label is Lenders; older data paths may still say “mahajan” internally.",
            "Transactions: Credit purchase, settlement, supplier refunds (money in), and cash purchase, with filters and export/print. Stock history is its own sidebar page for per-product movement audit.",
            "Daily Sales: One row per calendar day—invoice-backed totals, misc cash sales, cash in hand, and expenditure.",
            "Invoices: Customer bills with line items, GST-aware totals when enabled, discounts from Settings, and PDF/print using your business profile.",
            "Team: Named sign-ins, roles, PINs, and activation for people who share this machine (see the Team topic).",
            "Settings: Business profile, tax and GST, discounts, appearance, security, activity log, and data tools (backup, restore, reset, sample data).",
            "Help: This page—reference material you can read alongside the live screens.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="How the pieces depend on each other">
        <p className="mb-2">
          Units and unit types sit underneath products. Products feed invoices
          and stock movements. Credit purchase and cash purchase increase stock
          when you receive goods. Invoices push their dated totals into Daily
          Sales as invoice sales. Lender credit purchase and settlement do not
          by themselves replace your cash book—they track what you owe
          suppliers—while Daily Sales is where you reconcile the day’s cash
          picture including misc sales and till balance.
        </p>
      </HelpSubSection>
    </div>
  ),

  "getting-started": (
    <div className="space-y-1">
      <HelpSubSection title="First sign-in">
        <p className="mb-2">
          On a fresh install you create an owner account, pick a user, and set
          a four-digit PIN. After that the main layout unlocks. You can lock
          again from the header or from Settings → Security; unlocking always
          uses the current user&apos;s PIN. If you share the PC, each person
          should have their own sign-in on Team so the activity log stays meaningful.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Recommended setup order">
        <p className="mb-2">
          You can enter data in any order, but this sequence avoids rework:
          business identity and tax rules first, then units and products, then
          operational flows.
        </p>
        <HelpStepList
          steps={[
            "Open Settings → Business and save company name, address, GSTIN, owner name, and phone. These fields appear on printed invoices and many exports.",
            "If you issue GST bills, open Settings → Tax & GST: enable GST, default slab, inclusive or exclusive pricing, place of supply, and optional customer GSTIN or HSN columns. Invoice screens read these toggles directly.",
            "Still in Settings, review Discounts so only the mechanisms you actually use (percentage, flat, BOGO, coupons, tiers, rounding) appear on invoices.",
            "Open Units: add a few unit types (Mass, Count, Volume, etc.), add stock units under All units (name, symbol, type), then add Standard conversions for pairs you will convert often (for example kg ↔ g).",
            "Go to Products & Stock and create products with base unit, optional reorder level, retail/other units, per-product conversions if they differ from global ones, and optional default selling price, GST rate, and HSN.",
            "If you purchase on credit from suppliers, add them under Lenders, then record Credit Purchase and Settlement from Transactions or from a lender’s Ledger.",
            "Operate day to day with Invoices and Daily Sales; use Home when you want charts, alerts, and cross-cutting totals without opening each register.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Trial mode">
        <p>
          If you see a Trial badge, the build is time-limited. After the window
          ends the app prompts you to purchase the full version; behaviour is
          otherwise the same while the trial is active.
        </p>
      </HelpSubSection>
    </div>
  ),

  units: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        The Units page has three segments—All units, Unit types, and Standard
        conversions. Together they define how quantities are named, grouped, and
        converted. Invoices and stock screens combine these definitions with
        each product&apos;s own alternate units and conversion rows.
      </p>
      <HelpSubSection title="All units">
        <p className="mb-2">
          These are the units every product references (kilogram, piece, box,
          litre, and so on). Each row has a name, an optional short symbol for
          tables and PDFs, and a unit type so the app knows which conversions are
          physically meaningful.
        </p>
        <HelpStepList
          steps={[
            "Open Units from the sidebar and stay on the “All units” tab.",
            "Click “Add unit”, enter name and symbol, pick a unit type, then save.",
            "Edit from the row actions. Delete only when nothing depends on the unit; seeded system units are protected from deletion.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Unit types">
        <p className="mb-2">
          Types are lightweight categories—Mass, Volume, Count, and whatever
          else matches your trade. They do not perform maths by themselves; they
          gate standard conversions so you cannot accidentally link incompatible
          measures.
        </p>
        <HelpStepList
          steps={[
            "Switch to the “Unit types” tab.",
            "Use “Add type”, enter a name, save, then attach types to units on the All units tab.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Standard conversions">
        <p className="mb-2">
          A conversion row states how many “to” units equal one “from” unit
          (for example 1 kg → 1000 g). The app uses these together with
          product-level conversion tables when resolving invoice quantities and
          rates across units.
        </p>
        <HelpStepList
          steps={[
            "Open the “Standard conversions” tab.",
            "Click “Add conversion”, choose from/to units (same type), enter the numeric factor, and save.",
            "Maintain conversions as your catalogue grows; inconsistent factors will show up as odd rates or stock discrepancies long before the database complains.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="How this connects to invoices">
        <p>
          When you add invoice lines, unit choices come from the product&apos;s
          primary and alternate units, assisted by standard and per-product
          conversions. If a unit is missing from a line’s dropdown, fix the
          product’s unit setup first, then revisit the invoice.
        </p>
      </HelpSubSection>
    </div>
  ),

  products: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Products are the catalogue spine: they drive stock levels, default
        invoice behaviour, and low-stock alerts. Spend a little time getting
        units and default tax fields right up front so invoices stay fast at
        the counter.
      </p>
      <HelpSubSection title="Adding a product">
        <HelpStepList
          steps={[
            "Go to Products & Stock and click “Add Product”.",
            "Enter product name and optional code.",
            "Select the primary stock unit.",
            "Optionally set current stock and reorder level.",
            "Under retail and other units, describe how you sell the item in alternate measures; use “Import units from another product” when a new SKU mirrors an existing one.",
            "Optionally add per-product unit conversions (from the base unit to another unit) when they differ from global standard conversions.",
            "Optionally set default selling price and selling price unit, GST rate slab, and HSN code—these pre-fill invoice lines and stay editable per bill.",
            "Save. The product appears in the table with quantity and unit.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Editing or deleting">
        <p className="mb-2">
          Use the pencil icon to change any of the fields above. Deletion is
          intentionally strict: you will usually need zero on-hand stock and no
          blocking references before the trash action succeeds, so you do not
          silently break historical invoices.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Add Stock / Reduce Stock">
        <HelpStepList
          steps={[
            "Add Stock: choose the product, confirm quantity (and unit where applicable), submit. On-hand quantity increases—use for purchases you are not modelling as lender or cash purchase, opening balances, or corrections.",
            "Reduce Stock: same flow for shrinkage, shop-floor use, or sales you are not running through invoices. Quantity cannot exceed what is on hand.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Search and pagination">
        <p>
          Search filters by name or code. Pagination keeps large catalogues
          responsive; remember filters apply before export when you need a slice
          of the list.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Export and print">
        <p>
          Export offers CSV and PDF snapshots of the catalogue; print sends the
          current table view to the system print dialog. Treat exports as point-in-time backups of the list, not a substitute for Settings → Data database export when you are moving machines.
        </p>
      </HelpSubSection>
    </div>
  ),

  lenders: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        A lender is any counterparty you receive credit purchase from and later
        settle with cash, bank, UPI, or cheque. Balances roll up from those two
        families of transactions; cash purchases from the open market are handled
        separately under Transactions → Cash Purchase.
      </p>
      <HelpSubSection title="Adding a lender">
        <HelpStepList
          steps={[
            "Go to Lenders and click “Add lender” in the hero.",
            "Enter name plus optional phone, address, and GSTIN.",
            "Save. The lender appears in the directory with search across those fields.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Hero metrics and staying current">
        <p className="mb-2">
          The top cards summarise how many lenders you track, aggregate credit
          purchase, aggregate settlements, and net balance. When ledger activity
          elsewhere might have changed these totals, use “Fetch latest” to
          refresh without reloading the whole app.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Balances in the directory">
        <HelpBulletList
          items={[
            "Per row you can request a single lender’s balance on demand when “Show balance” is off—useful on large lists.",
            "Enable the “Show balance” toggle in the search bar to pull every lender balance in one batch (slightly heavier query, clearer overview).",
            "Positive balance means you still owe the lender; negative means they owe you—same colour language as Home.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Ledger">
        <p className="mb-2">
          Open a lender by name or the Ledger action. Inside the ledger you can
          post new credit purchase or settlement, filter by type and date, and
          export or print that lender’s history. This is often faster than hunting
          the same rows on the global Transactions page when you are reconciling
          one supplier.
        </p>
      </HelpSubSection>
      <HelpSubSection title="What the modals capture (high level)">
        <p className="mb-2">
          Credit purchase lines can carry GST rate and inclusive/exclusive flag
          per line, optional supplier invoice number, optional invoice file upload,
          notes, and an optional “pay now” slice with payment method plus reference
          fields (cash receipt, UPI ref, UTR, cheque no., etc.). That lets one
          screen represent goods arriving and an immediate partial payment.
        </p>
        <p>
          Settlement expects amount, date, payment method, reference, optional
          notes, and—when you expand allocations—how much settles which prior
          credit purchase. You can still post a simple lump settlement if you do
          not need that granularity.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Export and print">
        <p>
          From the lender directory use Export or Print for the list itself.
          From inside a ledger, export or print applies to that filtered ledger
          view.
        </p>
      </HelpSubSection>
    </div>
  ),

  transactions: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Transactions is the global register for anything that touches lender
        balances or immediate cash purchases of stock. It complements—not
        replaces—per-lender ledgers: use whichever view matches the task.
      </p>
      <HelpSubSection title="Add Credit Purchase">
        <HelpStepList
          steps={[
            "Click “Add Credit Purchase”.",
            "Choose lender and transaction date.",
            "Add lines: product, quantity, monetary amount, and—when GST applies—per-line GST rate and inclusive/exclusive mode.",
            "Optionally record the supplier’s invoice number, attach a scan or photo, add notes, and split part of the amount into an on-the-spot payment with method + reference.",
            "Confirm. Stock increases for the goods you received.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Add Settlement">
        <HelpStepList
          steps={[
            "Click “Add Settlement”.",
            "Choose lender, date, amount, payment method, and reference details.",
            "Optionally expand allocations to tie the payment to specific credit purchases.",
            "Optional: use “Suggest oldest credit purchases first” to pre-fill allocations (you can still edit them).",
            "Save. The lender’s balance decreases by the settlement amount.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Supplier refund (money in)">
        <HelpStepList
          steps={[
            "Click “Record refund” (or Add refund on a lender ledger).",
            "Choose lender, date, amount, and optional payment details—same movement row type as settlement but direction in.",
            "Optionally allocate to open credit purchases if you want the books tied line-by-line.",
            "Save. Recorded refunds reduce what you owe that lender.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Cash Purchase">
        <HelpStepList
          steps={[
            "Click “Cash Purchase”.",
            "Set the date and add lines with product, quantity, and amount.",
            "Save. Stock increases without touching lender balances—this is the path for anonymous market buys.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Filters, edits, exports">
        <p>
          Narrow by lender and by type (all, credit purchase only, settlement
          only, supplier refund only, cash purchase). Row actions support
          edit/delete where business rules allow. Aggregated multi-line credit
          rows block the single-line edit form from the row pencil (the app
          shows a clear toast). Export and print honour the active filters so
          you can produce statements for a single lender or a single
          transaction class.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Stock history">
        <p>
          Open Stock history from the sidebar (or Home quick action, or the
          history icon on a product row). Filter by product, date range, and
          reason; each row shows the signed quantity change and a running
          balance window for the filtered list. Source links jump to invoices
          or the transactions register depending on the movement type.
        </p>
      </HelpSubSection>
    </div>
  ),

  "daily-sales": (
    <div className="space-y-1">
      <HelpSubSection title="Purpose of the register">
        <p>
          Daily Sales is your end-of-day control totals.{" "}
          <strong>Invoice sales</strong> aggregate automatically from every
          invoice dated that day. <strong>Misc / cash sales</strong> cover
          walk-ins, phone orders, or small counter sales you are not putting on a
          formal invoice. <strong>Total sale</strong> is the sum of those two.{" "}
          <strong>Cash in hand</strong> is what you physically counted in the
          till; <strong>expenditure</strong> captures outflows that should reduce
          the day’s net. None of this replaces double-entry accounting, but it
          does give owners an honest picture of cash vs billed revenue.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Adding or updating a day">
        <HelpStepList
          steps={[
            "Open Daily Sales → “Add Sale”.",
            "Pick the sale date. Invoice sales populate read-only when invoices exist.",
            "Enter misc/cash sales, cash in hand, optional expenditure and notes.",
            "Save. One logical row per date; saving again on the same date updates that row instead of duplicating.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Drilling into invoices">
        <p>
          When invoice sales are non-zero, use the row action that jumps to
          invoices filtered for that date to audit what made up the automatic
          total—handy when a customer name was mistyped or a bill was voided.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Filters, edits, exports">
        <p>
          From/To date filters scope the grid; pagination keeps long histories
          manageable. Edit or delete a row if you mis-keyed a day. Export CSV/PDF
          or print obeys the same filters so month-end packs stay consistent.
        </p>
      </HelpSubSection>
    </div>
  ),

  invoices: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Invoices are dated commercial documents. The editor pulls defaults from
        each product (GST, HSN, selling hints) while still letting you override
        line-by-line for one-off deals.
      </p>
      <HelpSubSection title="Creating an invoice">
        <HelpStepList
          steps={[
            "Open Invoices → “Create Invoice”.",
            "Fill invoice number (optional), customer name, and optional phone or address when you want them on the PDF.",
            "Add lines: pick product, quantity, billing unit, and price. Toggle “Total” mode when you prefer to type the line total and let the app back-solve rate per unit.",
            "Apply order-level discounts or coupons only if you enabled them in Settings.",
            "Save. You can reopen later for edits, PDF, or print.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="GST, HSN, and customer-facing output">
        <p className="mb-2">
          When Settings → Tax & GST is on and a line carries a positive GST
          rate, the invoice view and PDF can show taxable value split into CGST
          and SGST columns, respecting inclusive vs exclusive mode. HSN columns
          appear when the setting demands them and the lines contain codes.
          Customer GSTIN prints when captured and enabled—useful for B2B bills.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Viewing, editing, printing">
        <p>
          From the register, use the eye icon for read-only review, the pencil for
          edits, and print/PDF actions for customer copies. Header branding comes
          from Settings → Business and Appearance (short display name and accent
          colour).
        </p>
      </HelpSubSection>
      <HelpSubSection title="Link to Daily Sales">
        <p>
          Creating, editing, or deleting an invoice recomputes invoice sales for
          its date inside Daily Sales automatically—there is no manual re-linking
          step. If a day looks wrong, fix the invoice first, then refresh Daily
          Sales.
        </p>
      </HelpSubSection>
    </div>
  ),

  team: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Open Team from the sidebar (same placement as in the live app—after
        Invoices, before Settings). The Team members table is where you define who
        may unlock this install, what role they carry, and whether their account
        is active. Four-digit PINs are always per user; locking the app is still
        handled from the header or Settings → Security.
      </p>
      <HelpSubSection title="Why it exists">
        <p>
          Shared counters and back-office PCs benefit from named operators: the
          activity log can show who changed prices, voided a line, or exported
          data. If you are the only person who ever touches the machine, you can
          stay on a single account until you need that accountability or want to
          hand a staff member a limited role.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Roles">
        <p className="mb-2">
          <strong>Owner</strong> is the first account from onboarding; the roster
          labels that row as Owner. Owner cannot be deactivated from this screen,
          and administrative row actions (PIN reset, deactivate, rename) do not
          apply to the Owner row when another signed-in user is looking at the
          table—protecting the master account from accidental lockout.
        </p>
        <p className="mb-2">
          <strong>Admins</strong> can add users, assign the User role, rename
          people they manage, reset other users&apos; PINs, and activate or
          deactivate accounts. Only an Owner can create another Admin when using
          Add user. Admins never get administrative actions against the Owner row.
        </p>
        <p>
          <strong>Users</strong> use the day-to-day business pages—stock,
          invoices, lenders, and so on—after they unlock with their PIN. Any
          signed-in person can use Edit name on their own row to fix spelling;
          managers use the same action on others where policy allows.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Adding someone">
        <HelpStepList
          steps={[
            "Sign in as an Owner or Admin, open Team, and choose Add user (the hero action when you have permission).",
            "Enter display name, pick User or Admin (Admin option appears only for Owners), and set a temporary four-digit PIN.",
            "After Create, hand the temporary PIN to the colleague privately. On their next sign-in the app requires a fresh PIN before work continues—look for a Temp PIN badge until they finish that step.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="PIN reset and activation">
        <p className="mb-2">
          Reset PIN starts a short flow: you confirm, enter a new temporary
          four-digit PIN, and the affected user must choose a permanent PIN the
          next time they sign in. Use it when someone forgets a PIN or you need
          to revoke knowledge of the old one.
        </p>
        <p>
          Deactivate removes sign-in for a row without deleting history; Activate
          brings it back. You cannot deactivate your own row while you are
          signed in, and the Owner row cannot be toggled off here. Pair these
          habits with immediate lock when stepping away from a shared desk.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Team vs Settings">
        <p>
          Team owns identities—names, roles, PIN lifecycle, and which accounts
          are allowed to unlock. Settings owns business rules, appearance, tax and
          discount policy, security preferences such as recovery keys, activity
          log viewing, and database backup paths for this install. Document both
          when you hand a laptop from one shop manager to another so the next
          owner knows where to look for people versus policy.
        </p>
      </HelpSubSection>
    </div>
  ),

  reports: (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        The Home dashboard is the analytics layer: it reads the same
        transactions, invoices, daily sales, and stock tables you maintain
        elsewhere, then surfaces rollups so you can react without building
        spreadsheets first.
      </p>
      <HelpSubSection title="KPI strip">
        <p className="mb-2">
          The top strip answers “how are we doing right now?” with today’s
          sales, last 7 days’ sales, this calendar week’s sales (partial through
          today; week start is configurable under Settings → Appearance), this
          month’s sales and spend, and lender net (credit purchase minus
          settlements). Large numbers respect your abbreviation style from
          Settings → Appearance (Indian Lac/Cr, US M/B, or SI K/M/B).
        </p>
      </HelpSubSection>
      <HelpSubSection title="Sale momentum">
        <p className="mb-2">
          Toggle Last 7 days vs This week. For Last 7 days, pick an end date to
          chart a rolling seven-day window. For This week, the chart uses your
          calendar week (Sunday or Monday start from Settings → Appearance).
          Callouts show period totals, peak sale day, and how many daily rows
          contributed.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Range Composition">
        <p className="mb-2">
          Choose From/To manually or via presets (This Week uses your calendar week
          start through today; also last 7 days, this month, last 30 days, this
          year, etc.). The chart stacks invoice sales, misc sales, and expenditure
          so you can see whether growth came from formal billing or informal
          counter traffic.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Quick Actions">
        <p className="mb-2">
          Two large buttons jump straight into Create Invoice (opens Invoices with
          a fresh draft) and Credit Purchase (opens Transactions with the lender
          purchase flow). Underneath, the “Cash vs Expenditure (last 7 days)” card
          plots the same window as the momentum chart for a compact liquidity sanity
          check.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Low Stock Alerts">
        <p className="mb-2">
          Lists catalogue lines at or below reorder level. Treat it as a dynamic
          restock queue; clicking through lands in Products & Stock where you can
          raise quantities or adjust thresholds if the business changed.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Sale detail">
        <p className="mb-2">
          Tabular daily rows (newest first) for the same period as the momentum
          chart—either rolling last 7 days or the full calendar week—with sale
          amount, invoice component, misc component, recorded cash in hand, and
          expenditure. It mirrors Daily Sales rows for the chosen window so you
          can reconcile charts against ground truth numbers.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Lender Summary">
        <p className="mb-2">
          Aggregates credit purchase, settlements, and net balance with counts of
          lenders who owe you versus lenders you owe. Colour cues align with the
          KPI strip so you can triage payables before they become crises.
        </p>
      </HelpSubSection>
    </div>
  ),

  "settings-data": (
    <div className="space-y-1">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Settings uses the same segmented pattern as Help: Business, Tax & GST,
        Discounts, Appearance, Security, Activity log, App updates, and Data.
        Tax and
        discount toggles are authoritative—invoice UI simply exposes what you
        allow here.
      </p>
      <HelpSubSection title="Business">
        <p>
          Legal identity block for PDFs: company name, address, GSTIN, owner
          name, phone. Keep it current before you send customer-facing documents
          out of season.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Tax & GST">
        <p>
          Master GST switch, default slab, inclusive vs exclusive pricing, place
          of supply, optional customer GSTIN field, and HSN column behaviour.
          Changes apply to new edits immediately; review open invoices if you
          flip major switches mid-period.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Discounts">
        <p>
          Choose which discount mechanics exist in your shop—percentage, flat
          amount, BOGO, coupon tables, tiered or volume rules, and final bill
          rounding. Disabled mechanisms stay hidden on invoices to reduce clutter
          and mistakes.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Appearance">
        <p className="mb-2">
          Short display name (header and lightweight PDF branding), accent
          colour, and global number abbreviation style for dashboards and tables.
        </p>
        <p>
          Light, dark, and system themes also live on the sidebar footer; both
          paths write the same preference.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Security">
        <p>
          Change PIN, maintain the recovery master key, and lock the workstation
          immediately. Locking is the correct habit when stepping away from a
          shared counter.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Activity log">
        <p>
          Append-only style trail of notable events—who did what and when. Pair
          it with named sign-ins on Team for accountability; it is not a
          replacement for statutory accounting ledgers but it settles internal
          disputes quickly.
        </p>
      </HelpSubSection>
      <HelpSubSection title="Data">
        <HelpBulletList
          items={[
            "Export database: copies the entire SQLite file—best full-fidelity backup before hardware swaps or risky experiments.",
            "Import database: replaces the live database with a chosen file; always export first on this machine.",
            "Clear all data: wipes business rows across tables while preserving schema—faster than uninstall when you want a clean slate without fighting file permissions.",
            "Reset database: deletes the database file and recreates an empty one—total loss unless you exported.",
            "Fill with sample data: only when the app detects an empty business dataset, inserts demo lenders, products, invoices, transactions, and daily sales so trainees can click around safely.",
          ]}
        />
      </HelpSubSection>
      <HelpSubSection title="Database path">
        <p>
          The Data tab exposes the on-disk location of your SQLite file so you
          can include it in wider backup policies—Time Machine, corporate sync,
          encrypted drives—alongside in-app export.
        </p>
      </HelpSubSection>
    </div>
  ),
};
