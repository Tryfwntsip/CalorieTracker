# ARCHITECTURE — CalorieTracker (working title)

Status: Phase 1. Binding; deviations require updating this doc in the same change.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| App framework | React Native + **Expo** (dev builds, EAS) | Mandated; single codebase iOS/Android; native modules (camera, health) via dev builds |
| Language | TypeScript, `strict: true` | Mandated |
| Routing | **Expo Router** (file-based, typed routes) | Mandated; deep-link-ready |
| Backend | **Supabase**: Postgres, Auth, Storage, Edge Functions | Mandated; RLS for per-user isolation |
| Validation | **Zod** at all boundaries | Mandated |
| Server state | TanStack Query | Cache/retry/invalidations for repository calls; industry standard |
| Local/offline store | **expo-sqlite** (+ a thin DAO layer) | Diary must work offline; SQLite is the only robust queryable offline store in Expo |
| UI state | Zustand (small slices) | Minimal, no boilerplate; only for ephemeral UI state |
| i18n | i18next + expo-localization | Mature, pluralization for el/en |
| Charts | Victory Native (or equivalent RN-skia-based) | Perf on long histories; decided finally in M7 |
| Testing | Jest (jest-expo) + React Native Testing Library + Maestro (E2E) + SQL/RLS tests | See TEST_STRATEGY |
| Lint/format | ESLint + Prettier | Zero-warning CI |

Each new dependency beyond these requires justification (AGENTS.md rule 11).

## 2. Repository layout (single app repo, not a monorepo)

```
CalorieTracker/
├── AGENTS.md
├── docs/
├── src/
│   ├── app/                  # Expo Router routes ONLY (thin: layout + screen wiring)
│   │   ├── (tabs)/           # today (index), diary, progress, plans, profile
│   │   ├── (auth)/           # sign-in, sign-up, reset (M2)
│   │   ├── (onboarding)/     # (M4)
│   │   └── (modals)/         # food-search, barcode, photo-log, editors (M5+)
│   ├── ui/                   # design system: tokens/, components/, theme/
│   ├── features/<feature>/   # screen-level containers, feature hooks, feature components
│   ├── domain/               # PURE logic: goals/, nutrition/, score/, fasting/, units/, dates/, schemas/
│   ├── services/             # orchestration; owns adapter interfaces
│   │   ├── food-data/        # FoodDataProvider interface + gateway client
│   │   ├── vision/           # VisionProvider client (calls Edge Function)
│   │   ├── health/           # HealthDataProvider + HealthKit/HealthConnect adapters
│   │   ├── sync/             # outbox sync engine
│   │   └── notifications/
│   ├── repositories/         # ALL data access (SQLite + Supabase); one repo per aggregate
│   ├── lib/                  # supabase client, sqlite client, query client, i18n init, env
│   └── test/                 # test utils, fixtures, fakes
├── supabase/
│   ├── migrations/           # sql migrations (only way schema changes)
│   ├── functions/            # edge functions: food-gateway/, vision-analyze/, export-data/, delete-account/
│   ├── seed/                 # greek food db + sample recipes seed scripts
│   └── tests/                # RLS/SQL tests
├── e2e/                      # maestro flows
└── .github/workflows/        # ci
```

Monorepo (turborepo/pnpm workspaces) was considered and rejected for now: one client + Supabase functions doesn't justify the overhead ("prefer simple maintainable solutions"). Revisit only if a web app is added.

## 3. Layering (dependency rule: top may import bottom, never reverse)

```
app/ routes  →  src/features  →  src/services + src/repositories  →  src/domain
                     ↓                        ↓
                  src/ui                   src/lib
```

(Routes live at `src/app/` — the Expo SDK 57 template convention; `app/ routes` in the diagram above refers to `src/app/`.)

- `src/domain` imports nothing app-specific (pure TS, fully unit-testable, no React).
- Screens never call Supabase/SQLite/fetch directly — always through a repository or service.
- Repositories return domain types parsed with Zod; DB row types never leak into UI.

## 4. Data flow & state

- **Server state:** TanStack Query wraps repository calls; query keys namespaced per aggregate (`['diary', dateISO]`, `['food', id]`); mutations invalidate precisely.
- **Diary reads/writes go to SQLite first** (source of truth on device); Supabase is the durable replica (see §6).
- Non-diary, online-only data (recipes browsing, food search) go straight to repositories→Supabase/gateway with Query caching; recents/favorites are mirrored into SQLite for offline logging.
- Ephemeral UI state (open sheets, draft entry being edited) in Zustand or component state; never in the DB until confirmed.

## 5. External providers — adapter pattern

Every external system sits behind an interface owned by `src/services`:

