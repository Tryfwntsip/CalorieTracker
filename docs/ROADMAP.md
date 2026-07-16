# ROADMAP — CalorieTracker (working title)

Status: Phase 1. 14 milestones, each independently testable and shippable to internal builds. **One milestone per task; scope changes require editing this file first.**

Cross-references: PRODUCT_SPEC (features Fx), ARCHITECTURE, DATA_MODEL (tables per milestone), TEST_STRATEGY, API_AND_DATA_SOURCES.

Milestone template fields: Scope · Files/Modules · DB changes · API changes · Tests · Risks · Acceptance criteria · Depends on / feeds.

---

## M1 — Project foundation & design system

**Scope:** Expo app scaffold (TS strict, Expo Router, dev-build config), repo tooling (ESLint, Prettier, Jest+RNTL, CI), i18n (en/el) wiring, light/dark themes, design tokens, core UI component kit, 5-tab navigation shell with honest placeholder screens (marked "coming soon"), `src` layering skeleton, `.env.example`, README. **No Supabase yet.**
**Files/modules:** `app/(tabs)/*`, `src/ui/tokens/*`, `src/ui/theme/*`, `src/ui/components/*` (Button, Card, ListRow, Input, Sheet, Skeleton, EmptyState, ErrorState, ProgressRing, StatBar), `src/lib/{i18n,env,logger}.ts`, `src/domain/dates/`, `.github/workflows/ci.yml`, `e2e/` scaffold.
**DB changes:** none.
**API changes:** none.
**Tests:** component tests for kit; token snapshot tests; i18n key-completeness test (en=el key parity); dates module unit tests; CI green.
**Risks:** over-building the design system → cap kit to listed components; Expo SDK version churn → pin SDK.
**Acceptance:** app runs on iOS+Android dev builds; theme + language switch live in a placeholder Profile screen; all CI gates pass; zero hardcoded strings.
**Depends on:** —. **Feeds:** everything.

## M2 — Authentication & profile

**Scope:** Supabase project setup + local dev (`supabase start`); email+password auth (sign-up, verification, sign-in, reset, sign-out) with secure session storage; `profiles`, `user_settings`, `consents`, `audit_events` tables; Profile tab (account info, language, theme, disclaimers/about); auth routing guards. Apple/Google **architecture** honored (no username coupling) but not enabled.
**Files/modules:** `app/(auth)/*`, `src/features/auth/`, `src/features/profile/`, `src/repositories/{profile,settings,consent}.ts`, `src/lib/supabase.ts`, `supabase/migrations/0001_*`, `supabase/tests/`.
**DB:** DATA_MODEL §2 (profiles, user_settings) + §9 (consents, audit_events) with RLS.
**API:** none external.
**Tests:** auth flow component tests (mocked supabase); repository integration tests vs local Supabase; **RLS pair tests**; audit event on signup/login.
**Risks:** deep-link email verification/reset on both platforms — test early on devices.
**Acceptance:** full email auth round-trip works on device; cross-user RLS tests fail correctly; session survives app restart; sign-out wipes local state.
**Depends on:** M1. **Feeds:** all user-data milestones.

## M3 — Manual food diary (offline-first core)

**Scope:** Diary tab: date navigation, meal sections (default set; rename/reorder/hide), **manual quick-entry** (label + kcal ± macros), water, weight, mood, notes, exercise & steps manual entries; edit/delete/undo; copy meal/day from another date; future-date logging; Today tab header (consumed/burned/remaining vs a placeholder static target until M4). **SQLite local-first store + outbox sync engine** — the architectural heart of the app.
**Files/modules:** `src/features/diary/`, `src/features/today/` (v1), `src/repositories/diary*.ts`, `src/services/sync/`, `src/lib/sqlite/` (+migrations), `supabase/migrations/000x` for §5 log tables.
**DB:** DATA_MODEL §5: diary_meal_sections, diary_entries (snapshot columns), water/weight/mood/exercise/steps logs, diary_notes — server + SQLite mirror + outbox.
**API:** none external.
**Tests:** sync engine suite (offline accumulation, LWW, tombstones); SQLite migration tests; diary component tests; E2E journey #3 (airplane mode); RLS tests for new tables.
**Risks:** **highest-risk milestone** (sync correctness) — keep LWW simple, write the test suite first; UUIDv7 generation lib choice.
**Acceptance:** full diary usable with airplane mode on; relaunch-safe; syncs when online; undo works; copy-from-date works; totals correct.
**Depends on:** M2. **Feeds:** M4–M12 all write through this layer.

## M4 — Goals & calorie calculations

