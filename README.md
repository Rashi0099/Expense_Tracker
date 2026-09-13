# Expense Management Platform

A production-grade, local-first personal expense management platform consisting of:
- **Backend**: Django REST Framework modular monolith with PostgreSQL, JWT authentication, and sync endpoints.
- **Web**: React + TypeScript + Vite with TanStack React Query, Tailwind CSS, and Lucide icons.
- **Mobile**: React Native + TypeScript with local SQLite, atomic outbox persistence, and rapid expense capture.
- **Contracts**: Shared OpenAPI 3.1 specifications & generated TypeScript interfaces.

---

## Repository Structure

```text
├── backend/          # Django REST API modular monolith
├── web/              # React + Vite web dashboard
├── mobile/           # React Native local-first mobile app
├── contracts/        # Shared OpenAPI specs and generated TS types
├── docs/             # Architecture, Database ERDs, Sync protocol docs
└── scripts/          # Workspace automation scripts
```

---

## Quick Start: Running the Platform Locally

### 1. Database (PostgreSQL)

You can start PostgreSQL via Docker Compose:
```bash
docker compose up -d postgres
```
*Or use an existing PostgreSQL instance on port `5432` / `5433` matching `backend/.env`.*

---

### 2. Backend (Django REST Framework)

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver 8000
```
- **API Base:** `http://127.0.0.1:8000/api/v1/`
- **Swagger / OpenAPI Docs:** `http://127.0.0.1:8000/api/v1/docs/`
- **Health Check:** `http://127.0.0.1:8000/api/v1/health/`

**Running Backend Tests:**
```bash
cd backend
source .venv/bin/activate
pytest
```
*(All 22 unit & integration tests pass cleanly).*

---

### 3. Web Application (React + TypeScript + Vite)

```bash
cd web
npm install
npm run dev
```
- **Web App URL:** `http://localhost:5173/`

**Web Quality Checks:**
```bash
cd web
npm run lint         # ESLint check (0 errors)
npm test             # Vitest suite (32/32 tests pass)
npm run build        # Production TypeScript compilation & bundle build
```

---

### 4. Mobile Application (React Native + TypeScript Foundation)

```bash
cd mobile
npm install --legacy-peer-deps
npm start
```
- For Android: `npm run android`
- For iOS: `npm run ios`

**Mobile Quality Checks:**
```bash
cd mobile
npm test             # Vitest test suite (13/13 tests pass)
npm run typecheck    # TypeScript compilation (0 errors)
```

---

## Key Architecture Guarantees

1. **Financial Precision:**
   - Database and repositories store monetary amounts in **Minor Units (Integer Cents)** to eliminate IEEE 754 floating-point drift.
   - Exact conversion helpers (`dollarsToCents`, `centsToDollars`) ensure zero rounding loss.
2. **Local-First & Atomic Outbox:**
   - The mobile application performs all mutations directly against local SQLite inside an atomic transaction paired with a `sync_outbox` record.
3. **Strict Data Isolation:**
   - Multi-user data isolation enforced on both backend (Django queryset filtering by `user=request.user`) and mobile (SQLite query filtering by `user_id = ?`).
4. **Token Security:**
   - In-memory Access Token + Secure Device Refresh Token rotation (RTR) with automatic 401 interceptor refresh.
