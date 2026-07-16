# API_AND_DATA_SOURCES — CalorieTracker (working title)

Status: revised 2026-07-16 — local-first. **No API keys, external accounts, or paid services are required.** All network access is optional and adapter-isolated (ARCHITECTURE §6).

## 1. Source overview

| Source                                   | Used for                                            | Key/account                                | Cost             | Status                                                        |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------ | ---------------- | ------------------------------------------------------------- |
| **Local Greek food & recipe DB** (ours)  | Greek staples, Greek-language search, seed recipes  | —                                          | authoring effort | primary source, always offline                                |
| **Open Food Facts (OFF)**                | unknown-barcode lookup; optional online text search | **none** (custom User-Agent only)          | free             | optional, cache-through                                       |
| User-created foods/recipes               | everything personal                                 | —                                          | —                | always offline                                                |
| Vision provider (OpenAI or Gemini)       | M12 optional photo estimation                       | **user-supplied key**, entered at runtime  | user's own       | optional, off by default                                      |
| Apple HealthKit / Android Health Connect | M11 steps/workouts/weight                           | free Apple ID personal team for dev builds | free             | optional, device-local                                        |
| ~~USDA FoodData Central~~                | extra generic-food source                           | free key                                   | free             | **deferred** — only if local+OFF coverage proves insufficient |

## 2. Local Greek food & recipe DB

- Originally authored entries (nutrients from public-domain composition sources) — never scraped from commercial apps; both `name` and `name_el` populated; `source='greek_seed'`, `quality='complete'`.
- Dev seed (~20 foods) in M2; production catalog (~150 foods) ships in M5 as seed migrations; ~25 original recipes in M8.
- This is the **primary** search source — the app must feel complete with the device offline.

## 3. Open Food Facts

- Product by barcode: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}`; optional text search via `/api/v2/search`. No key; **custom User-Agent required** (app working title + a contact email — decided when M6 lands; no account needed).
- Cache-through: every successful lookup is normalized into `foods` (+ `scanned_products` for barcodes) so repeats work offline forever.
- Quality: crowdsourced → `quality='partial'` unless completeness checks pass (energy + macros present); keep `nova_class` for the food score.
- **ODbL license obligations:** visible attribution ("Data from Open Food Facts") on OFF-sourced food detail screens + in About. Personal use keeps obligations minimal; we still honor attribution.
- Field mapping (fixture-tested in the adapter): `energy-kcal_100g→energy_kcal` (kJ-only products converted ÷4.184), `proteins_100g→protein_g`, `carbohydrates_100g→carbs_g`, `fat_100g→fat_g`, `saturated-fat_100g→sat_fat_g`, `fiber_100g→fiber_g`, `sugars_100g→sugar_g`, `salt_100g→salt_g`, `sodium_100g (g)→sodium_mg ×1000`, `serving_quantity/size→food_portions`; micros to canonical keys when present; missing → NULL, never 0.

## 4. Vision provider (M12 — optional, user's call)

- Interface: `analyzeMealPhoto({ image, locale }) → { items: [{ label, label_el, estimated_grams, confidence, nutrients }], overall_confidence }`, Zod-validated.
- Direct client → provider HTTPS call using a **key the user enters in settings** (stored in expo-secure-store). No key → feature hidden. No proxy server exists.
- Image downscaled (~1280 px) + EXIF-stripped before upload; never retained by the app unless opted in; provider choice (OpenAI vs Gemini) decided at M12 by whoever supplies the key.
- Estimates only — mandatory user confirmation before anything reaches the diary.

## 5. Health platforms (M11)

- Read-only: steps, workouts, body mass. Per-type OS permission prompts; data stays on device; dedup rules in DATA_MODEL.
- iOS dev builds with HealthKit entitlement work on a **free Apple ID personal team** (7-day re-sign). Android Health Connect needs no account.

## 6. Barcode scanning (M6)

`expo-camera` (EAN-13/EAN-8/UPC-A/UPC-E) wrapped in a `BarcodeScanner` adapter; requires a dev build (not Expo Go). Variants normalized to GTIN-13 in one tested function. Lookup order: local `foods.barcode` → `scanned_products` cache → OFF (online only) → not-found flow (create custom food).

## 7. Accounts/credentials checklist

| Item                          | Needed by                          | Notes                                                    |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------- |
| — nothing —                   | M2–M10, M13, M14                   | zero accounts, zero keys                                 |
| Free Apple ID (personal team) | M6/M11 dev builds on a real iPhone | already have; 7-day re-sign                              |
| OFF User-Agent contact email  | M6                                 | just a string in the request header, no signup           |
| OpenAI **or** Gemini key      | M12 only, optional                 | user-supplied, runtime-entered; milestone can be skipped |
