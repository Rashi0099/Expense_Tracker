# ExpenseFlow — Django Backend Foundation

A production-grade modular monolith backend for personal expense tracking, built with Django, Django REST Framework, and PostgreSQL.

---

## 1. Prerequisites
- **Python:** `3.11+` (Active: `Python 3.12.3`)
- **PostgreSQL:** `16+`

---

## 2. Local Setup & Installation

### Step 1: Create and Activate Virtual Environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements/development.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` and verify database credentials:
```bash
cp .env.example .env
```

---

## 3. PostgreSQL Database Setup

### Option A: Standard Ubuntu System PostgreSQL
```bash
sudo -u postgres psql -c "CREATE USER expense_user WITH PASSWORD 'expense_pass';"
sudo -u postgres psql -c "CREATE DATABASE expense_db OWNER expense_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE expense_db TO expense_user;"
```

### Option B: Local User-Space Development Cluster (No Sudo Required)
```bash
/usr/lib/postgresql/16/bin/initdb -D backend/.pgdata -U expense_user --auth=trust
/usr/lib/postgresql/16/bin/pg_ctl -D backend/.pgdata -o "-p 5433 -k /tmp" -l backend/.pgdata/server.log start
/usr/lib/postgresql/16/bin/createdb -h localhost -p 5433 -U expense_user expense_db
```

---

## 4. Run Migrations & System Check
```bash
python manage.py check
python manage.py migrate
```

---

## 5. Start Development Server
```bash
python manage.py runserver 8000
```
Visit health check:
- `http://localhost:8000/health/`
- `http://localhost:8000/api/v1/health/`

---

## 6. Testing & Quality Checks

### Run Tests
```bash
pytest
```

### Run Linting and Formatting
```bash
ruff check .
black --check .
```
