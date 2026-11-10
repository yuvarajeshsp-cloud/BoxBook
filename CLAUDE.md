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
  (`order`, `orderEdit{id?,customerId?,prefill?}`, `customer`, `customerEdit`, `box{id?,customerId?}`, `boxes`, `backup`, `settings{section?}`, `help`, `stock`, `reel`, `reelEdit`),
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

### Tax invoice PDF + company profile
- Company profile now lives in **App settings** (see below): logo upload (`lib/image.ts` `logoFromFile`, resized to ≤400px PNG data URL),
  name, tagline, address, mobile, e-mail, GSTIN + state, bank details, invoice prefix / next number, default HSN + unit, declaration.
  All stored in `Settings` (`business*`, `bank*`, `invoice*`, `nextInvoiceNo`, `defaultHsn/Unit`), so every backup/export contains the company data **and logo**.
  Pricing defaults (currency + default overhead/profit/GST) are in App settings too.
- Orders carry optional `invoiceNo`, `invoice` (dispatch grid fields) and per-item `hsn` / `unit`; customers carry optional `stateCode`.
  Edited in OrderEdit ("Tax invoice details", HSN/Unit per item) and CustomerEdit ("State (for GST)").
- `lib/invoice.ts`: `buildInvoiceModel` (pure; CGST+SGST vs IGST decided by buyer state vs company state, discount spread before tax, tax per HSN)
  and `drawInvoice`/`createInvoicePdf` (jsPDF, A4, Tally-style "Tax Invoice" layout, multi-page). Fonts: Roboto subset (Apache-2.0, includes ₹) in `src/assets/fonts`.
  `lib/words.ts` (Indian amount in words), `lib/gst.ts` (state codes, `splitTax`), `lib/sharefile.ts` (native share sheet / Web Share / download).
- OrderDetail → "Make & share invoice (PDF)": assigns the next invoice number once, builds the PDF (jspdf is lazy-loaded), opens the share sheet
  (WhatsApp, e-mail, Drive…). In a desktop browser it downloads the file.
- Tests: `lib/invoice.test.ts` (reproduces sample invoice 330: taxable 6,400 + CGST 576 + SGST 576 = 7,552), `gst.test.ts`, `backup.test.ts`.
  Render a sample: `INVOICE_OUT=/tmp/x.pdf npx vitest run src/lib/invoice.test.ts`, then `sips -s format png x.pdf --out x.png`.
- Not yet checked on a real phone: WhatsApp as the share target (emulator showed the system share sheet with the PDF).

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

## 3D box view
- `lib/box3d.ts` — pure geometry: cuboid vertices (bit0 = length x, bit1 = height y, bit2 = width z), yaw/pitch rotation, mild perspective,
  per-face visibility + shade, 12 edges (hidden ones flagged), and `dimensionLines()` which picks, per axis, the outermost visible
  silhouette edge and offsets a dimension line outside the box so the numbers stay readable from any angle (skipped when an axis points at the viewer).
  Tested in `lib/box3d.test.ts`.
- `Box3D.tsx` — SVG renderer (no 3D library). Drag / arrow keys rotate, play button auto-turns (respects reduced motion), reset button.
  Colours are `color-mix` of the hub `--primary`, so it follows light/dark. Shows "L 300 / H 150 / W 200" labels + a caption with the sizes.
- Used in `screens/Calculator.tsx` under the size inputs, so it appears both while creating a box and in a saved box, and updates as you type.

## Google Drive backup
- `lib/drive.ts` — sign-in + Drive REST. Scope `drive.file email`: the app only sees files it created, in a "BoxBook Backups" folder.
  - Web: Google Identity Services token popup (1-hour token, cannot refresh silently, so the daily upload only runs while signed in).
  - Phone: system browser (`@capacitor/browser`) + OAuth code flow with PKCE and the redirect `com.googleusercontent.apps.<id>:/oauth2redirect`
    (caught via `appUrlOpen`); gives a refresh token so the daily upload works unattended.
  - Tokens live in localStorage key `boxbook-drive-auth` (not in backups). Settings: `driveAuto`, `lastDriveBackupAt`, `lastDriveAutoBackup`.
