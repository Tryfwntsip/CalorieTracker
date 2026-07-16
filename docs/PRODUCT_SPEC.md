# PRODUCT_SPEC — CalorieTracker (working title)

Status: Phase 1 specification. Normative for all milestones; changes require updating this file.

## 1. Product summary

An original, premium-feeling nutrition and lifestyle tracker for iOS and Android — **personal, single-user, local-first**. Users log food, water, exercise, steps, weight, mood, and fasting; get a personalized calorie/macro target; search foods locally (plus optional Open Food Facts online lookup) or scan barcodes; optionally photograph meals for AI-assisted estimation; plan meals and groceries; and track long-term progress — in Greek or English, fully offline, with transparent, non-judgmental scoring and no medical claims. All data lives in the on-device SQLite database.

**Non-goals (permanent):** user accounts, authentication, any backend/cloud sync, subscriptions/payments, ads, third-party telemetry, store distribution, social features. **Non-goals (current stages):** imperial units (architecture supports adding them later), web client, coaching/chat.

## 2. Platforms, locales, accessibility

- iOS and Android via React Native + Expo (native dev builds; Expo Go is insufficient for barcode/health/scanning milestones).
- Languages: **Greek (el)** and **English (en)**, switchable in-app, default from device locale. All copy originates in English keys, translated to Greek; no machine-only translations for final release.
- Units: metric (g, ml, kg, cm, kcal). Unit-system abstraction so imperial can be added later.
- Themes: light and dark, following system by default with manual override.
- Accessibility: dynamic type support up to at least 130% without truncation of critical data; minimum touch target 44×44 pt; all interactive elements labeled for screen readers; charts always accompanied by textual summaries; WCAG AA contrast in both themes.
- One-handed use: primary actions reachable in the bottom half of the screen; bottom tab navigation.

## 3. Navigation

Bottom tabs: **Today · Diary · Progress · Plans · Profile**

- **Today:** dashboard for the current day — calorie ring (consumed / burned / remaining / target), macro bars, water, steps, fasting status, quick-add actions.
- **Diary:** the day view — meal sections, water, exercise, steps, weight, mood, notes; date navigation.
- **Progress:** charts and analytics (weight, calories, macros, micros, water, steps, exercise, fasting, mood, adherence).
- **Plans:** recipes, weekly meal planning, grocery lists, fasting plans.
- **Profile:** personal profile & goals, reminders, preferences, privacy, data export/backup/wipe, about/disclaimers.

Modal flows (not tabs): onboarding, food search/logging, barcode scan, photo analysis, recipe editor, entry editors.

## 4. Onboarding & profile (Feature area F1)

Collected: age, biological sex (male / female / prefer not to say), height, current weight, goal weight, activity level (5 levels), dietary preference (none, vegetarian, vegan, pescatarian, low-carb, Mediterranean), allergies (multi-select from a fixed list + free text), goal type (lose / maintain / gain / build muscle), weekly rate of change, preferred units, language.

Output: initial daily calorie target and macro split (see §5). Every step skippable except the minimum needed for the calculation (age or DOB, sex or "not specified" fallback, height, weight, goal, activity); "prefer not to say" for sex uses the average of male/female equations and says so.

**Safety guardrails (deterministic, tested):**

- Informational disclaimer shown at the calculation step and in Profile: estimates are informational, not medical advice; users with medical conditions, pregnancy, or history of disordered eating should consult a professional.
- **Blocked:** computed or manually set daily targets below 1,200 kcal (any adult), or weekly loss rate > 1.5% of current body weight, or goal weight implying BMI < 17.
- **Confirmation required (extra explicit step):** targets 1,200–1,500 kcal, weekly change > 0.75 kg, or goal BMI 17–18.5.
- Guardrail thresholds are constants in `src/domain/goals/guardrails.ts` with unit tests; UI cannot bypass them.

Profile is editable at any time; goal changes are **versioned** (history kept) so past diary days keep the target that applied then.

## 5. Energy & macro calculation (F2)

- BMR: Mifflin–St Jeor. Activity multipliers: 1.2 / 1.375 / 1.55 / 1.725 / 1.9.
- Goal adjustment: 1 kg body mass ≈ 7,700 kcal; daily delta = signed weeklyRateKg × 7700 / 7. The UI accepts a positive pace; loss is persisted negative, gain/build-muscle positive, and maintenance zero.
- Macro defaults: protein 1.6 / 1.4 / 1.6 / 1.8 g/kg for lose / maintain / gain / build-muscle, fat 30% of target calories, and carbohydrates use the remaining calories. Values are user-adjustable before save; all must be non-negative and the protein floor is 0.8 g/kg.
- Per-weekday overrides: users may set different calorie targets for selected weekdays (e.g. training days). Stored in local settings by weekday; diary combines the override with the versioned profile goal effective for that date.
- All formulas are pure functions with table-driven tests; documented in code with sources.

