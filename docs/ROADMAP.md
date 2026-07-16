# ROADMAP — CalorieTracker (working title)

Status: revised 2026-07-16 for the **local-first, single-user** decision: no Supabase, no authentication, no user accounts, no cloud sync, no subscriptions/payments, no mandatory backend. **SQLite on the device is the primary and authoritative database.** The app works fully offline, except when looking up a previously unknown barcode (and other explicitly optional online features).

**One milestone per task; scope changes require editing this file first.**

Cross-references: PRODUCT_SPEC (features), ARCHITECTURE, DATA_MODEL (SQLite schema), TEST_STRATEGY, API_AND_DATA_SOURCES.

---

## M1 — Project foundation & design system ✅ (committed `f4a98ff`)

Expo SDK 57 + TS strict + Expo Router; tokens/themes; i18n en/el; UI kit; 5-tab shell with honest placeholders; lib (logger) + domain/dates; ESLint/Jest/CI. 47 tests green.

## M2 — Local SQLite foundation ✅

**Scope:** expo-sqlite setup; database initialization on first launch; **versioned migrations** (PRAGMA `user_version`, ordered, transactional, tested); repository/service layer (typed CRUD, Zod-validated rows, no SQL outside `src/db` + repositories); tables: **profile, settings, foods, food_portions, diary_days, diary_entries, weight_records, water_records, scanned_products, barcode_scan_history**; `created_at`/`updated_at` where appropriate; foreign keys ON + indexes; **development-only seed data**; unit + integration tests for initialization, migrations, and repositories. No UI beyond existing placeholders.
**Files/modules:** `src/db/` (client, migration runner, `migrations/001_*.ts`…, `seed/dev.ts`), `src/repositories/*`, `src/schemas/*`, `src/types/*`.
**DB changes:** full M2 schema (DATA_MODEL §2).
**API changes:** none (no network in this milestone).
**Tests:** migration runner (fresh install; stepwise upgrades; failed migration rolls back); FK cascade behavior; CRUD round-trip per repository; seed idempotency + prod-guard; `PRAGMA foreign_keys` verified ON.
**Risks:** migration discipline from day one (getting `user_version` flow right); date/UUID conventions — reuse `domain/dates` and UUIDv7 strings.
**Acceptance criteria:**

1. First launch creates the DB and applies all migrations; relaunch is a no-op; `user_version` equals the latest migration number.
2. A deliberately failing test migration leaves the DB at the previous version (transaction rollback) with a typed error.
3. All ten tables exist with the FKs and indexes specified in DATA_MODEL; foreign key enforcement is ON in every connection.
4. Every table with mutable rows maintains `created_at`/`updated_at` automatically (repository layer).
5. Repositories expose typed CRUD for each aggregate; a screen importing SQL directly would fail lint/review; rows are Zod-parsed at the boundary.
6. Dev-only seeds populate sample Greek foods + one demo diary day **only** in `__DEV__` and only into an empty DB; production builds never seed.
7. Full offline: airplane-mode run of the entire suite of app flows (placeholders + DB init) works.
8. `typecheck`, `lint`, `test` green; DB integration tests run against real SQLite (in-memory) in CI.

**Depends on:** M1. **Feeds:** everything.

## M3 — Personal profile & calorie targets (local, no auth) ✅

**Scope:** onboarding + editable Profile section storing locally: age (stored as date of birth), biological sex or "prefer not to specify", height, current weight, target weight, activity level, goal type (lose/maintain/gain/build muscle), weekly target rate, calorie target, protein/carb/fat targets, metric units, language preference (el/en, already persisted — moves into settings table). Mifflin–St Jeor calculator + macro splits as pure domain functions; **guardrails** (block dangerous targets, confirm aggressive ones); manual override of computed targets within guardrails; disclaimers.
**Tests:** calculator matrix incl. "unspecified" sex averaging; guardrail boundaries; profile repository round-trips; onboarding flow component tests.
**Acceptance:** fresh install onboards to a computed, guarded calorie/macro target stored in SQLite; everything editable later from Profile; relaunch keeps data; no network involved.
**Depends on:** M2.

## M4 — Food diary ✅

**Scope:** Diary + Today tabs become real: meal sections (rename/reorder/hide), manual quick-entry (label + kcal ± macros), water, weight, mood, daily notes, manual exercise & steps; edit/delete/undo; copy meal/day; past & future dates; consumed/burned/remaining/target header using M3 targets; per-weekday target overrides.
**DB changes:** migration 003 adds localized `meal_sections`, `exercise_logs`, and `steps_logs`; rebuilds `diary_entries` with a meal-section FK while preserving M2/M3 rows; adds day/section, origin/external-UID, and ordering indexes.
**Tests:** pure totals and weekday-target resolution; M3→M4 data-preserving migration; section/activity/steps/copy/tombstone repository integration; manual quick-add component flow.
**Acceptance:** full diary usable offline; totals correct; undo works; copy works; history navigable.
**Depends on:** M2, M3.

## M5 — Food database & search ✅