- `screens/Help.tsx` — Help & FAQ + privacy policy (More → Help & FAQ, desktop sidebar). On the web `…/#help` and `…/#privacy` open it directly
  (use `https://yuvarajeshsp-cloud.github.io/BoxBook/#privacy` as the privacy-policy link on the Google consent screen).
- `screens/DriveBackup.tsx` — card on the Backup screen: connect, upload now, restore from Drive (list → same restore confirm), daily-upload switch, disconnect.
- `store.tsx` — `driveBackupIfDue()` runs next to the local daily backup (launch / resume / 30 min), never opens a sign-in window.
- Daily file is `BoxBook-auto-YYYY-MM-DD.json` (overwritten that day, pruned to `keepBackups`); manual ones are `BoxBook-backup-<stamp>.json`.
- Tested with mocked network in `lib/drive.test.ts` (PKCE vector, token refresh, folder create, upload/overwrite, prune, list, download).
  **Not tested against real Google** (needs the client ids below).

### One-time setup (needs the owner's Google account)
1. console.cloud.google.com → new project "BoxBook" → APIs & Services → enable **Google Drive API**.
2. OAuth consent screen: External, app name BoxBook, add scopes `.../auth/drive.file` and `email` (both non-sensitive, no Google review needed);
   add yourself under Test users (or publish the app to let anyone sign in).
3. Credentials → Create OAuth client ID:
   - **Web application**: authorised JavaScript origins `https://yuvarajeshsp-cloud.github.io` and `http://localhost:5173`.
   - **Android**: package `in.boxbook.app` + SHA-1 of the signing key (`./gradlew signingReport`); open Advanced settings and enable **custom URI scheme**.
   - **iOS**: bundle id `in.boxbook.app`.
