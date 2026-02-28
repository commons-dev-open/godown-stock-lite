# Godown Stock Management

**Source:** [commons-dev-open/godown-stock-lite](https://github.com/commons-dev-open/godown-stock-lite)

Desktop app for godown (warehouse) stock management. Built with Electron, React, TypeScript, Tailwind CSS, and SQLite.

## Features

- **Stock:** Add product, Add Stock, Reduce Stock, Total stock view
- **Mahajan:** CRUD, Add Lend (product, date, amount), Add Deposit (date, amount), Mahajan Ledger (date-wise)
- **Cash purchases:** Cash purchase (product, date, amount), list by date, update
- **Daily Sales:** Date, sale amount, cash in hand, expenditure; update sale
- **Reports:** Weekly sale (7 days), Total sale (date range), Profit/Loss (opening/closing balance)
- **Delete rules:** Product only when stock = 0; Mahajan only when balance (lends - deposits) = 0

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

This builds the main process once, then runs Vite (renderer) and Electron. The app loads the renderer from http://localhost:5173.

## Build

```bash
npm run build
npm run start   # run built app
```

## Package (installers)

```bash
npm run dist
```

Output: `release/` (macOS dmg, Windows nsis). Icon: `resources/Icon.ico` (Windows). Add `resources/icon.icns` for macOS icon.

## Data

SQLite database is stored in the app’s user data directory (per OS). The app runs fully offline.

## Date format

UI uses date inputs (locale); data stored as YYYY-MM-DD. Display can show dd/mm/yyyy as needed.
