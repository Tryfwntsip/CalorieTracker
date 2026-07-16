# TEST_STRATEGY — CalorieTracker (working title)

Status: Phase 1. Binding minimums; every milestone's acceptance criteria include its test deliverables.

## 1. Principles

- Test the **domain hardest**: calorie/macro math, guardrails, nutrient normalization, food score, unit conversions, fasting/streak logic, dedup, grocery combining — all pure functions, all table-driven.
- Tests are deterministic: time, locale, and randomness injected; no network in unit/integration tests (recorded fixtures for providers).
- A feature without tests is not done (AGENTS.md definition of done).

## 2. Layers & tools

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit (domain) | Jest (jest-expo preset) | `src/domain/**` pure logic | every commit, CI |
| Component/UI | Jest + React Native Testing Library | components render/interact; screens with mocked services | every commit, CI |
| Repository/integration | Jest against **local Supabase** (supabase CLI) + in-memory SQLite | repositories, sync engine, migrations | CI (job with supabase start) |
| RLS/SQL | pgTAP-style SQL tests in `supabase/tests/` (two test users) | every table's policies; cross-user access must fail | CI |
| Edge Functions | Deno test w/ mocked providers + Zod contract tests | food-gateway mapping, vision-analyze consent logic, export/delete | CI |
| Contract/fixtures | Recorded real responses (OFF, USDA, vision) checked into `src/test/fixtures` | mapper correctness against real payload shapes; refreshed deliberately, diff-reviewed | CI |
| E2E | Maestro flows on dev builds | critical journeys (below) | nightly / pre-release |
| Manual | Checklists | accessibility, notification tone, localization review | per milestone / release |

## 3. Critical E2E journeys (Maestro)

1. Onboard → get target → land on Today.
2. Search food → log to Lunch → totals update → undo works.
3. Airplane mode → log food + water + weight → relaunch → data present → go online → syncs (verified via second session/db check).
4. Barcode scan (test barcode) → confirm → logged.
5. Create recipe → plan it → add to diary → grocery list generated.
6. Start 16:8 fast → notification scheduled → stop → history entry.
7. Photo log (fixture image, mocked provider in staging) → edit item → confirm → logged with `logged_via='photo'`.
8. Export data → receive bundle; delete account → sign-in fails, data gone (staging).

## 4. Domain test specifics (table-driven, documented expected values)

- **Energy/macros:** Mifflin–St Jeor across sex/age/height/weight matrix incl. 'unspecified' averaging; activity multipliers; weekly-rate→daily delta; macro splits & protein floor; weekday overrides resolution.
- **Guardrails:** boundary tests at 1,199/1,200/1,500 kcal; 1.5% weekly loss; BMI 17/18.5 goal edges; confirmation-required band.
- **Food score:** reference table of ~20 foods (e.g. lentils, olive oil, feta, soft drink, whole bread) with hand-computed expected scores and top factors; monotonicity tests (more fiber never lowers score, ceteris paribus); "not enough data" cases.
- **Nutrient normalization:** per-provider mapper fixtures incl. kJ-only products, sodium↔salt, missing→null (never 0), per-serving→per-100g conversion.
- **Units/portions:** g/ml/serving/piece/tsp/tbsp round-trips; liquid vs solid.
- **Sync engine:** outbox drain ordering, LWW conflicts, tombstone propagation, retry/backoff, offline accumulation (SQLite in-memory + mocked remote).
- **Dedup (health):** same-day steps from two origins; overlapping workouts; external_uid uniqueness.
- **Grocery combining:** same food different units; label-normalized merging; checked-state preservation on regeneration.
- **Fasting:** window computation across midnight & DST; streak rules; 5:2 target interaction.
- **Dates:** device-timezone diary-day keying, DST transitions, future logging.

## 5. Coverage & gates

- CI gates every PR/commit: `typecheck`, `lint` (zero warnings), unit+component+integration suites, RLS tests, function tests, secret scan (gitleaks), `npm audit` (high+ fails).
- Coverage thresholds: `src/domain` ≥ 90% branches; repositories/services ≥ 80% lines; no global vanity threshold on UI.
- Nightly: E2E Maestro on EAS dev builds (both platforms when feasible; Android emulator minimum).

## 6. Test data & environments

- Local: `supabase start` (Docker) + seeded fixtures; deterministic seed users (`test-a@`, `test-b@` for RLS pairs).
- Staging Supabase project (separate from prod) once M2 lands; E2E and export/deletion drills run there — never on prod.
- Fixtures for foods use the Greek seed DB + frozen OFF/USDA payloads; vision fixtures are fixed images with recorded provider responses.

## 7. Non-functional checks

- Performance: startup + diary-interaction timing measured in M14 (and spot-checked from M3) on a mid-range Android device profile; chart rendering with 2 years of synthetic data.
- Accessibility: automated a11y label lint + manual VoiceOver/TalkBack pass per milestone touching UI; dynamic-type 130% screenshot review.
- Localization: pseudo-locale check for truncation; native review of Greek copy before release.
