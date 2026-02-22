# Alpha Deployment (Render + Vercel)

This project currently has no user authentication layer. Treat the backend as private and protect it with `APP_SHARED_KEY`.

## 1) Backend Deploy (Render)

- Service type: `Web Service`
- Root directory: `server`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn bt_app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`
- Python version: `3.11.11` (important; avoid Python 3.14 for current pandas pin)
  - repo pin files included: `server/runtime.txt` and `server/.python-version`
  - if Render service was created manually (not from `render.yaml` blueprint), still set `PYTHON_VERSION=3.11.11` in dashboard.

### Render environment variables

- `APP_SHARED_KEY=<long-random-secret>`
- `PYTHON_VERSION=3.11.11`
- `SECRET_KEY=<long-random-secret>`
- `DATABASE_URL=<safe alpha db url>`
- `PLAID_ENV=sandbox` (start here first)
- `PLAID_CLIENT_ID=<plaid client id>`
- `PLAID_SECRET=<plaid secret>`
- `PLAID_REDIRECT_URI=https://www.signalledger.ca/plaid/oauth-return`
- `PLAID_COUNTRY_CODES=CA,US`
- `PLAID_PRODUCTS=transactions`

Notes:
- Do not commit real secrets.
- For alpha safety, use a dedicated sandbox DB first.
- If you have NOT mounted a Render disk yet, use temporary writable path:
  - `DATABASE_URL=sqlite:////tmp/signalledger_alpha.db`
- Once disk is mounted at `/var/data`, switch to:
  - `DATABASE_URL=sqlite:////var/data/signalledger_alpha.db`

## 2) Frontend Env (Vercel Production)

- `VITE_API_URL=https://<your-render-service>.onrender.com`
- `VITE_APP_KEY=<same value as APP_SHARED_KEY>`

Important:
- Vite env vars are baked at build time.
- After changing Vercel env vars, trigger a redeploy.

## 3) Required domain/plaid alignment

- Plaid Dashboard allowed redirect URI:
  - `https://www.signalledger.ca/plaid/oauth-return`
- Backend env `PLAID_REDIRECT_URI` must exactly match this value.

## 4) Verification checklist

1. `GET https://<render-service>/health` returns `{"status":"healthy"}`.
2. `GET https://<render-service>/api/health` returns `{"status":"healthy"}`.
3. `POST https://<render-service>/api/plaid/link-token` without `x-app-key` returns `401`.
4. `POST https://<render-service>/api/plaid/link-token` with `x-app-key` returns a link token JSON response.
5. `https://www.signalledger.ca/plaid/oauth-return` loads the SPA.
6. Connect New Bank works from the phone app.

## 5) Data safety guidance

- Without auth/tenant boundaries, all data endpoints must stay behind `APP_SHARED_KEY`.
- Keep CORS strict, but do not treat CORS as security.
- Add backend rate limiting before wider release (recommended next step).
