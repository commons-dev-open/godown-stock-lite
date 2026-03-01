# Distributing Godown Stock Lite to Offline Customers

The app runs fully offline (SQLite, no network). You deliver installers on USB drive, shared folder, or any offline medium.

## 1. Build the app

```bash
npm install
npm run build
npm run dist
```

- **Output:** `release/` folder.
- **macOS:** `release/mac/Godown Stock Lite-1.0.0.dmg` (or similar).
- **Windows:** `release/Godown Stock Lite Setup 1.0.0.exe` (NSIS installer).

Build on the target OS (build on Mac → `.dmg`; build on Windows → `.exe`), or use CI (e.g. GitHub Actions) to produce both.

## 2. Deliver to the customer

- Copy the installer(s) from `release/` to USB/shared folder.
- Customer installs by double‑clicking the DMG (Mac) or the Setup exe (Windows). No internet required.

---

## Assets to update before distribution

Update these so the installers and app metadata match your branding and version.

| Asset / config | Where | Purpose |
|----------------|--------|--------|
| **Version** | `package.json` → `version` | Shown in installer and “About”. Use e.g. `1.0.0`, `1.1.0`. |
| **App name** | `package.json` → `build.productName` | Name shown in installer and window title (e.g. “Godown Stock Lite”). |
| **Description** | `package.json` → `description` | Short app description. |
| **Author** | `package.json` → `author` | Your or your company name. |
| **App ID** | `package.json` → `build.appId` | Unique ID (e.g. `com.yourcompany.godown-stock-lite`). Change only if you want a different app identity. |
| **Windows icon** | `resources/Icon.ico` | App and installer icon on Windows. Replace with your 256×256 (or multi-size) `.ico`. |
| **macOS icon** | `resources/icon.icns` | App and DMG icon on Mac. Add this file; electron-builder will use it. Generate from a 1024×1024 PNG. |

### Optional: macOS icon

If `resources/icon.icns` is missing, the OS default is used. To add your icon:

1. Export a 1024×1024 PNG.
2. Create `.icns` (e.g. with `iconutil` on Mac, or an online converter).
3. Save as `resources/icon.icns`.

### Optional: Windows installer options

In `package.json` under `build.win` you can add NSIS options, e.g. one-click install or custom installer name. See [electron-builder docs](https://www.electron.build/configuration/nsis).

---

## Checklist before each release

- [ ] Bump `version` in `package.json`.
- [ ] Set `description` and `author` in `package.json`.
- [ ] Confirm `build.productName` and `build.appId` in `package.json`.
- [ ] Replace `resources/Icon.ico` (Windows) if needed.
- [ ] Add or replace `resources/icon.icns` (macOS) if needed.
- [ ] Run `npm run build` then `npm run dist`.
- [ ] Test the installer on a clean machine (or VM) without network.
