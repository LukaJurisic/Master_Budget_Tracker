# CLAUDE.md — Recurring Subscriptions Logic

This guide explains how the "recurring subscriptions" backend works, the traps that bit us (TradingView!), and the exact steps to extend/debug it safely. If you follow this, new vendors will "just work," and the UI will stay in sync.

## Mission

Detect and summarize recurring expense subscriptions from the transactions table and serve them to the frontend in a stable, deterministic way.

### Primary endpoint

GET /api/analytics/recurring-subscriptions?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD

### Support/debug endpoints

- GET /api/analytics/__rev — running code signature
- GET /api/analytics/__dbinfo — active DB path + expense window + TradingView count
- GET /api/transactions?search=<query> — ad-hoc verification

## Design Principles

### Include-first for whitelisted vendors.
Whitelisted patterns (e.g., TRADINGVIEW) are detected before any blockers. They're added with relaxed gates and skip all later filters.

### Stable date math.
Use `import datetime as dt` module-wide and only `dt.*` inside the module. No function-local `datetime`/`timedelta` imports. Inputs default to DB min/max, and we swap if the user provides an inverted range.

### Uppercased substring matching.
Build BLOB = UPPER(merchant_raw) + " " + UPPER(merchant_norm) + " " + UPPER(description_raw). Normalize by uppercasing the concatenation of (merchant_raw, merchant_norm, description_raw) and do simple substring checks. Avoid brittle word-boundary regexes after normalization that scrubs punctuation.

### Whitelist (include-first)
One DB, one server.
Always point to the absolute SQLite path in .env to avoid creating stray app.db files under different CWDs.

### Frontend↔Backend contract.
Frontend calls /analytics/recurring-subscriptions (no -v2). Vite proxy must target the correct backend port.

## High-Level Algorithm

### 1. Determine date range

- Query MIN(posted_date), MAX(posted_date) for txn_type='expense'.
- Parse date_from/date_to if provided; otherwise default to min/max.
- If start_date > end_date, swap them.
  (Invariant: we always query a non-empty window when data exists.)

### 2. Fetch candidate rows

