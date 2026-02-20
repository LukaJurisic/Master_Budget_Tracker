# Proposed Plan

## Goals
1. Convert the existing single-user FastAPI/React codebase into a secure multi-tenant platform where customers can connect institutions, categorize transactions, and monitor budgets from any device.
2. Package the differentiating workflows that already exist (`Mapping Studio`, flexible imports, balances, analytics) into a micro SaaS offering with onboarding, billing, and support processes.
3. Extend surface area to mobile (starting with iOS) so customers can review insights and approve mappings on the go without sitting at a desktop.

## Feasibility Assessment
### Backend
- The FastAPI service (`server/bt_app`) is modular with routers for Plaid, sync, analytics, and budgets, making it feasible to add auth, user profiles, and multi-tenant scoping. However the current SQLite setup (`bt_app/core/config.py`) is single-tenant; replacing it with PostgreSQL plus Alembic migrations and row-level ownership fields is mandatory before onboarding customers.
- Background jobs already run through APScheduler (`bt_app/core/scheduler.py`), so scheduled syncs and notifications are achievable once tasks are tenant-aware and work queues are externalized (e.g., Redis, Celery, or hosted task runner).
- Security work is required: no auth, secrets live in `.env`, and Plaid tokens are stored locally. Implementing OAuth/passwordless auth, encrypted secret storage, and audit logging is necessary but technically aligned with the current stack.

### Frontend
- The React app (`web/src/App.tsx`) already exposes dashboards, mapping tools, budgets, balances, and income flows. Converting demo-only flows into authenticated, user-scoped views mainly requires wiring to new auth endpoints and feature flags (see `web/src/contexts/AppModeContext.tsx`).
- Component library (shadcn/ui + Tailwind) is production-ready; multi-tenant concerns are mostly around session handling, role-based access, and supporting multiple institutions per user.

### Infrastructure & Operations
- Need a deployable baseline: containerize both services, add CI/CD, secrets management, monitoring, logging, and automated backups.
- Billing/onboarding (Stripe + Customer.io/HubSpot) plus a support workflow (ticketing, status page) are required to sell as SaaS. The existing repo has no traces of these services, so this is net-new work but compatible with the architecture.
- Compliance: storing financial data mandates SOC2-like controls, encryption at rest, and documented incident response; plan must include these.

### Mobile (iOS)
- Because the backend already exposes REST endpoints for transactions, budgets, balances, and summary analytics, an iOS client (SwiftUI or React Native/Expo) can consume the same APIs once auth is live.
- Feasible path: start with a companion app focused on read-only dashboards + push notifications, then add lightweight actions (categorize, approve mappings). Publishing would follow once backend security and rate limits are hardened.

## Suggested Milestones
1. **Foundations (4-6 weeks):** migrate to PostgreSQL, add multi-tenant data model, implement auth + user management, stress-test Plaid/webhook handling.
2. **Productization (4 weeks):** onboarding wizard, billing integration, admin portal, feature flag controls, observability.
3. **Differentiation (3 weeks):** package Mapping Studio + custom import templates as premium workflows, add collaborative tooling (approvals, notes).
4. **Mobile Preview (3 weeks):** ship an iOS TestFlight build powered by new APIs, gather feedback, and iterate.

## Key Risks & Mitigations
- **Aggregator costs & regional coverage:** Plaid pricing can erode margins; evaluate Teller/Finicity integrations and tier pricing accordingly.
- **Data privacy/compliance:** handle PII and financial data carefully; adopt encryption, least-privilege roles, and third-party security reviews early.
- **Competitive positioning:** differentiate with multi-source mapping automation, deep budgeting analytics, and concierge-style onboarding to stand apart from Mint/YNAB.
