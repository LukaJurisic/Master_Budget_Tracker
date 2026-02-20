# Mobile Build Journal

## Branch
- Active branch: `mobile`
- Started: 2026-02-20

## Vision
- Build a personal mobile app for monthly budget updates and daily glance checks.
- Optimize for joy and low maintenance first.
- Keep architecture ready to expand to multi-user SaaS later.

## Source of App Store Truth
- Local cheat sheet repo: `C:\Users\lukaj\Desktop\Folders\Budgeting\Budget App\app_store_cheat_sheet\App-Store-Connect-CLI`
- We will use this repo's validation model and `asc` commands as our release gate.

## Product Scope (Phase 1: Personal)
- Monthly ritual flow:
  - Sync/import transactions
  - Review uncategorized items
  - Commit mapping
  - Adjust monthly budgets
  - View dashboard snapshot
- Mobile-first screens for:
  - Dashboard
  - Transactions (quick categorize)
  - Mapping/staging approvals
  - Budgets edit

## Technical Direction
- Near-term mobile path: wrap existing React app with Capacitor for iOS.
- Near-term execution order on Windows: Android first (emulator), then iOS release prep later.
- Keep existing FastAPI backend for data/workflows.
- Keep single-user model for now (no auth overhaul yet).
- Add seams now for future multi-user:
  - API boundary discipline (no implicit globals)
  - `user_id`/tenant-ready schema plan (later migration)
  - environment-based config split for personal vs production SaaS

## Apple Review Guardrails (from cheat sheet validation logic)
- Build readiness:
  - Attached build exists, not expired, processing state is `VALID`.
- Metadata required:
  - Version localization present.
  - Primary locale localization present (version + app info).
  - Description, keywords, support URL required.
  - App name required; subtitle strongly recommended.
  - `What's New` is skipped for initial release version (`1.0`, `1.0.0`, etc.).
- Metadata limits:
  - Description <= 4000
  - Keywords <= 100
  - What's New <= 4000
  - Promotional Text <= 170
  - Name <= 30
  - Subtitle <= 30
- Screenshots:
  - At least one screenshot set exists.
  - Each set is non-empty.
  - Primary locale has screenshot sets.
  - Screenshot dimensions must match allowed display types.
- Review details:
  - Contact first/last/email/phone required.
  - Demo account credentials required only if demo account is marked required.
- App setup:
  - Primary category set.
  - Pricing configured.
  - Availability configured with at least one enabled territory.
  - Age rating declaration complete and valid.

## Release Gate Commands (Cheat Sheet)
- Preflight validation:
  - `asc validate --app "<APP_ID>" --version-id "<VERSION_ID>" --platform IOS --strict`
- Upload + wait:
  - `asc builds upload --app "<APP_ID>" --ipa "<IPA_PATH>" --wait`
- Submit:
  - `asc submit create --app "<APP_ID>" --version "<VERSION>" --build "<BUILD_ID>" --confirm`

## Build Log
- 2026-02-20:
  - Created `mobile` branch.
  - Added `mobile.md`.
  - Linked workflow to local `app_store_cheat_sheet` repo.
  - Installed Capacitor packages in `web`:
    - `@capacitor/core`
    - `@capacitor/android`
    - `@capacitor/ios`
    - `@capacitor/cli`
  - Initialized Capacitor:
    - App name: `Budget Tracker`
    - App ID: `com.lukajurisic.budgettracker`
    - Web dir: `dist`
  - Added iOS platform scaffold at `web/ios`.
  - Added Android platform scaffold at `web/android`.
  - Added mobile scripts in `web/package.json`:
    - `build:mobile`
    - `build:mobile:quick`
    - `build:android:quick`
    - `cap:sync`
    - `cap:sync:android`
    - `cap:copy`
    - `cap:open:ios`
    - `cap:open:android`
    - `cap:run:ios`
    - `cap:run:android`
  - Applied mobile UX optimization while keeping desktop behavior:
    - Bottom tab bar on mobile in `web/src/App.tsx`
    - Sticky top header + safe area spacing
    - Better small-screen spacing and controls in dashboard/budgets/transactions
    - Horizontal-safe tables for dense data screens
    - Removed dead state in transactions to keep strict TypeScript builds clean
  - Verified mobile asset pipeline:
    - `npm run build:mobile:quick` works and syncs to iOS shell.
    - `npm run build:android:quick` works and syncs to Android shell.
    - `./gradlew.bat installDebug` succeeded and installed on emulator `Medium_Phone_API_36.1`.
  - Known blocker:
    - `npm run build` currently fails due pre-existing TypeScript issues across unrelated files.
    - Use `build:mobile:quick` while we address type cleanup in parallel.
  - Added Android bug-capture script at repo root:
    - `capture-bug.ps1`
    - Produces timestamped bundle with screenshot, UI tree, full logcat, app logcat, and metadata.
  - Emulator blank-screen debugging completed:
    - Fixed native API base handling with `web/src/lib/runtime.ts`.
    - Wired Axios base URL to runtime resolver in `web/src/lib/api.ts`.
    - Added native fetch URL rewriting in `web/src/main.tsx` for raw `fetch('/api/...')` calls.
    - Added Android cleartext allowance in `web/android/app/src/main/AndroidManifest.xml`.
    - Added Android HTTP scheme (`androidScheme: 'http'`) in `web/capacitor.config.ts` to avoid mixed-content blocking.
    - Hardened dashboard rendering guards to avoid crash on malformed responses.
    - Removed stale `/vite.svg` favicon reference to stop repeated asset errors in native logs.
  - Local machine note:
    - Port `8000` was occupied by another local uvicorn app (`Nautilus`), which caused wrong API responses.
    - For this machine/emulator session, backend was started on `8010`.
    - Android build was generated with:
      - PowerShell: `$env:VITE_API_URL='http://10.0.2.2:8010'; npm run build:android:quick`
    - Verified working state in emulator:
      - Dashboard fully renders with cards/charts.
      - Fallback banner for latest available month appears correctly.

## Next Milestone
- Android emulator loop (Windows):
  - `cd web`
  - If backend runs on `8000`:
    - `npm run build:android:quick`
  - If backend runs on `8010` (port conflict workaround):
    - PowerShell: `$env:VITE_API_URL='http://10.0.2.2:8010'; npm run build:android:quick`
  - `npm run cap:open:android`
  - Run on emulator from Android Studio
- Direct deploy path (Windows terminal):
  - `cd web/android`
  - `./gradlew.bat installDebug`
- Backend start (Windows terminal):
  - `cd budget-tracker`
  - `.\.venv\Scripts\python.exe -m uvicorn bt_app.main:app --reload --port 8010`
- Fast bug capture (Windows terminal):
  - `.\capture-bug.ps1 -Label "short-description"`
  - Output goes to `artifacts\mobile-bugs\<timestamp>-<label>`
- Define and test the first "monthly ritual" flow end-to-end on Android emulator.
- iOS compile/sign/upload remains a macOS step.
