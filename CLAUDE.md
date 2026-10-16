# BoxBook — handoff for Claude Code

Corrugated box calculator + customer/order manager for a box-making business.
Rebuilt from scratch (own code) using the maths of the old "eBox" Android app as reference.
One codebase → Android + iOS via **Capacitor 7 + React 19 + Vite 7 + TypeScript + Tailwind 4**, styled with the shared **rajesh-hub** packages.

## Owner requirements (from Rajesh)
1. Modern UI (mobile-first, light/dark, bottom tab bar).
2. Box calculator (same results as eBox) + price estimate (overhead, profit %, GST %).
3. **Order management**: customers and orders.
4. **All data stays on the phone** — no server, no login, no cloud.
5. **Backup to file + restore from file**.
6. **Automatic daily backup on the phone**.
7. Build for **Android and iOS**.

## Status

### Done (in `src/`)
- `lib/types.ts` — data model: Customer, Order (items, payments, status, discount, GST), SavedBox, Settings, AppData.
- `lib/calc.ts` — box maths ported from eBox + `estimate()` + `orderTotals()`.
  `lib/calc.test.ts` checks it against a literal port of the original code (33 tests pass: `npx vitest run`).
- `lib/storage.ts` — persistence. Native: JSON file `boxbook-data.json` in `Directory.Data`, written atomically (tmp + rename).
  Web/dev: localStorage. `normalize()` validates/upgrades files.
- `lib/backup.ts` — `saveBackupOnDevice(data, 'auto'|'manual', keep)` (tries `Documents/BoxBook/Backups`, falls back to app storage),
  `listBackups`, `readBackup`, `deleteBackup`, `exportBackup` (writes to cache + native share sheet), `shareBackupEntry`, `parseBackupFile(File)`.
  Auto backups are named `BoxBook-auto-YYYY-MM-DD.json`, pruned to `settings.keepBackups` (default 14).
- `lib/format.ts` — ids, dates, ₹ formatting (en-IN), tel/WhatsApp links.
- `lib/share.ts` — `shareText`, `boxSpecText`, `orderText` (WhatsApp-friendly quotation/order text).
- `store.tsx` — `StoreProvider`/`useStore()`: all CRUD, debounced save, **daily auto-backup** on launch, on app resume
  (`@capacitor/app` appStateChange), on visibilitychange and every 30 min; safety backup before restore (`replaceAll`); `toast()`.
- `nav.tsx` — tiny stack router: tabs `home | orders | customers | calc | more`, pushed routes
  (`order`, `orderEdit{id?,customerId?,prefill?}`, `customer`, `customerEdit`, `box{id?,customerId?}`, `boxes`, `backup`, `business`),
  Android hardware back button handling, `onBack()` interceptors for sheets.
- `ui.tsx` — Header, Page, Section, Field, NumInput, Segmented, Toggle, Row/List, Avatar, Empty, Sheet (bottom sheet), Confirm,
  StatusChip + `STATUS`/`STATUS_FLOW`, Stat, SearchBox, Fab.
- `screens/Calculator.tsx` — calculator tab + saved-box editor (save box, create order from it, share).
- `screens/Customers.tsx` — `CustomersList`, `CustomerDetail` (call/WhatsApp, stats, orders, saved boxes), `CustomerEdit`, `Missing`.
- `index.css` + `tailwind.config.js` — design tokens (kraft-brown accent, light & dark via `.dark` class), component classes
  (`.input .label .card .btn-primary .btn-ghost .btn-danger .chip`), safe-area helpers.
- `public/icon.svg` — app icon.

### Done (second pass)
- `screens/Orders.tsx`, `screens/Home.tsx`, `screens/More.tsx` (More, BoxesList, Business), `screens/Backup.tsx`, `App.tsx` shell.
- `capacitor.config.ts` (appId `in.boxbook.app`), native projects added (`android/`, `ios/`), manifest/Info.plist edits applied,
  icons + splash generated from `assets/` (re-run `npx capacitor-assets generate` after changing them).
- Verified: `npx tsc -b`, `npx vitest run` (33 pass), web build, Android debug APK on an emulator, iOS build on the simulator.

### Shared hub (rajesh-hub)
- UI and theme come from `~/rajesh-hub` (GitHub `yuvarajeshsp-cloud/rajesh-hub`), linked with `file:` deps:
  `@rajesh-hub/ui`, `@rajesh-hub/tokens`, `@rajesh-hub/print`. Clone it next to this folder and run `npm install` in both.
- `src/index.css` imports hub tokens (`app.css`, `mobile.css`); colours are hub names (`bg-background`, `bg-card`, `text-muted-foreground`,
  `bg-primary`…). Only `good`/`warn`/`bad` are local aliases onto hub tokens.
- `src/ui.tsx` keeps BoxBook's API but is built on hub `Sheet`, `AlertDialog`, `Switch`, `Input`; `App.tsx` uses hub `BottomNav`, `Toaster`, `BrandProvider`.
- `BottomNav` was ported into the hub from Embroidery-Shop-Manager (uncommitted in the hub checkout until pushed).
- `vite.config.ts` dedupes react/react-dom/sonner and `tsconfig.app.json` pins React types so the linked hub code shares this app's copy.
- Not used from the hub yet: offline-store, native, thermal printing (BoxBook keeps its own storage/backup).

### Remaining
- Pick the final appId before publishing (changing it later means editing both native projects).
- Release signing: create a keystore for `assembleRelease` (Android); pick a team in Xcode for a real iPhone.
- Not yet tested on a physical phone: share sheet, restore-from-file picker, WhatsApp/tel links.

### Build commands
- Web + sync: `npm run build && LANG=en_US.UTF-8 npx cap sync`
- Android debug APK: `cd android && ./gradlew assembleDebug` -> `android/app/build/outputs/apk/debug/app-debug.apk` (needs ~3 GB free disk the first time)
- iOS: `npx cap open ios` (CocoaPods; run `pod` with `LANG=en_US.UTF-8`)

## Notes / decisions
- Data volume is small (hundreds–thousands of records) so a single JSON file is used instead of SQLite; keeps backup = exact copy.
- Daily backup runs when the app is opened/resumed (iOS does not allow reliable background jobs); once per calendar day.
- Android backups in public `Documents/BoxBook/Backups` survive uninstall; iOS backups live in the app's Documents (visible in Files).
  Users should still export to Google Drive / WhatsApp now and then — the Backup screen should say so.
- Box maths (see `calc.ts` doc comment): cut size 2L+2W+50 (2 sheets if ≥1600), deckle W+H+20/30/50 by ply, flute take-up 1.4,
  BS = Σ GSM×BF/1000 with flutes ×0.5, paper cost = Σ layer kg × ₹/kg.
