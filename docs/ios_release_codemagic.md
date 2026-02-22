# iOS Release Setup (Codemagic, No Local Mac)

This repo is prepared to build iOS from `mobile` branch via `codemagic.yaml`.

## What is already wired

- iOS project path: `web/ios/App/App.xcodeproj`
- Scheme: `App`
- Capacitor app id: `com.lukajurisic.budgettracker`
- Codemagic workflow: `ios-testflight` in `codemagic.yaml`
- Workflow behavior:
  - installs `web` deps
  - builds web bundle
  - syncs Capacitor
  - builds signed IPA
  - submits to TestFlight

## Codemagic setup (UI)

1. Open your app in Codemagic.
2. Make sure repository root is used (workflow file mode).
3. In team settings, connect App Store Connect integration.
  - This is used by `publishing.app_store_connect.auth: integration`.
  - In `codemagic.yaml`, set `workflows.ios-testflight.integrations.app_store_connect` to the exact integration key name from Codemagic (currently placeholder: `signalledger_asc`).
4. Create env group named `signalledger_ios`.
5. Add these env vars into `signalledger_ios`:
  - `VITE_API_URL=https://<your-render-backend>.onrender.com`
  - `VITE_APP_KEY=<same value as backend APP_SHARED_KEY>`
6. In Code signing identities/profiles:
  - import/select App Store distribution certificate
  - add provisioning profile for bundle id `com.lukajurisic.budgettracker`

## App Store Connect setup (after Apple approval)

1. Create iOS app record (if not created yet) with exact bundle id:
  - `com.lukajurisic.budgettracker`
2. Add TestFlight internal testers.
3. Fill minimum metadata:
  - app name, subtitle, description, keywords
  - support URL and privacy policy URL
  - screenshots
  - age rating + category + pricing/availability

## First build run

1. Push to `mobile` branch (or manually start workflow in Codemagic).
2. Run workflow `ios-testflight`.
3. Confirm output includes:
  - built `.ipa` artifact
  - TestFlight upload success

## If build fails

- `No profiles for ...`: provisioning profile/bundle id mismatch.
- `VITE_API_URL`/`VITE_APP_KEY` missing: add env vars in `signalledger_ios` group.
- Signing errors: verify App Store Connect integration + certificate validity.

## Notes

- Changing bundle id later requires matching updates in:
  - `web/capacitor.config.ts`
  - Xcode project signing config
  - App Store Connect app record