4. Put the ids in `.env.local` (copy `.env.example`): `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_GOOGLE_ANDROID_CLIENT_ID`, `VITE_GOOGLE_IOS_CLIENT_ID`.
   For the website add a repo variable `GOOGLE_WEB_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables).
5. `npm run drive:native` (registers the redirect scheme in `AndroidManifest.xml` / `Info.plist`; idempotent), then `npm run build && npx cap sync`.
- Without ids the Drive card says "Not set up in this build" and nothing else changes.

## Paper stock (reel level)
- Data: `AppData.reels` (`Reel`: number, BF, GSM, width mm, supplier, receivedAt, weightIn kg, rate) and `AppData.stockMoves`
  (`StockMove`: reelId, kind `issue|return|waste|adjust`, signed `kg`, optional `orderId`/`orderNo`). A reel's balance = `weightIn` + Σ moves (`reelBalance`);
  there is no stored "left" figure, the ledger is the truth. `Settings.stockWastePct` (default 5) is the extra paper planned per order. All included in backups; old backups load with empty stock.
- `lib/stock.ts` (tested in `stock.test.ts`): `paperNeed(items)` groups the box layers of an order by GSM+BF (kg = `layerGrams` × qty, widest deckle = min reel width);
  `matchingReels` (same GSM, BF ≥ needed, width ≥ deckle, stock left; exact BF → least trim → smallest balance first); side trim: paper really used = deckle/width of the reel,
  so `reelDraw` takes more kg off a wider reel and `issuedNet` counts only the usable share; `stockByGrade` for the list.
- `calc.ts` `layerGrams(spec)` = per-layer grams of one box (sums to `calcBox().weight`).
- Screens: `screens/Stock.tsx` (`StockList` route `stock`, `ReelDetail` `reel`, `ReelEdit` `reelEdit`; More → Paper stock, desktop sidebar), `screens/OrderPaper.tsx`
  ("Paper needed" on the order page: need vs stock, **Issue reels** once the order is Confirmed/In production/Ready, **Return** leftover per reel).
- Auto-issue: `store.autoIssue(order, force?)` runs when an order is saved as, or moved to, Confirmed / In production / Ready (OrderEdit save, OrderDetail status change)
  and from the "Issue automatically" button. `lib/stock.ts` `planAllocation` plans it grade by grade (best reels first); a grade is issued **only if stock covers all of it**,
  otherwise it is reported short and nothing is taken for it. Idempotent (plans only what is still missing, so editing the qty tops up). Moves are tagged note `Automatic`.
  Turn off with `Settings.autoIssue` (Paper stock → Settings); manual **Issue reels** / **Return** still work. Quotes never issue; cancelling does not return paper by itself.
- Alerts: `Settings.stockMin` (`gsm-bf` → min kg, edited in Paper stock → Reorder levels). `stockAlerts()` gives `low` (grade under its level) and `short` (open orders need more than is in stock);
  shown as a red card on Home and Paper stock, a "to buy" count on the More row, and a "Low stock" line in the auto-issue toast. In-app only (no push notifications).
- Common reel sizes: `Settings.reelWidths` (mm, edited in Paper stock → Common reel sizes). Paper stock has a "By grade | By reel size" switch; `stockByWidth()` groups reels by width
  (every common size, plus any other width that has reels) with kg in stock and kg **purchased** (Σ `weightIn`, used-up reels included). "Purchased <size> mm" opens `reelEdit{width}`;
  the reel form has size chips and a "Reels" count (adds N reels, numbered with `incrementNumber`). `nearestWidth()` shows the nearest common size on the order page.
- Paper stock UI: a **Tiles | List** switch (remembered in localStorage `boxbook-stock-layout`, default tiles) beside the By grade / By reel size switch. `ReelTile` shows reel no.,
  width (or grade in size view), kg left, a fill bar (amber at ≤15% "Almost done", grey "Used up") and supplier/date; every group ends with a dashed "Add reel" /
  "Purchased <size> mm" tile (list layout: a footer row). "Add reel" under a grade opens the reel form with that BF/GSM filled (`reelEdit{bf,gsm}`).
- `store.commit` now updates `dataRef` synchronously so several changes in one tick (save order → issue paper) build on each other.
- Not built yet: supplier purchase orders, consumables (gum, wire, ink), finished-goods stock, per-job waste capture, reel barcodes.

## App settings (all predefined configuration, one page per section)
- `screens/Settings.tsx` (route `settings{section?}`; More → App settings, desktop sidebar). Follows the Embroidery-Shop-Manager "config" page pattern from rajesh-hub's catalogue
  (business profile card + editable lists), built with BoxBook's hub-based `ui.tsx`.
- Sections, each its own page: Business · Invoice & bank · Pricing · Paper stock (auto-issue, extra %, common reel sizes, reorder levels) · Lists (payment methods) · Backup (daily backup, keep N days) · Appearance (theme).
  **Phone**: `settings` with no section is a list of sections (icon, name, live summary) + a Help row; tapping one pushes `settings{section}`. There is **no tab strip on phones** (the list is the menu; swipe/back returns).
  **Computer (≥1024px, `useIsDesktop`)**: no list; a tab strip (role=tab, `hidden lg:flex`) switches sections with `nav.replace` (same route key, so unsaved typing survives tab hops) and Business is the default.
- Two kinds of control: typed fields are one **draft** across all sections, saved with the sticky Save bar (Discard / Save); leaving with unsaved changes asks first (`Header onBack` + a `nav.onBack` interceptor,
  so the hardware back button and the swipe also ask). Switches, chips and lists call `updateSettings` immediately.
- Other pages open a section directly: `nav.push({name:'settings', section:'company'|'stock'|'backup'…})` (Orders → "fill in your company first", Paper stock, Backup & restore links).
- Moved here from elsewhere: Company, Business ("Pricing defaults") screens (deleted), Paper stock's sizes/levels/settings, Backup's "Automatic backup", More's Appearance.
- `Settings.payModes` (default Cash, UPI, Bank transfer, Cheque, Other) feeds the payment sheet on orders.
- Google Drive connect / daily-upload switch stay on Backup & restore (they belong to the connection).

## Swipe back
- `nav.tsx`: `goBack()` = what the phone back button does (a sheet's `onBack` interceptor first, else pop the stack). The Android back button and the swipe both use it.
  A global touch handler: start within 24px of the left edge (not on input/textarea/select, only when a page is pushed), move right ≥80px, vertical drift ≤60px, within 0.9s → `goBack()`.
  A round chevron follows the finger as feedback. Verified with synthetic touch events (short / off-edge / vertical swipes do nothing; an open sheet closes first). Not yet tried on a real phone.