**Scope:** foods catalog UX: local text search (Greek + English, accent-insensitive) over seeded Greek food DB + user's custom foods; food detail (per-100 g/ml and per-portion, source & quality badges); custom foods CRUD; portions (g, ml, serving, piece, tsp, tbsp); favorites & recents; meal templates ("My meals"); nutrient snapshot into diary entries. Optional **online text search via Open Food Facts** (no key, results cached into `foods`), clearly separated from local results and fully skippable offline. Greek seed DB grows to ~150 foods (production seed, not dev-only).
**DB changes:** migration 004 adds normalized search keys, 150 bilingual production foods and portions, `food_overrides`, `food_favorites`, `food_recents`, `meal_templates`, and `meal_template_items`.
**Tests:** accent normalization and portion math; M4→M5 migration/catalog coverage; search/favorite/recent/override/template repositories; OFF fixture mapping and cache contract; offline `γιγαντες` search-to-diary component flow.
**Acceptance:** find & log γίγαντες (local) offline; optional OFF search works online and caches; corrections stored as user overrides; templates loggable offline.
**Depends on:** M4.

## M6 — Barcode scanning ✅

**Scope:** camera barcode scan (dev build required) → local lookup first (`foods.barcode`, `scanned_products`) → if unknown and online, OFF barcode lookup → normalized, cached into `foods` + `scanned_products`; `barcode_scan_history` records every scan (found/not_found/offline); not-found flow creates a custom food with the barcode attached; manual barcode entry fallback.
**DB changes:** no new migration; M6 activates the `scanned_products` and `barcode_scan_history` tables and indexes that shipped in the M2 core schema.
**Implementation:** `expo-camera` is isolated behind the barcode-scanner adapter; EAN-8/EAN-13/UPC-A/UPC-E values normalize and checksum-validate into GTIN-13; lookups time out before 10 seconds; camera permission is requested only after an explicit action.
**Tests:** table-driven GTIN normalization/check digits; real-SQLite local/online/cache/not-found/offline orchestration; OFF v3 barcode fixtures; offline manual-barcode-to-diary and scan-history component flow.
**Acceptance:** known barcode resolves **offline**; unknown barcode resolves online in <10 s and is cached; history screen lists scans; airplane-mode scan of unknown barcode explains gracefully.
**Depends on:** M5.

## M7 — Progress & charts ✅

Weight (trend line), calories vs target, water, steps, macros; weekly/monthly averages; recorded/calculated/estimated labeling; textual summaries; 2-year performance via SQL aggregates on SQLite; chart library final pick.
**Depends on:** M4 (M3 targets).

## M8 — Recipes & grocery lists

Recipe CRUD + seeded original recipes; per-serving nutrition from ingredients; dietary/allergy filters; favorites; log servings to diary; grocery lists with unit-aware combining. All local.
**Depends on:** M5.

## M9 — Meal planning

Weekly planner (day × meal slot), one-tap add to diary, grocery list from plan, copy week. All local.
**Depends on:** M8.

## M10 — Intermittent fasting & mood polish

Fasting plans (12:12…20:4, 5:2, ADF, custom), timer, local notifications, history, streaks, safety info; mood tags + trends. All local.
**Depends on:** M4.

## M11 — HealthKit & Health Connect (optional integrations)

Read-only steps/workouts/weight behind `HealthDataProvider`; per-type OS permissions; dedup vs manual entries. Free Apple ID personal team suffices for dev builds. No cloud involved — platform data stays on device.
**Depends on:** M4.

## M12 — AI meal-photo logging (OPTIONAL feature)

Photograph a meal → vision model → editable itemized estimate with confidence → confirm to diary. **Requires a user-supplied API key** (OpenAI or Gemini), entered at runtime in settings and stored in expo-secure-store; feature is hidden/disabled without a key; images sent directly to the chosen provider over TLS, never stored unless the user opts in. Not scheduled until the user wants it — no key is requested before this milestone, and it can be skipped entirely.
**Depends on:** M5.

## M13 — Data export, backup & data management

CSV + JSON export of all data via the OS share sheet; **full database backup/restore** (copy/restore the SQLite file); complete data wipe (two-step confirmation); storage usage view. This replaces the old cloud "account deletion/export" scope.
**Depends on:** M2+ (export coverage grows with schema; test derives table list from schema).

## M14 — Performance, accessibility & personal release builds

Perf pass (startup, diary latency, chart perf with 2-year data); full VoiceOver/TalkBack + dynamic type 130% sweep; Greek copy review; dependency audit; stable personal builds (iOS sideload via free personal team — 7-day re-sign; Android release APK installed directly).
**Depends on:** all.

---

## Dependency graph

M1 → M2 → M3 → M4 → {M5, M7, M10, M11} ; M5 → {M6, M8, M12*} ; M8 → M9 ; {M2..} → M13 → M14. (*M12 optional, user-triggered.)

## Deferred decisions

| Decision                                                    | Decide at                                      |
| ----------------------------------------------------------- | ---------------------------------------------- |
| App name & final branding/icon                              | ≤M14                                           |
| Chart library                                               | Decided M7: focused native SVG charts          |
| Vision provider + whether M12 happens at all                | M12 (user's call)                              |
| Health module libraries                                     | M11 spike                                      |
| SQLCipher (encrypted DB)                                    | post-M14 if desired                            |
| USDA FoodData Central as an extra source (needs a free key) | only if local+OFF coverage proves insufficient |

## Explicitly out of scope (permanent, per user decision)

User accounts, authentication, Supabase or any backend, cloud sync, subscriptions, payments, ads, third-party analytics/telemetry, store distribution.
