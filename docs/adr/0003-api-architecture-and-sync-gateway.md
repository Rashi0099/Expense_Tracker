# ADR 0003: REST API Design, Hybrid Sync Gateway, and Financial JSON Contracts

## Status
Accepted and Frozen

## Context
The expense management platform requires a versioned, secure, and predictable API surface to serve both:
1. Online interactive web requests (React Web with TanStack Query).
2. Asynchronous, offline-first mobile sync batches (React Native with SQLite).

## Decisions

1. **Protocol Paradigm:**
   - Standard RESTful endpoints at `/api/v1/{resource}/` for online CRUD.
   - Dedicated atomic batch synchronization gateway at `POST /api/v1/sync/` for mobile offline sync.
2. **Authentication:**
   - Stateless JWT: 15-minute access tokens + 30-day rotating refresh tokens with automatic replay detection.
   - Web: Secure, `httpOnly`, `SameSite=Strict` cookies.
   - Mobile: Secure native hardware storage (Keychain / Keystore).
3. **Financial Precision in Transport:**
   - Monetary amounts are serialized as **fixed-point decimal strings** (`"amount": "45.50"`), preventing IEEE-754 floating-point corruption in client JSON parsers.
4. **Calendar Date Invariant:**
   - `transactionDate` is serialized as `'YYYY-MM-DD'`, preventing timezone shifts when viewing expenses in different timezones.
5. **Idempotency Guarantee:**
   - Enforce client-generated `operationId` (UUIDv7) on all sync operations and support `Idempotency-Key` headers on standard POST requests.
6. **Error Envelope:**
   - Unified error schema across all 4xx/5xx responses containing machine-readable `code`, human-readable `message`, unique `requestId`, and granular field `details`.
