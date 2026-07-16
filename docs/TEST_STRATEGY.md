# TEST_STRATEGY — CalorieTracker (working title)

Status: Phase 1. Binding minimums; every milestone's acceptance criteria include its test deliverables.

## 1. Principles

- Test the **domain hardest**: calorie/macro math, guardrails, nutrient normalization, food score, unit conversions, fasting/streak logic, dedup, grocery combining — all pure functions, all table-driven.
- Tests are deterministic: time, locale, and randomness injected; no network in unit/integration tests (recorded fixtures for providers).
- A feature without tests is not done (AGENTS.md definition of done).

## 2. Layers & tools

| Layer             | Tool                                                                   | Scope                                                                                                                                  | Runs                    |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Unit (domain)     | Jest (jest-expo preset)                                                | `src/domain/**` pure logic                                                                                                             | every commit, CI        |
| Component/UI      | Jest + React Native Testing Library                                    | components render/interact; screens with mocked services                                                                               | every commit, CI        |
| DB/integration    | Jest against **real SQLite (in-memory)**                               | migration runner (fresh install, stepwise upgrades, rollback on failure), FK enforcement, CRUD round-trips per repository, seed guards | every commit, CI        |
| Contract/fixtures | Recorded real responses (OFF, vision) checked into `src/test/fixtures` | adapter mapper correctness against real payload shapes; refreshed deliberately, diff-reviewed                                          | CI                      |
| E2E               | Maestro flows on dev builds                                            | critical journeys (below)                                                                                                              | nightly / pre-release   |
| Manual            | Checklists                                                             | accessibility, notification tone, localization review                                                                                  | per milestone / release |

## 3. Critical E2E journeys (Maestro)

1. Onboard → get target → land on Today.
2. Search food → log to Lunch → totals update → undo works.
3. Airplane mode → log food + water + weight → relaunch → all data present (SQLite is authoritative; nothing depends on network).
4. Barcode scan (test barcode) → confirm → logged.
5. Create recipe → plan it → add to diary → grocery list generated.
6. Start 16:8 fast → notification scheduled → stop → history entry.
7. (If M12 enabled) Photo log with mocked provider → edit item → confirm → logged with `logged_via='photo'`.
8. Export data → CSV/JSON bundle shared; full data wipe → relaunch shows a fresh, empty app.

## 4. Domain test specifics (table-driven, documented expected values)

- **Energy/macros:** Mifflin–St Jeor across sex/age/height/weight matrix incl. 'unspecified' averaging; activity multipliers; weekly-rate→daily delta; macro splits & protein floor; weekday overrides resolution.
- **Guardrails:** boundary tests at 1,199/1,200/1,500 kcal; 1.5% weekly loss; BMI 17/18.5 goal edges; confirmation-required band.
- **Profile persistence:** M2→M3 migration snapshots existing goals; create/update appends versions transactionally; service tests prove UI confirmation cannot bypass blocked targets.
- **Diary:** consumed/burned/remaining and macro totals ignore tombstones; weekday overrides resolve by local day key; M3→M4 migration preserves entries; copy, soft-delete/restore, meal-section changes, exercise, and steps use real SQLite integration tests.
- **Food catalog:** English/Greek accent normalization; per-portion snapshot scaling; 150-row production seed; favorites/recents/overrides/templates on real SQLite; offline Greek search-to-log UI flow; OFF mapper fixtures including kJ-only energy, sodium conversion, missing→null, and invalid responses.
- **Barcode:** GTIN check digits plus EAN-8/EAN-13/UPC-A/UPC-E normalization; local-first and cache-through orchestration against real SQLite; found/not-found/offline history; OFF v3 fixture mapping; offline manual-barcode-to-diary UI flow.
- **Food score:** reference table of ~20 foods (e.g. lentils, olive oil, feta, soft drink, whole bread) with hand-computed expected scores and top factors; monotonicity tests (more fiber never lowers score, ceteris paribus); "not enough data" cases.
- **Nutrient normalization:** per-provider mapper fixtures incl. kJ-only products, sodium↔salt, missing→null (never 0), per-serving→per-100g conversion.
- **Units/portions:** g/ml/serving/piece/tsp/tbsp round-trips; liquid vs solid.
- **Migrations:** fresh install → latest; stepwise upgrade from every released version; failed migration rolls back and preserves `user_version`; idempotent re-run; FK enforcement ON.
- **Dedup (health):** same-day steps from two origins; overlapping workouts; external_uid uniqueness.
- **Grocery combining:** same food different units; label-normalized merging; checked-state preservation on regeneration.
- **Fasting:** window computation across midnight & DST; streak rules; 5:2 target interaction.
- **Dates:** device-timezone diary-day keying, DST transitions, future logging.

## 5. Coverage & gates

- CI gates every PR/commit: `typecheck`, `lint` (zero warnings), unit+component+DB-integration suites, secret scan (gitleaks — expected secret count is zero), `npm audit` (high+ fails).
- Coverage thresholds: `src/domain` ≥ 90% branches; repositories/services ≥ 80% lines; no global vanity threshold on UI.
- Nightly: E2E Maestro on EAS dev builds (both platforms when feasible; Android emulator minimum).

## 6. Test data & environments

- Everything runs locally — there is no backend and no staging environment. DB tests use in-memory SQLite with the real migration set; E2E runs on dev builds with a fresh app install.
- Production uses `expo-sqlite`; Node-based Jest integration tests use the genuine built-in `node:sqlite` engine through the same async database contract. No simplified SQLite mock is accepted.
- Fixtures for foods use the Greek seed DB + frozen OFF payloads; vision fixtures (M12) are fixed images with recorded provider responses.

## 7. Non-functional checks

- Performance: startup + diary-interaction timing measured in M14 (and spot-checked from M3) on a mid-range Android device profile; chart rendering with 2 years of synthetic data.
- Progress (M7): table-driven EMA, linear weekly-rate, target-override, and
  logged-day-average tests; real-SQLite aggregate coverage verifies tombstone
  exclusion and daily water/steps semantics; the Progress screen has a
  provider-backed happy-path render test.
- Recipes and groceries (M8): real-SQLite migration/seed and repository CRUD,
  favorite/cascade behavior, table-driven per-serving nutrition with unknown
  preservation, dietary/allergen filtering, unit-aware grocery combining, and a
  seeded-recipe → diary + grocery-list UI journey.
- Meal planning (M9): deterministic Monday/week shifting, SQLite XOR and
  slot-replacement constraints, transactional copy-week behavior, and a complete
  planned recipe → diary → combined groceries → copied week UI journey.
- Fasting and mood (M10): absolute-time windows across midnight/DST, clamped timer
  progress, completion streaks, 5:2/alternate-day safety-floor target integration,
  one-active-plan/session constraints, Zod validation, mood-tag aggregation, and a
  plan → timer → saved-history UI journey.
- Accessibility: automated a11y label lint + manual VoiceOver/TalkBack pass per milestone touching UI; dynamic-type 130% screenshot review.
- Localization: pseudo-locale check for truncation; native review of Greek copy before release.
