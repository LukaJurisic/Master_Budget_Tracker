# Repository Guidelines

## Project Structure & Module Organization
- `server/` holds the FastAPI service; core modules live under `server/bt_app/` (split into `api/`, `core/`, `models/`, `schemas/`, `services/`, `utils/`).
- Database migrations stay in `server/migrations/`; seed scripts and helpers sit beside requirements in the `server/` root.
- Backend tests live in `server/tests/` and mirror feature folders (e.g., `test_normalization.py` covers merchant remapping).
- `web/` contains the Vite + React client with entry points in `src/App.tsx` and route-level screens in `src/pages/`.
- Reference spreadsheets and export templates are in `excel_views/`; keep large CSV/XLS assets there to avoid polluting code directories.

## Build, Test, and Development Commands
- Bootstrap everything on Windows with `./setup.ps1`, which provisions the Python venv, installs npm packages, and copies `.env.example`.
- Backend workflow: `cd server; ./.venv/Scripts/activate; pip install -r requirements.txt; alembic upgrade head; uvicorn bt_app.main:app --reload`.
- Frontend workflow: `cd web; npm install; npm run dev` for live reload, `npm run build` to produce the production bundle, and `npm run preview` to smoke-test the build.
- Run the backend test suite with `cd server; pytest`; combine with `pytest server/tests/test_rules.py` when iterating on a single module.
- Lint TypeScript with `cd web; npm run lint` before sending a PR so CI stays clean.

## Coding Style & Naming Conventions
- Python code follows PEP 8: 4-space indents, `snake_case` functions, and `PascalCase` SQLAlchemy models/Pydantic schemas (see `telemetry_event` vs `BudgetSummary`).
- Co-locate service-layer helpers in `server/bt_app/services/` and keep API routers slim; prefer dependency injection via FastAPI’s `Depends`.
- React components live under `src/components` using `PascalCase` filenames; hooks in `src/hooks` stay `camelCase`.
- Favor TypeScript’s explicit return types for exported functions and keep Tailwind utility ordering consistent with the existing files.

## Testing Guidelines
- Place new pytest modules beside the feature they cover and name them `test_<feature>.py`; decorate async tests with `@pytest.mark.asyncio`.
- Use fixtures that seed the SQLite database via `seed_data.py` rather than checking in new `.db` files.
- Document reproduction steps in the test docstring when covering tricky Plaid or scheduler edge cases.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit style (`fix:`, `feat(scope):`, `chore:`) as seen in `git log`.
- Keep commits focused; include config or migration updates with the code that depends on them.
- PRs must outline the change, note backend/frontend impacts, list manual test commands (`pytest`, `npm run dev` smoke check), and attach UI screenshots when React views change.