## 6. Diary (F3)

A diary day (local date) contains ordered sections:

- Meal sections — default: Breakfast, Morning snack, Lunch, Afternoon snack, Dinner; plus user-added extra meals.
- Water (ml, quick-add increments configurable).
- Exercise (manual entries: type, duration, estimated kcal; later merged with health-platform imports).
- Steps (manual until health integration; then merged with dedup).
- Weight (one weigh-in per day, editable).
- Mood (5-point scale + optional tags) and daily notes (free text).

Capabilities: rename meal sections; reorder sections; hide unused sections; copy a meal (or whole day) from another date; log for past and **future** dates; edit and delete entries; **undo** (snackbar undo for destructive actions, 6 s window); favorites; user-defined meal templates ("My meals"); per-weekday calorie targets; header always shows consumed / burned / remaining / target.

**Offline:** the diary is fully functional offline (read + write) — SQLite on the device is the authoritative store; there is no sync and nothing to conflict with (ARCHITECTURE §5, §7).

## 7. Food tracking (F4)

Entry methods: text search, recents, favorites, custom foods, my meals, barcode scan, manual quick-entry (name optional + kcal ± macros), AI photo (F6).

Portions: g, ml, serving, piece, teaspoon (5 ml), tablespoon (15 ml), plus provider-defined portions. Nutrition shown per 100 g/ml **and** per selected portion.

Nutrient panel (when data exists): energy, protein, carbs, fat, saturated fat, monounsaturated fat, polyunsaturated fat, fiber, sugar, salt & sodium, cholesterol, vitamins (A, C, D, E, K, B1, B2, B3, B6, B9, B12), minerals (calcium, iron, magnesium, potassium, zinc, phosphorus, selenium, iodine). Missing values display as "—", never as 0.

Canonical nutrient model: all providers map into one normalized structure per 100 g/ml (see DATA_MODEL §7). Every food records source, external ID, last sync date, and a data-quality level (verified / complete / partial / user-entered). Conflicting sources are **never merged silently**: the app shows which source is used and lets the user pick another match or correct values (corrections stored as user overrides, original preserved).

Offline: the entire local catalog (Greek DB, custom foods, anything previously looked up) is loggable offline — always.

## 8. External food data (F5)

Providers behind a common `FoodDataProvider` interface; no keys, no accounts, no proxy server:

- **Local Greek food & recipe DB** — the primary source; curated, originally authored; shipped as seed migrations.
- **Open Food Facts** — optional online lookup for unknown barcodes and packaged-food text search (keyless; ODbL attribution honored); every hit is cached into the local DB so it works offline afterwards.
- USDA FoodData Central is deferred (needs a key) and only reconsidered if coverage proves insufficient.

Details, licensing, and mapping tables: `docs/API_AND_DATA_SOURCES.md`.

## 9. AI meal photo analysis (F6 — OPTIONAL feature)

Optional and off by default: it activates only if the user enters their **own** vision API key (OpenAI or Gemini) in settings (stored in expo-secure-store). Flow: photograph/pick image → EXIF-strip + downscale on device → direct TLS call to the provider (behind the `VisionProvider` interface, swappable) → structured result: detected items, estimated portion per item, estimated nutrients, **confidence score per item and overall**.

Rules: user can edit every item and quantity; nothing is saved without explicit confirmation; the result screen labels values as **estimates** and never claims medical/nutritional exactness; the image is retained only if the user has opted in, otherwise discarded after analysis; low-confidence results show a prominent "check these values" hint. Provider response contracts validated with Zod; provider errors degrade to manual entry gracefully. Without a key the feature is hidden — no external account is ever requested.

## 10. Food quality score (F7)

An original, transparent 0–100 score ("Balance score", final name TBD) computed **client-side** by a pure function over canonical nutrients per 100 g/ml plus portion context.

Factors (weights configurable in one constants file): protein density (+), fiber density (+), energy density (−), added/total sugar (−), saturated fat (−), sodium (−), processing-level proxy (NOVA class when available from OFF) (−), portion-size context (moderates the score display, not the base score).