**Scope:** Onboarding flow (all PRODUCT_SPEC §4 inputs, skippable design, disclaimers); Mifflin–St Jeor engine + macro splits; **guardrails (block/confirm)**; goals versioning; per-weekday calorie overrides; Today/Diary headers use real targets; goal editing in Profile.
**Files/modules:** `app/(onboarding)/*`, `src/domain/goals/` (calculator, guardrails, macro-split), `src/features/onboarding/`, `src/repositories/goals.ts`, migration for `goals`, `user_allergies`.
**DB:** §2 goals + user_allergies (RLS).
**API:** none.
**Tests:** the full domain matrix (TEST_STRATEGY §4 energy/guardrails); onboarding component tests; goal-history resolution tests (past days keep old target).
**Risks:** guardrail UX (blocking without judgment) — copy review; 'unspecified sex' equation choice documented.
**Acceptance:** new user onboards to a computed, guarded target; dangerous goals blocked with supportive copy; weekday overrides reflected in Diary; historical days pin their era's target.
**Depends on:** M2 (M3 for header integration). **Feeds:** M7 analytics, M10 (5:2).

## M5 — Food database & search

**Scope:** `foods` catalog + canonical nutrient model; `food-gateway` Edge Function (text search: Greek DB → OFF → USDA; getById; caching; provenance; rate limits); food search UI (search, recents, favorites); food detail screen (per-100g + per-portion, nutrient panel, source attribution, quality badge); custom foods; user overrides; **meal templates**; portion system; `food_cache` for offline; Greek seed DB v1 (~150 foods).
**Files/modules:** `src/features/food-search/`, `src/features/food-detail/`, `src/domain/nutrition/` (portion math, nutrient ops), `src/domain/schemas/nutrients.ts`, `src/services/food-data/`, `src/repositories/{foods,favorites,recents,templates}.ts`, `supabase/functions/food-gateway/` (+mappings), `supabase/seed/greek_foods.ts`, migrations §3.
**DB:** §3 tables (foods, food_portions, food_overrides, favorites, recents, meal_templates+items) with RLS split global/user rows.
**API:** OFF + USDA live behind gateway (USDA key as function secret); gateway client contract per API_AND_DATA_SOURCES §6.
**Tests:** mapper fixture tests (OFF/USDA); gateway Deno tests; portion math table tests; search UI tests; offline log-from-cache test; RLS catalog policy tests.
**Risks:** OFF data quality for Greek products (partial rows) — quality badges + easy source switching; search relevance mixing three sources — simple deterministic ranking v1 (exact > prefix > fuzzy; Greek DB boosted for el locale).
**Acceptance:** find & log γίγαντες (Greek DB), Nutella (OFF), chicken breast (USDA); provenance visible; correction flow stores override without touching original; favorites/recents/templates loggable offline.
**Depends on:** M3. **Feeds:** M6, M8, M12.

## M6 — Barcode scanning

**Scope:** Barcode scan flow (camera permission, scanner UI, torch, haptics, manual barcode fallback) → gateway barcode op → confirm/portion screen → diary; not-found flow → create custom food with barcode attached; offline: previously scanned barcodes resolve from cache.
**Files/modules:** `src/services/barcode/`, `app/(modals)/barcode.tsx`, `src/features/barcode/`; gateway `barcode` op (already stubbed in M5 contract).
**DB:** none new (foods.barcode index exists).
**API:** OFF barcode lookup via gateway.
**Tests:** scanner wrapper unit tests (mocked camera); barcode-op fixture tests; E2E journey #4; not-found path test.
**Risks:** camera module requires dev build — already assumed; EAN-8/UPC variants — normalize to GTIN-13 in one function (tested).
**Acceptance:** scan a real Greek supermarket product → logged in <10 s; unknown barcode offers custom-food creation; manual entry fallback works.
**Depends on:** M5. **Feeds:** —.

## M7 — Weight, water & progress charts

**Scope:** Progress tab v1: weight chart with 7-day EMA trend + goal line, calories vs target, water, steps, macro distribution; weekly/monthly averages; recorded/calculated/estimated labeling; textual summaries for accessibility; `daily_summary` aggregation (finalize mechanism); chart library final pick (D6); 2-year synthetic-data performance check.
**Files/modules:** `src/features/progress/`, `src/domain/analytics/` (EMA, adherence, aggregation shapes), `src/ui/components/charts/*`, migration/view for daily_summary.
**DB:** daily_summary view/materialization (§12).
**API:** none.
**Tests:** analytics domain tests (EMA, averages, adherence band); chart component render tests; perf harness with 730 days synthetic data.
**Risks:** chart perf on low-end Android → this milestone exists to settle it early with real measurements.
**Acceptance:** charts render 2 years smoothly; trend/goal lines correct per fixtures; every value labeled; summaries readable by screen reader.
**Depends on:** M3, M4. **Feeds:** M11 (more series), M13 export shapes.

