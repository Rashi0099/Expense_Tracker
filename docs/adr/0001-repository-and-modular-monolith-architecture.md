# ADR 0001: Monorepo Strategy and Django Modular Monolith Architecture

## Status
Accepted and Frozen

## Context
The project requires building a production-grade personal expense management platform spanning:
- A Django REST Framework backend with PostgreSQL
- A React + TypeScript web application
- An offline-first React Native mobile application
- Strict synchronization and shared API contracts

## Decisions

1. **Repository Strategy (Monorepo):**
   - Adopt a single monorepo (`backend/`, `web/`, `mobile/`, `contracts/`, `docs/`, `scripts/`).
   - Ensures atomic version alignment between backend API changes, OpenAPI contracts, and frontend/mobile type interfaces without cross-repo coordination overhead.

2. **Backend Architecture (Modular Monolith):**
   - Use a Django Modular Monolith partitioned into 9 domain apps:
     `authentication`, `users`, `categories`, `expenses`, `income`, `budgets`, `recurring`, `analytics`, `synchronization`.
   - Strictly prohibit microservices for MVP to eliminate distributed transaction and network overhead.
   - Enforce Service-Selector layering:
     - `views/`: HTTP transport adapter only.
     - `serializers/`: Deserialization validation and response formatting only.
     - `services/`: All write operations and business logic.
     - `selectors/`: All read-only queries and aggregations.
     - Direct cross-app ORM model mutations are prohibited.

3. **Web Architecture:**
   - React + TypeScript + Vite.
   - Server state handled via `@tanstack/react-query`. No heavy state managers (Redux).
   - Domain feature-sliced structure in `src/features/`.

4. **Mobile Architecture:**
   - React Native + TypeScript + Local SQLite.
   - Designed for sub-100ms fast expense capture.
   - Completely decoupled from immediate network availability; writes locally to SQLite first, queues mutations in `sync_outbox`, and synchronizes asynchronously in the background.
