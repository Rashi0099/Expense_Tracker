# REST API Specification (Version 1.0)

**Base URL:** `/api/v1/`  
**Authentication Scheme:** HTTP Bearer (JWT)  
**Content-Type:** `application/json; charset=utf-8`  
**Casing Standard:** JSON body keys are `camelCase`; Query parameters are `snake_case`.

---

## 1. Global Standards

### Error Envelope
All error responses (4xx and 5xx) conform to this immutable structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request parameters.",
    "requestId": "req_01HJ9Z2X3P4Q5W6E7R8T9Y0U",
    "timestamp": "2026-09-13T10:20:00.000Z",
    "details": [
      {
        "field": "amount",
        "issue": "AMOUNT_MUST_BE_POSITIVE",
        "message": "Expense amount must be greater than zero."
      }
    ]
  }
}
```

### Paginated Collection Envelope
```json
{
  "count": 142,
  "next": "https://api.example.com/api/v1/expenses/?page=2&page_size=20",
  "previous": null,
  "results": []
}
```

---

## 2. Authentication Endpoints

### `POST /api/v1/auth/register/`
* **Auth:** Public
* **Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "baseCurrency": "USD",
  "device": {
    "id": "018d3a50-7f22-7901-8653-a83d47d0e9a1",
    "platform": "IOS",
    "deviceName": "iPhone 15 Pro",
    "clientVersion": "1.0.0"
  }
}
```
* **Response (201 Created):**
```json
{
  "user": {
    "id": "018d3a50-7f20-7f31-8cae-5c4d6a13a902",
    "email": "user@example.com",
    "baseCurrency": "USD",
    "createdAt": "2026-09-13T08:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "d7a8e2b9c3f14a...",
    "expiresIn": 900
  }
}
```

### `POST /api/v1/auth/login/`
* **Auth:** Public
* **Request Body:** `email`, `password`, `device`
* **Response (200 OK):** Same payload as register.

### `POST /api/v1/auth/refresh/`
* **Auth:** Public
* **Request:** `{"refreshToken": "...", "deviceId": "UUID"}`
* **Response (200 OK):** `{"accessToken": "...", "refreshToken": "...", "expiresIn": 900}`

### `POST /api/v1/auth/logout/`
* **Auth:** Bearer Token
* **Request:** `{"refreshToken": "...", "deviceId": "UUID"}`
* **Response (204 No Content)**

### `GET /api/v1/auth/me/`
* **Auth:** Bearer Token
* **Response (200 OK):** User profile & base currency.

---

## 3. Expense Endpoints

### `GET /api/v1/expenses/`
* **Auth:** Bearer Token
* **Query Parameters:**
  * `page` (int, default 1)
  * `page_size` (int, default 20, max 100)
  * `category_id` (UUID)
  * `date_from` (YYYY-MM-DD)
  * `date_to` (YYYY-MM-DD)
  * `min_amount` (decimal)
  * `max_amount` (decimal)
  * `payment_method` (string)
  * `search` (string)
  * `ordering` (e.g. `-transaction_date`, `amount`)
* **Response (200 OK):** Paginated list of expenses.

### `POST /api/v1/expenses/`
* **Auth:** Bearer Token
* **Headers:** `Idempotency-Key: <UUID>` (optional, recommended)
* **Request:**
```json
{
  "id": "018d3a50-8b10-7e12-9214-5b4321fedcba",
  "amount": "45.50",
  "currency": "USD",
  "categoryId": "018d3a50-7a01-7111-9988-aabbccddeeff",
  "transactionDate": "2026-09-13",
  "paymentMethod": "CREDIT_CARD",
  "payee": "Whole Foods Market",
  "note": "Weekly organic groceries"
}
```
* **Response (201 Created):** Full expense resource.

### `GET /api/v1/expenses/{id}/`
* **Response (200 OK)**

### `PATCH /api/v1/expenses/{id}/`
* **Request:** Partial update fields + `"baseVersion": 1`
* **Response (200 OK)**

### `DELETE /api/v1/expenses/{id}/`
* **Response (204 No Content):** Performs soft-delete and records tombstone.

---

## 4. Income Endpoints

* `GET /api/v1/income/` (Paginated list with filters)
* `POST /api/v1/income/` (Create income inflow)
* `GET /api/v1/income/{id}/`
* `PATCH /api/v1/income/{id}/`
* `DELETE /api/v1/income/{id}/`

---

## 5. Category Endpoints

### `GET /api/v1/categories/`
* **Query Params:** `type` (`EXPENSE` | `INCOME`), `include_archived` (boolean)
* **Response (200 OK):** Array of categories including system defaults and user custom categories.

### `POST /api/v1/categories/`
* Creates user custom category (`isSystem: false`).

### `PATCH /api/v1/categories/{id}/` & `DELETE /api/v1/categories/{id}/`
* System categories (`isSystem: true`) return `403 Forbidden` if modified/deleted.
* Deletion performs a safe soft-archive (`isArchived: true`, `deletedAt: NOW()`) protecting historical transactions.

---

## 6. Budget Endpoints

### `GET /api/v1/budgets/?month=YYYY-MM`
* Returns overall monthly budget and category-level budgets with dynamic real-time consumption (`spent`, `remaining`, `percentageUsed`).

### `POST /api/v1/budgets/`
* Allocates budget. If `categoryId` is null, sets the overall monthly spending cap.

---

## 7. Recurring Expense Endpoints

* `GET /api/v1/recurring-expenses/`
* `POST /api/v1/recurring-expenses/` (Defines recurrence template)
* `PATCH /api/v1/recurring-expenses/{id}/` (Pause/resume with `isActive`)
* `DELETE /api/v1/recurring-expenses/{id}/`

---

## 8. Dashboard Endpoint

### `GET /api/v1/dashboard/?month=YYYY-MM`
* Returns aggregated cash-flow summary (total income, total expense, savings rate), overall budget progress, top spending categories, and recent transactions.