## M8 — Recipes & grocery lists

**Scope:** Recipe model + editor (ingredients from food search, steps, times, tags, allergens, image); per-serving nutrition auto-computed; catalog browsing of ~25 seeded original recipes; dietary/allergy filters (user allergens auto-excluded); favorites; log recipe servings to diary; grocery lists: manual lists + generate-from-recipes, unit-aware combining, check-off.
**Files/modules:** `src/features/recipes/`, `src/features/grocery/`, `src/domain/recipes/` (nutrition rollup, scaling), `src/domain/grocery/` (combining), `src/repositories/{recipes,grocery}.ts`, migrations §6 (recipes, ingredients, favorites, grocery_lists/items), seed recipes, storage bucket `recipe-images`.
**DB:** §6 minus meal_plans; storage policies.
**API:** none external.
**Tests:** nutrition rollup & scaling tables; combining rules suite; allergy filter tests; recipe editor component tests; RLS (catalog vs own recipes).
**Risks:** ingredient-unit combining edge cases — keep rule table explicit and tested; recipe images (size/permissions) — reuse M2 storage patterns.
**Acceptance:** create recipe → correct per-serving macros; browse/filter seeded recipes (allergens respected); log 1.5 servings; grocery list from 3 recipes merges duplicates correctly.
**Depends on:** M5. **Feeds:** M9.

## M9 — Meal planning

**Scope:** Plans tab: weekly planner grid (day × meal slot), assign recipes/foods/templates, servings; one-tap add-planned-to-diary (and bulk "add day"); generate grocery list from plan date-range; copy week; plan-aware diary hint ("planned: …").
**Files/modules:** `src/features/planner/`, `src/repositories/plans.ts`, `src/domain/planner/`, migrations meal_plans + meal_plan_entries.
**DB:** §6 meal_plans, meal_plan_entries.
**API:** none.
**Tests:** planner domain tests (week keys, copy semantics, XOR target constraint); E2E journey #5 end-to-end (recipe→plan→diary→groceries); component tests.
**Risks:** planner UI density on small screens — one-handed layout review; scope creep toward auto-planning (explicit non-goal now).
**Acceptance:** plan a full week, push Tuesday to diary in one tap, grocery list generated for the week, week copied forward.
**Depends on:** M8. **Feeds:** —.

## M10 — Fasting & mood tracking polish

**Scope:** Fasting: plans (all PRODUCT_SPEC §12 kinds incl. custom windows), timer UI with phase ring, start/stop/retro-adjust, local notifications (start/end), history, streaks, notes, safety info screen; 5:2/ADF integration with weekday calorie targets. Mood: upgrade M3 mood to tags + trends hook for M11.
**Files/modules:** `src/features/fasting/`, `src/domain/fasting/` (windows, streaks, DST-safe), `src/services/notifications/` (v1 scheduler), `src/repositories/fasting.ts`, migrations §7.
**DB:** §7 fasting_plans, fasting_sessions (local-first).
**API:** none.
**Tests:** window/streak suite incl. midnight & DST; notification scheduling reconciliation tests (mocked expo-notifications); E2E journey #6.
**Risks:** DST/timezone math — dedicated test vectors; notification reliability differences Android/iOS — document behavior.
**Acceptance:** 16:8 fast runs with live timer + notifications; history & streaks correct; custom schedule works; 5:2 day shows reduced target.
**Depends on:** M3 (M4 for 5:2 targets). **Feeds:** M11 analytics series.

## M11 — HealthKit & Health Connect

**Scope:** `HealthDataProvider` + both adapters (final lib picks); per-type consent UI + platform permission flows; import steps/workouts/weight with **dedup** (DATA_MODEL §5 rules); origin labeling in diary; Progress gains fasting/mood/exercise/steps series from all origins; background-ish refresh on app open.
**Files/modules:** `src/services/health/` (+2 adapters), `src/features/health-settings/`, dedup logic in `src/domain/activity/`.
**DB:** none new (origin/external_uid already modeled).
**API:** HealthKit + Health Connect (device APIs); Apple entitlement required.
**Tests:** dedup suite (both-origins matrices); adapter contract tests with mocked native modules; consent-gating tests; manual device test checklist.
**Risks:** native module maturity/Expo compatibility — spike first, pick then; HealthKit needs Apple dev account + real devices; Health Connect availability variance by OS.
**Acceptance:** enabling steps import shows platform steps in Diary/Today without double-count vs manual; workouts imported once; disabling stops imports; per-type consent recorded.
**Depends on:** M3, M2; Apple dev account. **Feeds:** —.

