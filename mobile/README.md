# Expense Tracker — Mobile Application (React Native + TypeScript)

Production-grade, local-first mobile client for the Expense Management ecosystem. Designed for **friction-free expense capture (2–5 seconds)** with instantaneous local commits ($< 50\text{ms}$), bidirectional offline-first synchronization with Django REST API / PostgreSQL, and zero financial rounding drift via integer minor units.

---

## 1. Architectural Highlights

- **Local-First SQLite Engine:** Powered by `react-native-quick-sqlite` (JSI). All screens query local SQLite directly; network latency never blocks user interaction.
- **Integer Minor Units (Cents):** All financial amounts are stored as integer minor units (`amount_cents`) end-to-end to eliminate IEEE 754 floating-point drift.
- **Transactional Outbox Sync:** Every mutating action (create, update, delete) commits to the entity table and `sync_outbox` atomically within a single SQLite transaction.
- **Deterministic Category Memory (Zero AI/ML):** 3-tier merchant-to-category learning system querying user recency/frequency SQLite associations with keyword fallbacks.
- **Security & Multi-User Isolation:** Credentials and tokens are stored in `SecureStorage` (AsyncStorage/Keychain abstraction) and never in plain SQLite. All database operations and outbox queues are strictly partitioned by authenticated `user_id`.
- **Recent-Apps Privacy:** Dynamic privacy shield obscures sensitive account balances when the application is backgrounded in system app switchers.
- **Accessibility & Financial Cues:** Every status indicator pairs color with text labels and visual icons (`▲`, `▼`, `✓`, `⚠️`, `🚨`) so that interfaces never rely on color alone.

---

## 2. Setup & Prerequisites

### Requirements
- **Node.js:** `>= 18.0.0`
- **Package Manager:** `npm` or `yarn`
- **Android Development:** Android Studio, JDK 17, Android SDK Platform 34, Android Virtual Device or physical device with USB debugging enabled.
- **iOS Development (macOS host only):** Xcode 15+, CocoaPods (`bundle exec pod install`).

### Installation
```bash
cd mobile
npm install
```

---

## 3. Environment Variables

Create a `.env` file in the `mobile/` root (or configure `.env.example`):

```bash
# API Base URL (Use 10.0.2.2 for Android Emulator, 127.0.0.1 for iOS Simulator)
API_BASE_URL=http://10.0.2.2:8000

# SQLite Database Name
SQLITE_DB_NAME=expenses.db

# Client Platform Identifier
PLATFORM=mobile
CLIENT_VERSION=1.0.0
```

---

## 4. Development Commands

| Command | Purpose |
| :--- | :--- |
| `npm start` | Launches Metro bundler |
| `npm run android` | Builds and runs on connected Android device/emulator |
| `npm run ios` | Builds and runs on connected iOS simulator (macOS only) |
| `npm test` | Executes Vitest unit & integration test suite (17 suites, 63 tests) |
| `npm run typecheck` | Validates TypeScript with zero type emissions (`tsc --noEmit`) |

---

## 5. Local Database & Migrations

### Schema Layout
- `schema_migrations`: Version tracking table.
- `categories`: Default system categories and user-created custom categories.
- `expenses`: Primary transaction table with indices on `user_id`, `transaction_date`, `category_id`, and `deleted_at`.
- `income`: Credit streams table with indices on `user_id` and `transaction_date`.
- `budgets`: Monthly overall and category-specific financial ceilings.
- `recurring_expenses`: Subscription and scheduled payment definitions.
- `category_memory`: Merchant keyword associations, frequencies, and last-used timestamps.
- `sync_outbox`: FIFO queue of local pending mutations (`CREATE`, `UPDATE`, `DELETE`).
- `sync_metadata`: High-water-mark server cursor and synchronization timestamp log.

### Migrations
Migrations are managed programmatically via `MigrationRunner.ts`. When the app launches, `DatabaseManager.getInstance().initialize()` automatically discovers and executes unapplied migrations inside an isolated transaction.

---

## 6. Authentication & Token Lifecycle

1. **Login / Register:**
   - Client sends credentials and device UUID to `POST /api/v1/auth/login/` or `register/`.
   - Access token is kept strictly in-memory (`tokenStore`).
   - Refresh token and device ID are stored in `SecureStorage`.