- Select: posted_date, amount, merchant_norm, merchant_raw, description_raw, category_name
- Conditions: txn_type='expense' AND posted_date BETWEEN start_date AND end_date
- LEFT JOIN category for display (but don't rely on it for inclusion).

### 3. Short-circuit vendor detection

```python
blob = " ".join([_U(merchant_raw), _U(merchant_norm), _U(description_raw)])
if "TRADINGVIEW" in blob:
    key = "TRADINGVIEW"
    force_include.add(key)
    by_merchant[key].append((transaction_date, pos_amt))
    merchant_categories[key].add(category_name or "Trading")
    continue  # skip all other filters
```

### 4. General filters

Category-based exclusions (groceries, gas, pharmacy, etc.).
Note: Whitelisted merchants never reach this step because of the short-circuit.

### 5. Assemble subscriptions

For each merchant key:

**Dynamic gates:**
- min_txns = 1 if key in force_include else 3
- min_months = 1 if key in force_include else 3
- streak_min = 1 if key in force_include else 3

- Group by (year, month) and pick a monthly representative amount (median of that month's charges).
- Merge price changes (unique, sorted).
- Compute current vs old: last month within dt.timedelta(days=90) of dt.datetime.now().date() → is_current = True.

### 6. Sort & respond

Current first (by total_charged desc), then old (by total_charged desc).

Response shape:
```json
{
  "subscriptions": [
    {
      "merchant": "TRADINGVIEW",
      "category": "Trading",
      "monthly_amount": 23.73,
      "months_count": 21,
      "total_charged": 502.28,
      "first_date": "2023-11-01",
      "last_date": "2025-07-01",
      "price_changes": [ ... ],
      "is_current": true
    }
  ],
  "summary": {
    "count": ...,
    "current_count": ...,
    "old_count": ...,
    "total_monthly": ...,
    "total_all_time": ...
  }
}
```

## The TradingView Postmortem (What Broke & Why)

1. **Generic merchant name**: merchant_raw = "B2B TRANSACTION" with the useful signal in description_raw (e.g., BT*TRADINGVIEWA*PRODUCT WESTERVILLE).

2. **Blocked too early**: "B2B TRANSACTION" was on a blocked list. The whitelist ran after blockers, so rows never reached the vendor matcher.

3. **Regex boundaries vs normalization**: _clean_upper removes punctuation, so \b boundaries became unreliable. Substring matching on the uppercased blob is simpler and more robust.

4. **Two SQLite files**: relative sqlite:///./app.db created a second DB under a different CWD. Fix = absolute path in .env.

### Fixes now in place

- Whitelist runs first and continues; blockers cannot veto.
- Uppercased substring checks (no brittle \b after scrubbing).
- Absolute DB path in .env.
- Stable date fallback (min/max) and no local datetime/timedelta imports.

## Extending to New Vendors

Add a vendor in a data-driven whitelist:

```python
# Pseudocode config living near the top of the module
WHITELIST = {
  "TRADINGVIEW": ["TRADINGVIEW", "TRADINGVIEWA"],
  "EQUINOX": ["EQUINOX", "EQUINOX FITNESS", "EQUINOX FITNESS SHOP"],
  # Add new vendors here:
  # "SPOTIFY": ["SPOTIFY", "SPOTIFYUSA"],
}
```

Detection (include-first):
```python
blob = " ".join([(merchant_raw or ""), (merchant_norm or ""), (description_raw or "")]).upper()
for key, tokens in WHITELIST.items():
    if any(t in blob for t in tokens):
        force_include.add(key)
        by_merchant[key].append((posted_date, abs(amount)))
        merchant_categories[key].add(category_name or key.title())
        continue  # Skip further filters
```

### Checklist for a new vendor

- [ ] Add tokens to WHITELIST[key] (include common variants/prefixes).
- [ ] Verify with /transactions?search=<token> that rows exist.
- [ ] Hit /analytics/recurring-subscriptions and confirm it appears.
- [ ] (Optional) Add small unit test: 2–3 synthetic rows produce one subscription with correct months_count.

## Invariants & Edge Cases

### Invariants

- txn_type = 'expense' only.
- Date window is never empty when DB has expenses (min/max fallback).
- Whitelisted vendors bypass blockers and use relaxed gates.

### Edge cases handled

- Multiple same-merchant charges in a month → median representative.
- Small price drift → reflected in price_changes.
- Last payment > 90 days → is_current = false (goes to "old").

### Edge cases to watch

- **Refunds/charge reversals** (negative of the negative) — current approach uses absolute values; if reversals become common, add logic to ignore month net≈0.
- **Collisions**: two different merchants sharing tokens (rare but possible). Prefer vendor-specific tokens to minimize false positives.

## Debugging Playbook

If a vendor doesn't show up:

1. **Data exists?**
   `/api/transactions?search=<token>&per_page=50` → confirm rows and fields.

2. **DB sanity:**
   `/api/analytics/__dbinfo` → path + expense window + specific counts.

3. **Version sanity:**
   `/api/analytics/__rev` → ensure expected code is running.

4. **Frontend proxy:**
   Vite proxy['/api'] must target the correct backend port.

5. **Whitelist first?**
   Ensure vendor tokens are in WHITELIST and the include-first block runs before blockers.

6. **Date window:**
   Try explicit `?date_from=<min>&date_to=<max>` to rule out parsing issues.

## Frontend Contract

- **Endpoint**: `/api/analytics/recurring-subscriptions`
- **Response shape**: see "Sort & respond" section.
- **Vite proxy (dev)**: ensure `/api` → `http://localhost:<backend_port>`
  (In this repo, 8001 during debugging; default is 8000. Keep them aligned.)

## Anti-Patterns (Don't Do This)

❌ **Local imports inside request handlers** (`from datetime import timedelta` etc.).
Python will treat the name as local across the function and raise UnboundLocalError earlier.

❌ **Relative SQLite paths in .env** (`sqlite:///./app.db`).
Use an absolute path to avoid accidental second DBs.

❌ **Relying on regex word boundaries after heavy normalization**.
Use simple uppercased substrings against the full blob (raw+norm+desc).

❌ **Letting blockers run before whitelists**.
Short-circuit whitelists first and continue.

## Lightweight Unit Test Sketch (Backend)

```python
def test_tradingview_detection(client, seed_rows):
    # seed_rows adds three TRADINGVIEW-like expenses across 3 months
    r = client.get("/api/analytics/recurring-subscriptions")
    data = r.json()
    tv = next((s for s in data["subscriptions"] if s["merchant"] == "TRADINGVIEW"), None)
    assert tv is not None
    assert tv["months_count"] >= 1
    assert tv["is_current"] in (True, False)  # depends on fixture dates
```

## Ops Notes

- Keep `/__dbinfo` and `/__rev` — they catch 95% of drift (wrong DB, wrong code, empty window).
- When changing ports during debugging, update Vite proxy or revert backend to .env BACKEND_PORT.

## TL;DR

- **Detect includes first, block later**.
- **Uppercase substrings** over raw+norm+desc.
- **`import datetime as dt` only**; no local imports.
- **Absolute DB path**.
- **UI proxy must target the live backend**.