- `FoodDataProvider` — `searchByText`, `getByBarcode`, `getById`; implemented by `OpenFoodFactsProvider`, `UsdaFdcProvider`, `GreekDbProvider` **inside the `food-gateway` Edge Function** (keys stay server-side; responses normalized to the canonical nutrient model + provenance before reaching the client). The client has one `FoodGatewayClient`.
- `VisionProvider` — `analyzeMealPhoto(image, locale) → DetectedMeal` with per-item confidence; implemented server-side in `vision-analyze` Edge Function (OpenAI/Gemini swappable via env). Client never talks to AI vendors directly.
- `HealthDataProvider` — `requestPermissions(types)`, `readSteps/readWorkouts/readWeight(range)`; `HealthKitAdapter` + `HealthConnectAdapter` are the only files importing those native modules.
- `BarcodeScanner` — thin wrapper over `expo-camera` scanning so the scanning lib can change.

Rule: no file outside the adapter may import a provider SDK or hit a provider URL.

## 6. Offline & sync (diary-critical)

**Local-first for user logs** (diary entries, water, weight, mood, exercise, steps, fasting sessions, notes):

1. Writes hit SQLite synchronously (instant UI) and append a row to an **outbox** table (`op`, `entity`, `entity_id`, `payload`, `client_ts`).
2. A sync engine (`src/services/sync`) drains the outbox when online: pushes ops to Supabase (upserts keyed by client-generated UUIDv7 ids), then pulls changes since `last_pulled_at` per table and applies them to SQLite.
3. **Conflict policy:** last-write-wins per row using `updated_at` (server clock on push); deletes are tombstones (`deleted_at`) so they sync; user entries are never dropped — a rejected write resurfaces in the diary with a retry marker.
4. Auth-expired or offline: outbox just accumulates; nothing blocks logging.
5. Foods cache: any food the user views/logs is snapshotted into SQLite (`food_cache`) with its nutrients, so past diary entries render offline and log-again works offline. Diary entries store a **denormalized nutrient snapshot** at log time — later edits to a food never rewrite history.

Non-goals: multi-device real-time merging beyond LWW; CRDTs (revisit only if real demand).

## 7. Edge Functions (server-side)

| Function | Purpose | Secrets used |
|---|---|---|
| `food-gateway` | Text/barcode/id lookup across providers; normalization; provenance; per-user rate limiting; response caching into `foods` table | USDA API key |
| `vision-analyze` | Meal photo → structured estimation via vision provider; enforces consent flags; deletes image unless retention consented | OpenAI/Gemini key |
| `export-data` | Assembles CSV+JSON bundle into a private storage object with signed URL | — |
| `delete-account` | Deletes auth user, all rows, storage objects; writes audit event | service role (function env only) |

All functions: Zod-validate input/output, require a valid user JWT, never accept a user id from the request body (always derive from JWT).

## 8. Auth

Supabase Auth. Email+password (verification + reset) in M2; Apple/Google sign-in are architecture-supported from day one (no username assumptions, account model keyed on Supabase `auth.users.id`) and switched on in M13-adjacent work. Session persisted with `expo-secure-store`. All repositories assume `auth.uid()`-scoped RLS.

## 9. Configuration & secrets

- Client env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` only. Read via a validated `src/lib/env.ts` (Zod, fail-fast, lazy).
- Server secrets: Edge Function secrets (`supabase secrets set`) — USDA key, vision provider key, provider selection flag.
- `.env` gitignored; `.env.example` kept current; EAS build profiles carry public env per environment (dev/preview/prod).

## 10. Notifications

`expo-notifications`, **local** scheduled notifications only (no push server needed for reminders). A `NotificationScheduler` service translates user reminder settings into scheduled notifications and reconciles on settings change/app start. Copy comes from i18n; tone rules enforced by review checklist.

## 11. Performance & history depth

- Progress queries served by SQL aggregates (daily rollup views/materialized tables per user) so 2 years of charts don't ship raw rows; client charts downsample by zoom level.
- FlashList for long lists; images via expo-image with caching; heavy screens code-split by route.

## 12. Observability

- Dev: Expo dev tools; structured console logging via a tiny `logger` with levels.
- Crash reporting / telemetry vendors: **not used** — the app is for personal use; no third-party analytics or crash SDKs.

## 13. Key decisions log

| # | Decision | Status |
|---|---|---|
| D1 | Single app repo, no monorepo | Accepted |
| D2 | SQLite local-first + outbox LWW sync for logs | Accepted |
| D3 | All food/AI providers behind Edge Functions (keys server-side) | Accepted |
| D4 | Nutrients stored per 100 g/ml canonical + jsonb micros | Accepted (see DATA_MODEL) |
| D5 | Diary entries snapshot nutrients at log time | Accepted |
| D6 | Charts lib final pick | Deferred to M7 |
| D7 | Crash reporting vendor | Dropped — personal use, no third-party telemetry |
| D9 | Personal use only: no store distribution, no ads/paywall ever, no analytics SDKs | Accepted |
| D8 | App name/branding | Deferred |
