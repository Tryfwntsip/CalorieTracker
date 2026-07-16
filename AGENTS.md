# AGENTS.md — Permanent Project Conventions

Working title: **CalorieTracker** (final name TBD).
This file is the contract for every agent/developer session. Read it before touching code. The normative spec is `docs/PRODUCT_SPEC.md`; current milestone lives in `docs/ROADMAP.md`.

## What this product is

An original, **personal, single-user, local-first** nutrition and lifestyle tracker for iOS + Android: food diary, calorie/macro goals, food search (local Greek DB + optional Open Food Facts), barcode scanning, optional AI meal-photo estimation, an original transparent food score, recipes + meal planning + grocery lists, intermittent fasting, HealthKit/Health Connect, progress analytics, and local data export/backup. Greek + English, metric units, dark/light themes.

It is **not** a YAZIO clone — never copy any proprietary app's name, branding, text, recipes, database, scoring algorithm, or exact layouts.

**Permanently out of scope (user decision 2026-07-16):** user accounts, authentication, Supabase or any backend, cloud sync, subscriptions, payments, ads, third-party analytics/telemetry, store distribution. **SQLite on the device is the primary and authoritative database.** Do not reintroduce any of these.

## Hard rules

1. **One milestone at a time.** Scope is defined in `docs/ROADMAP.md`. Do not start milestone N+1 work inside milestone N.
2. **Docs are load-bearing.** If an architectural decision changes, update the relevant doc in the same change. Never silently diverge from `docs/ARCHITECTURE.md`.
3. **No secrets, no API keys, no external accounts.** The app requires none. The only future exception (optional M12 vision key) is user-entered at runtime into expo-secure-store — never in code, config, or the repo.
4. **Schema changes only via versioned SQLite migrations** (`src/db/migrations/`, PRAGMA `user_version`, transactional, tested). Never mutate schema ad hoc. Foreign keys stay ON.
5. **Business logic outside UI components.** Screens render and dispatch; calculations, rules, and data access live in `src/domain`, `src/services`, `src/repositories`. SQL exists only in `src/db` + repositories.
6. **Deterministic, tested calculations.** Calorie/macro targets, nutrient math, the food score, and unit conversions are pure functions in `src/domain` with table-driven unit tests. No `Date.now()`/randomness inside them — pass time in.
7. **Zod at every boundary.** DB rows leaving repositories, external API responses, deep links, storage reads, and form submissions are parsed before entering the domain.
8. **Offline-first.** Every feature works without network except explicitly optional lookups (unknown barcode, optional OFF search, optional AI photo). Online features degrade gracefully and cache through to SQLite.
9. **Adapters for every external system** (Open Food Facts, vision, health platforms, barcode scanner). Code against the interface in `src/services/<area>/types.ts`; no file outside an adapter imports a provider SDK/URL.
10. **No fake UI.** Anything non-functional must be visibly marked (`ComingSoon` with its milestone), never a dead button. No mock data on production paths — mocks live in tests/fixtures; dev seeds are `__DEV__`-gated.
11. **No medical claims.** All targets and estimates are informational. Guardrails in `src/domain/goals` (dangerous-goal block + aggressive-goal confirmation) must never be bypassed by UI code.
12. **New dependency = written justification** in the commit description; prefer well-maintained, Expo-compatible libraries and simple maintainable solutions over abstraction.
13. **i18n from day one.** No hardcoded user-facing strings; every key exists in both `en` and `el` (enforced by the parity test). Metric units only (abstracted in `src/domain/units`).

## Code conventions

- TypeScript **strict**; no `any` (use `unknown` + narrowing); no non-null assertions except tests.
- Naming: `snake_case` in SQL, `camelCase` in TS, `PascalCase` components/types.
- Layout per `docs/ARCHITECTURE.md` — routes in `src/app/` (thin), everything else under `src/`.
- Components: functional, typed props, no default exports (except Expo Router route files, which require them).
- Errors: typed errors from services/repositories; screens map them to localized messages; never swallowed.
- Dates: ISO-8601 UTC strings in the DB; diary days are local `'YYYY-MM-DD'` keys via `src/domain/dates`. IDs are UUIDv7 strings.
- Nutrients stored per **100 g/ml**; per-portion always derived; missing = NULL, never 0. Diary entries snapshot nutrients at log time.
- Commits: Conventional Commits, imperative mood.
- Lint/format: ESLint + Prettier, zero-warnings policy (`npm run lint`).

## Testing conventions

See `docs/TEST_STRATEGY.md`. Per milestone: domain logic table-driven and near-fully covered; repositories/migrations integration-tested against real SQLite (in-memory); at least one happy-path UI test per new screen flow; adapter mappers tested against recorded fixtures.

## Definition of done (any task)

- Code + tests + updated docs.
- `npm run typecheck && npm run lint && npm test` all green.
- New tables ship inside a migration with FKs/indexes and migration tests.
- User-facing strings exist in both `en` and `el`.
- Works offline (unless the feature is an explicitly optional online lookup).
- No TODOs without a linked roadmap item.
