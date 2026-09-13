# ADR 0004: Hybrid Authentication, Refresh Token Rotation, and Secure Storage

## Status
Accepted and Frozen

## Context
A production-grade expense tracker requires:
1. Low latency on high-frequency API endpoints.
2. Immediate session revocation control across multi-device scenarios.
3. Uninterrupted offline mobile usage without storing credentials insecurely.
4. Protection against XSS, CSRF, token theft, and IDOR attacks.

## Decisions

1. **Hybrid Token Architecture:**
   - Short-lived stateless JWT access tokens (15 min) verified without database hits.
   - Long-lived stateful refresh tokens (30 days) stored as SHA-256 hashes in PostgreSQL.
2. **Refresh Token Rotation (RTR):**
   - Refresh tokens are single-use. Replaying an invalidated refresh token triggers automatic family revocation, locking out attackers.
3. **Platform-Specific Credential Storage:**
   - **Web:** In-memory access token + `HttpOnly`, `Secure`, `SameSite=Strict` refresh cookie.
   - **Mobile:** In-memory access token + Hardware Encrypted Storage (iOS Keychain / Android Keystore). Zero tokens in SQLite.
4. **Offline Resilience:**
   - Local SQLite operations remain fully autonomous offline. Token expiration is evaluated strictly at network sync boundaries.
5. **Ownership & Tenant Isolation:**
   - Server-side query scoping by `user_id` is non-negotiable. IDOR attempts resolve to `404 Not Found`.