## M12 — AI photo logging

**Scope:** `vision-analyze` Edge Function (provider chosen here: OpenAI vs Gemini eval on Greek dishes; env-swappable); photo capture/pick → EXIF strip → downscale → upload → analysis → **editable review screen** (items, portions, confidence, estimate labeling) → confirm → diary entries (`logged_via='photo'`); consent gates + image retention setting; quotas; graceful failure → manual entry.
**Files/modules:** `supabase/functions/vision-analyze/`, `src/services/vision/`, `src/features/photo-log/`, migrations §8 (photo_analyses, meal-photos bucket + policies), cleanup job.
**DB:** §8.
**API:** vision provider (key as function secret).
**Tests:** function tests (consent enforcement, schema validation, image deletion); review-screen component tests (edit/confirm paths); E2E journey #7 with mocked provider; quota tests.
**Risks:** estimation quality on mixed Greek plates — confidence UI + mandatory user confirmation is the mitigation; cost — quotas + downscaling; provider API drift — Zod contract + versioned prompts.
**Acceptance:** photo of a plate → editable itemized estimate with confidence → confirmed entries in diary; image deleted unless retention consent; no consent → feature explains and disables.
**Depends on:** M5, M3; vision API key. **Feeds:** —.

## M13 — Export, deletion & privacy controls

**Scope:** `export-data` function (full CSV+JSON bundle, signed URL, expiry) + Profile UI; `delete-account` function + two-step in-app deletion; consent management screen (all consents, versioned re-prompt); privacy settings (image retention, analytics opt-in); Apple & Google **sign-in enabled**; audit events completed; privacy policy screens (en/el).
**Files/modules:** `supabase/functions/{export-data,delete-account}/`, `src/features/privacy/`, auth provider config, migrations §9 export_jobs, notification_prefs if not yet.
**DB:** export_jobs; storage bucket `exports`.
**API:** Apple/Google OAuth (needs Apple dev account, Google Cloud OAuth config).
**Tests:** export completeness test (every user table represented); deletion drill test on staging (E2E journey #8); consent-version re-prompt tests; social-auth smoke tests.
**Risks:** Apple sign-in review requirements; export completeness drifting as schema grows — test derives table list from schema.
**Acceptance:** user exports everything they own; deletes account irreversibly (verified); signs in with Apple/Google; every consent toggleable with history.
**Depends on:** M2 baseline + all data-producing milestones for export coverage. **Feeds:** M14.

## M14 — Performance, accessibility, security review & release prep

**Scope (adjusted for personal use — no store distribution):** Performance pass (startup, diary latency, chart perf, bundle size, list virtualization audit); accessibility pass (VoiceOver/TalkBack full sweep, dynamic type 130%, contrast audit both themes); localization QA (Greek review, truncation); **security review checklist** (SECURITY §12: RLS audit, secret scan, storage policies, permission prompts, export/deletion drill, dependency audit, backup/restore drill); notifications polish (full reminder set per PRODUCT_SPEC §15 if gaps remain); stable personal builds (EAS/local release builds, direct install: sideload iOS / APK Android), versioning. ~~Store metadata, screenshots, privacy labels, TestFlight/Play tracks, crash reporting vendor~~ — dropped: commercial-distribution-only concerns.
**Files/modules:** cross-cutting; `docs/RELEASE_CHECKLIST.md` created.
**DB:** none (unless review findings).
**API:** stores + Sentry.
**Tests:** perf benchmarks recorded; a11y checklist; full E2E suite green on both platforms; security checklist signed off in the PR.
**Risks:** store review surprises (health app policies, AI disclosure) — read current guidelines during this milestone; findings-driven scope — timebox and triage.
**Acceptance:** quality bars in PRODUCT_SPEC §18 measured and met; both store submissions accepted to internal/beta tracks; security checklist complete with evidence.
**Depends on:** all. **Feeds:** release.

---

## Dependency graph (summary)

M1 → M2 → M3 → {M4, M5} ; M5 → {M6, M8, M12} ; M8 → M9 ; M3 → {M7*, M10, M11} (*M7 also needs M4) ; {M2..M12} → M13 → M14.
Parallelizable pairs if ever needed: M6↔M7, M9↔M10 — but default remains strictly sequential, one milestone per task.

## Deferred decisions (safe to postpone)

| Decision | Decide at |
|---|---|
| App name & branding | before store assets (≤M14) |
| Chart library final pick | M7 |
| Vision provider (OpenAI vs Gemini) | M12 |
| Health module libraries | M11 spike |
| Crash reporting vendor & config | M14 |
| SQLCipher / cert pinning hardening | post-release review |
| Imperial units, web app, social features, paywall | explicitly out of scope now |
