# ARCHITECTURE — CalorieTracker (working title)

Status: revised 2026-07-16 — **local-first, single-user, no backend**. Binding; deviations require updating this doc in the same change.

## 1. Core principle

The device's **SQLite database is the primary and authoritative store**. There is no server, no user account, no authentication, no cloud sync, and no mandatory network dependency. The app works fully offline except for explicitly optional online lookups (unknown barcode, optional online food search, optional AI photo analysis).

## 2. Stack

| Concern                  | Choice                                                                | Why                                                        |
| ------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| App framework            | React Native + **Expo** SDK 57 (dev builds)                           | single codebase iOS/Android; camera/health need dev builds |
| Language                 | TypeScript, `strict: true`                                            | mandated                                                   |
| Routing                  | **Expo Router** (file-based, typed)                                   | mandated                                                   |
| Database                 | **expo-sqlite** — versioned migrations, FK ON                         | authoritative store; queryable, offline, fast              |
| Validation               | **Zod** at all boundaries (DB rows, API responses, forms)             | mandated                                                   |
| Async/server-state cache | TanStack Query (introduced in M4 when the diary needs it)             | caching/invalidation around repository calls               |
| UI state                 | Component state / small Zustand slices if needed                      | minimal                                                    |
| i18n                     | i18next + expo-localization                                           | en/el                                                      |
| Charts                   | Victory Native or equivalent (final pick M7)                          | perf on long histories                                     |
| Testing                  | Jest (jest-expo) + RNTL + real SQLite integration tests + Maestro E2E | see TEST_STRATEGY                                          |
| Lint/format              | ESLint (zero warnings) + Prettier                                     | CI gate                                                    |

Every new dependency needs a written justification (AGENTS.md rule 11).

## 3. Repository layout

```
CalorieTracker/
├── AGENTS.md
├── docs/
├── src/
│   ├── app/                  # Expo Router routes ONLY (thin)
│   │   ├── (tabs)/           # today (index), diary, progress, plans, profile
│   │   ├── (onboarding)/     # guarded local profile setup
│   │   └── (modals)/         # food-search, barcode, editors (M5+)
│   ├── ui/                   # design system: tokens/, components/, theme/
│   ├── features/<feature>/   # screen containers, feature hooks/components
│   ├── domain/               # PURE logic: goals/, nutrition/, score/, fasting/, units/, dates/, schemas/
│   ├── services/             # orchestration + adapter interfaces
│   │   ├── food-data/        # FoodDataProvider (OFF client, greek local)
│   │   ├── barcode/          # scanner wrapper
│   │   ├── vision/           # optional AI provider client (M12, user key)
│   │   ├── health/           # HealthKit / Health Connect adapters (M11)
│   │   └── notifications/
│   ├── db/                   # sqlite client, initialization, migrations/, seed/
│   ├── repositories/         # ALL data access; one repo per aggregate
│   ├── schemas/              # Zod schemas for persisted records
│   ├── types/                # shared domain/persistence types
│   ├── lib/                  # logger, storage, i18n init
│   ├── i18n/                 # en.ts, el.ts
│   └── test/                 # test utils, fixtures
├── e2e/                      # maestro flows
└── .github/workflows/        # ci
```

## 4. Layering (dependency rule: top imports bottom, never reverse)

```
src/app routes → src/features → src/services + src/repositories → src/domain
                      ↓                      ↓
                   src/ui              src/db, src/lib
```

- `src/domain` is pure TS — no React, no IO; fully unit-testable.
- Screens never touch SQL or fetch — always repositories/services.
- Repositories own SQL, return Zod-parsed domain types; raw rows never leak upward.

## 5. Database (see DATA_MODEL for schema)