2. **Silent Refresh Interceptor:**
   - If an API request returns `401 Unauthorized`, `mobileApiClient` intercepts the error, calls `POST /api/v1/auth/token/refresh/`, updates the in-memory token, and replays the queued request.
3. **Logout & Account Switching:**
   - Calling `logout()` revokes the device session on the server, clears `SecureStorage`, unsets `currentUserId` in `DatabaseManager`, and resets `SyncEngine` state. User A's pending outbox queue is detached and never visible to User B.

---

## 7. Synchronization Protocol (Offline-First)

### Outbox Push (`POST /api/v1/sync/push/`)
- Batches up to 50 pending outbox records ordered by `created_at ASC`.
- Sends payload with client-generated idempotency UUIDs (`operationId`).
- Successfully applied operations are marked `COMPLETED` and pruned; transient failures increment `retry_count` with exponential backoff.

### Cursor Pull (`GET /api/v1/sync/pull/?cursor=...`)
- Retrieves incremental server changes that occurred after `lastSyncedAt`.
- Uses deterministic conflict resolution:
  - Updates compare `version` numbers and modification timestamps.
  - Server changes update local SQLite records and fire `DataEvents` subscribers to re-render screens without a full refresh.

---

## 8. Deep Linking & App Shortcuts

Configured URL schemes:
- `expense-tracker://`
- `expenseapp://`
- `expensemanagement://`

Supported routes:
- `expense-tracker://expense/new` ➔ Opens rapid expense capture screen directly.
- `expenseapp://quick-add` ➔ Opens rapid expense capture screen directly.
- **Auth Continuity:** If an unauthenticated user activates a deep link, the link is preserved in `pendingDeepLink`. After successful login, the app automatically navigates to the target screen without losing context.

---

## 9. Comprehensive Testing

The mobile app includes 17 test suites covering 63 unit and integration test cases:

```bash
npm test
```

### Key Test Suites:
- `account_switching.test.ts`: Validates complete data isolation and outbox separation between users.
- `data_loss.test.ts`: Simulates process crashes, restarts, transaction aborts, and 500 server errors.
- `multi_device_sync.test.ts`: Validates single-record sync, multi-device convergence, and concurrent conflict resolution.
- `migration_upgrade.test.ts`: Tests schema upgrade preservation across all entities.
- `offline_duration.test.ts`: Simulates extended offline periods with 18+ mixed CRUD operations and reconciles on reconnect.
- `e2e_critical_flow.test.ts`: Exercises the end-to-end journey from Launch to Login, Dashboard, Offline Save, Restart, Reconnect, and Server verification.
- `large_dataset.test.ts`: Benchmarks 1,000, 5,000, and 10,000 items with responsive limits.
- `logger.test.ts`: Verifies automated scrubbing of JWT tokens, passwords, and sensitive financial fields.

---

## 10. Native Build Instructions

### Android Release Build
1. Generate release keystore:
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure credentials in `android/gradle.properties`.
3. Assemble production APK or AAB:
   ```bash
   cd android
   ./gradlew bundleRelease
   # or
   ./gradlew assembleRelease
   ```
   Output binary: `android/app/build/outputs/apk/release/app-release.apk`.

### iOS Production Build (macOS Host Only)
1. Install CocoaPods:
   ```bash
   cd ios && pod install
   ```
2. Open `ExpenseManagement.xcworkspace` in Xcode.
3. Configure Bundle Identifier and Provisioning Profile in Signing & Capabilities.
4. Product ➔ Archive ➔ Distribute to App Store or TestFlight.

---

## 11. Troubleshooting

- **Android Network Connectivity (ECONNREFUSED):**
  - Android emulators access the host machine's `localhost` via `http://10.0.2.2:8000`.
  - For physical Android devices connected via USB, run:
    ```bash
    adb reverse tcp:8000 tcp:8000
    ```
- **SQLite Database Inspection:**
  - In development, pull the SQLite database using adb:
    ```bash
    adb exec-out run-as com.expensemanagement.app cat databases/expenses.db > local_expenses.db
    sqlite3 local_expenses.db
    ```
- **Clearing In-Memory / Test Storage:**
  - Tests run on isolated in-memory adapters with zero pollution between runs.
