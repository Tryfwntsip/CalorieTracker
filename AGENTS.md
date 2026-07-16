# AGENTS.md — Permanent Project Conventions

Working title: **CalorieTracker** (final product name TBD — see docs/ROADMAP.md deferred decisions).
This file is the contract for every agent/developer session. Read it before touching code.
The original product brief lives at `PlanCaloriesReadFirst.txt` in this folder's parent history; the normative spec is `docs/PRODUCT_SPEC.md`.

## What this product is

An original, cross-platform (iOS + Android) nutrition and lifestyle tracking app: food diary, calorie/macro goals, food search (Open Food Facts, USDA FDC, local Greek DB), barcode scanning, AI meal-photo estimation, an original transparent food-quality score, recipes + meal planning + grocery lists, intermittent fasting, HealthKit/Health Connect, progress analytics, notifications, and strong privacy controls. Greek + English, metric units, dark/light themes, offline-friendly diary. All features unlocked; no ads or paywall in early stages.

It is **not** a YAZIO clone. Never copy any proprietary app's name, branding, text, recipes, database, scoring algorithm, or exact layouts.

## Hard rules

1. **One milestone at a time.** Scope is defined in `docs/ROADMAP.md`. Do not start milestone N+1 work inside milestone N. Do not implement the entire app in a single task.
2. **Docs are load-bearing.** If an architectural decision changes, update the relevant doc in the same change. Never silently diverge from `docs/ARCHITECTURE.md`.
3. **No secrets in the repo.** Only `EXPO_PUBLIC_*` values (Supabase URL, anon key) may reach the client. Provider API keys (USDA, AI vision) live only in Supabase Edge Function secrets. `.env` is gitignored; keep `.env.example` current.
4. **RLS on every table** that holds user data, enabled in the same migration that creates the table. Schema changes happen **only** via migrations in `supabase/migrations/` — never by hand in the dashboard.
5. **Business logic outside UI components.** Screens and components render and dispatch; calculations, rules, and data access live in `src/domain`, `src/services`, `src/repositories`.
6. **Deterministic, tested calculations.** Calorie/macro targets, nutrient math, the food score, and unit conversions are pure functions in `src/domain` with unit tests. No `Date.now()`/randomness inside them — pass time in.
7. **Zod at every boundary.** All external input (API responses, deep links, storage reads, form submissions) is parsed with a Zod schema before it enters the domain.
8. **Adapters for every external system** (food data providers, AI vision, health platforms, barcode). Code against the interface in `src/services/<area>/types.ts`; providers must be swappable.
9. **No fake UI.** Anything non-functional must be visibly marked (e.g. a `ComingSoon` component), never a dead button. No mock data on production paths — mocks live only in tests/fixtures.
10. **No medical claims.** All targets and estimates are informational. Safety guardrails in `src/domain/goals` (dangerous-goal floor + aggressive-goal confirmation) must never be bypassed by UI code.
11. **New dependency = written justification** in the PR/commit description, and prefer well-maintained, Expo-compatible libraries. Prefer simple maintainable solutions over abstraction.
12. **i18n from day one.** No hardcoded user-facing strings; every string is a key with `en` and `el` translations. Metric units only for now (unit system is abstracted in `src/domain/units`).

## Code conventions

- TypeScript **strict**; no `any` (use `unknown` + narrowing), no non-null assertions except in tests.
- Naming: `snake_case` in SQL/DB, `camelCase` in TS, `PascalCase` for components/types, kebab-case for file names except components.
- Folder layout is defined in `docs/ARCHITECTURE.md` — routes in `app/`, everything else in `src/`.
- Components: functional, typed props, no default exports (exception: Expo Router route files require default exports).
- Errors: throw typed errors from services; screens map them to user-friendly, localized messages. Never swallow errors silently.
- Dates: store UTC ISO-8601 in DB; diary days are keyed by local calendar date string (`YYYY-MM-DD`) computed at the device. Use a single date utility module.
- Money/none, but nutrients: store per **100 g/ml** canonical values; per-portion values are always derived, never stored on the food.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`), imperative mood.
- Lint/format: ESLint + Prettier, zero warnings policy in CI.

## Testing conventions

See `docs/TEST_STRATEGY.md`. Minimum bar per milestone: domain logic 100% branch-covered where practical, repositories integration-tested against local Supabase, at least one happy-path UI test per new screen flow. The food score and goal calculators must have table-driven tests with documented expected values.

## Definition of done (any task)

- Code + tests + updated docs + updated `.env.example` if config changed.
- `npm run typecheck && npm run lint && npm test` all green.
- New tables have RLS policies and are covered by an RLS test.
- User-facing strings exist in both `en` and `el`.
- No TODOs without a linked roadmap item.