- One SQLite database (`calorietracker.db`), opened via a single client module (`src/db/client.ts`) with `PRAGMA foreign_keys = ON` and WAL mode.
- **Versioned migrations**: ordered TS modules (`src/db/migrations/00X_name.ts`) each running in a transaction; runner compares `PRAGMA user_version`, applies pending in order, bumps the version; a failure rolls back and surfaces a typed error. Schema changes happen **only** via migrations.
- `created_at`/`updated_at` (ISO-8601 UTC strings) maintained by the repository layer.
- IDs: UUIDv7 strings generated in-app.
- Seeds: `src/db/seed/dev.ts` (dev-only, `__DEV__`-gated, idempotent, empty-DB-only); production seed data (Greek food catalog, M5+) ships as normal migrations/seed modules.
- Analytics on long histories via SQL aggregate queries (M7) — raw rows never fanned out to JS for charting.
- App startup is gated by `DatabaseProvider`: tabs do not render until initialization succeeds. A localized loading state and safe, retryable error state preserve the M1 theme and navigation.
- Theme/language live in `settings`; the small M1 AsyncStorage values are imported on first M2 launch and retained only as a pre-database startup cache. Preference changes update both, with SQLite authoritative.
- `ProfileProvider` loads the singleton profile after database initialization. Route guards show onboarding until the profile exists and expose the five-tab shell only after a valid, guarded target is saved.
- Goal calculations and safety rules are pure functions under `src/domain/goals`; `src/services/profile.ts` re-runs all validation and guardrails before persistence, so screens cannot bypass a blocked or unconfirmed target.
- Every saved profile target appends a `profile_goal_history` version in the same SQLite transaction as the current-profile update.

### Integration-test runtime

Production always uses `expo-sqlite`. Jest runs on Node, where Expo's native module is unavailable, so DB integration tests use Node's built-in `node:sqlite` adapter. This is a genuine in-memory SQLite engine—not a mock—and it executes the exact production migration SQL and repository contracts. The adapter distinction is limited to native async calls versus synchronous Node calls wrapped by the shared async `Database` interface.

## 6. External providers — optional, adapter-isolated

All network access is **optional** and behind interfaces in `src/services`; the app never requires it.

- `FoodDataProvider` — `searchByText`, `getByBarcode`. Implementations: `GreekLocalProvider` (SQLite, always available), `OpenFoodFactsProvider` (direct HTTPS, **no API key**, custom User-Agent, results normalized + cached into `foods`/`scanned_products`). USDA FDC is **not used** unless coverage proves insufficient (would need a free key — deliberately deferred).
- `VisionProvider` (M12, optional) — direct client → provider call with a **user-supplied key** stored in expo-secure-store; feature disabled without a key.
- `HealthDataProvider` (M11) — HealthKit/Health Connect adapters; device-local data only.
- `BarcodeScanner` — expo-camera wrapper.

Rule: no file outside an adapter imports a provider SDK or URL. All responses Zod-validated and sanitized before persistence.

## 7. Offline model

Local reads/writes are the only path — there is nothing to sync. Online lookups (unknown barcode, optional OFF search) are cache-through: a successful response is normalized into SQLite so the same lookup works offline forever after. Every online feature has a graceful offline state (explains, never blocks logging — manual entry is always available).

## 8. Backups & data portability (M13)

- Export: CSV + JSON of all tables via the OS share sheet (expo-file-system + expo-sharing).
- Backup/restore: copy the SQLite file out / restore it in, with schema-version check on restore.
- Full wipe: deletes the DB and preferences after two-step confirmation.

## 9. Configuration & secrets

- **No environment variables and no API keys are required.** There is no `.env`.
- The only future secret is the optional M12 vision key: user-entered at runtime, stored in **expo-secure-store**, never in the repo, never in config files.
- CI keeps a secret scan (gitleaks) as a guardrail anyway.

## 10. Notifications

`expo-notifications`, local scheduled notifications only. A `NotificationScheduler` service reconciles user reminder settings on change/app start. Tone rules per PRODUCT_SPEC §15.

## 11. Observability

Dev: Expo dev tools + `src/lib/logger` (leveled, redacting). **No third-party crash reporting or analytics — ever** (personal use decision).

## 12. Decisions log

| #   | Decision                                                                                 | Status                                                    |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D1  | Single app repo, no monorepo                                                             | Accepted                                                  |
| D2  | **SQLite is the primary, authoritative database; no backend, no sync**                   | Accepted (2026-07-16, supersedes the old Supabase design) |
| D3  | ~~Supabase/Edge Functions gateway~~                                                      | **Dropped** — no backend                                  |
| D4  | Nutrients per 100 g/ml canonical + JSON micros                                           | Accepted                                                  |
| D5  | Diary entries snapshot nutrients at log time                                             | Accepted                                                  |
| D6  | Charts lib final pick                                                                    | Deferred to M7                                            |
| D8  | App name/branding                                                                        | Deferred                                                  |
| D9  | Personal use only: no accounts/auth/cloud/subscriptions/ads/telemetry/store distribution | Accepted                                                  |
| D10 | OFF called directly (keyless); USDA deferred; vision key user-supplied at runtime        | Accepted                                                  |