Display: score + the top contributing factors with direction ("High fiber ↑", "High sodium ↓"). Copy never labels food "good"/"bad" — wording is "fits easily / fits with planning / enjoy mindfully"-style, localized. Foods with insufficient data show "not enough data" instead of a score. Table-driven unit tests with reference foods are mandatory (see TEST_STRATEGY).

## 11. Recipes & meal planning (F8)

- Recipe model: title, image (optional), servings, prep/cook time, ingredients (foods + quantities), steps, tags (dietary + allergy-relevant), per-serving nutrition computed from ingredients.
- Browsing seeded original/licensed recipes + user-created recipes; dietary and allergy filters (allergy filters exclude recipes containing user's allergens); favorites.
- Weekly meal plan: assign recipes/foods/my-meals to day+meal slots for a week; one tap adds a planned meal to the diary.
- Grocery list: generated from a plan's date range; identical ingredients combined (unit-aware summation); manual items; check-off; multiple lists.

## 12. Intermittent fasting (F9)

Plans: 12:12, 14:10, 16:8, 18:6, 20:4, 5:2, alternate-day, custom (user-defined eating/fasting windows per weekday). Timer with start/stop/adjust (retroactive edit allowed), progress ring, current phase; local notifications for window start/end; history log; streaks (consecutive completed fasts); notes per session; a static safety info screen (who should not fast; not medical advice). 5:2 and ADF are modeled as calorie-reduced days, integrated with per-weekday calorie targets.

## 13. Activity & health data (F10)

- Adapters: `HealthKitAdapter` (iOS), `HealthConnectAdapter` (Android), behind one `HealthDataProvider` interface. Imported types (each individually consented): steps, active energy, workouts, weight.
- Manual entry always available.
- **Dedup:** every activity/steps record carries `origin` (manual / healthkit / health_connect) + external UID + time range; overlapping same-type records from different sources are resolved by precedence (health platform > manual for steps totals; user can override), never double-counted.
- Weight imported from health platforms creates normal weigh-ins marked with origin.

## 14. Progress & analytics (F11)

Charts + textual summaries for: weight (with trend line — e.g. 7-day EMA), calories vs target, macro distribution, selected micronutrients, water, steps, exercise minutes/kcal, fasting hours/adherence, mood over time, goal adherence (% days within target band), weekly/monthly averages, estimated date of reaching goal weight (from recent trend, clearly labeled an estimate).

History: at least 2 years navigable without performance collapse (aggregation tables/queries). Every displayed value is labeled recorded / calculated / estimated. Export: CSV and JSON of all user data (see §16).

## 15. Notifications (F12)

Configurable local reminders: per-meal logging, water (interval-based within waking hours), weigh-in (chosen days/time), fasting start/end, weekly goal review, end-of-day incomplete-diary nudge. All off by default except ones the user enables during onboarding. Tone rules: factual and kind; **never** shaming, guilt-inducing, streak-threatening, or manipulative. Quiet hours respected. Copy reviewed against a checklist in the i18n files.

## 16. Privacy & data control (F13) — no accounts, all local

- **No authentication, no accounts, no cloud.** All data lives in the on-device SQLite database.
- Permissions/consents (individually toggleable): AI photo processing + image retention (only if M12 is ever enabled), health-platform read access per data type, camera for scanning.
- Data export: user-triggered CSV + JSON of all data via the OS share sheet.
- Backup & restore: copy the database file out / restore it, with schema-version check.
- Data wipe: in-app, two-step confirmation, deletes the database, preferences, and any stored key; irreversible and stated so.
- Sensitive-data stance: weight, food, mood, activity, and health data are sensitive personal information even on-device — nothing leaves the device except the optional lookups listed in `docs/SECURITY_AND_PRIVACY.md` §4; no third-party sharing, no ad SDKs, no telemetry.

## 17. Design system

Original visual identity: calm, minimal, premium, data-rich without clutter, usable one-handed, legible for ages 18–70 and non-technical users. Tokens (spacing, radii, typography scale, semantic colors for both themes), reusable components (cards, rings/bars, charts, list rows, inputs, sheets, skeletons, empty states, error states, loading states). No imitation of YAZIO's exact layouts or visual identity. Token and component inventory is defined in Milestone 1 (ROADMAP).

## 18. Quality bars

- Cold start < 2.5 s on mid-range Android; diary interactions < 100 ms perceived.
- Crash-free sessions ≥ 99.5% before release prep.
- All features function without network except: unknown-barcode lookup, optional online food search (OFF), optional photo analysis.
- Zero unlocalized strings; zero unlabeled interactive elements.
