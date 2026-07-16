# API_AND_DATA_SOURCES — CalorieTracker (working title)

Status: Phase 1. All providers sit behind adapters (ARCHITECTURE §5); food/AI calls route through Edge Functions so keys stay server-side.

## 1. Provider overview

| Provider | Used for | Key | Cost | License |
|---|---|---|---|---|
| Open Food Facts (OFF) | Packaged foods, barcode lookup | none | free | **ODbL** (data), attribution required |
| USDA FoodData Central (FDC) | Generic foods, detailed nutrients | free API key | free (rate-limited) | US public domain (CC0-like) |
| Local Greek food & recipe DB | Greek staples, dishes, recipes | — (ours) | authoring effort | original / appropriately licensed |
| Vision provider (OpenAI or Gemini) | Meal photo estimation | paid API key | per-call | provider ToS |
| Apple HealthKit | steps, workouts, weight (iOS) | Apple dev account | — | platform rules |
| Android Health Connect | steps, workouts, weight (Android) | — | — | platform rules |

## 2. Open Food Facts

- Endpoints: product by barcode (`/api/v2/product/{barcode}`), search (`/api/v2/search` or SaaS search-a-licious). No key; **custom User-Agent required** (app name + contact email).
- Rate courtesy: cache aggressively; the `food-gateway` persists normalized hits into `foods` so repeat lookups don't re-hit OFF.
- Data quality: crowdsourced → mark rows `quality='partial'` unless completeness checks pass (has energy + macros); keep `nova_class` when present (feeds the score's processing factor).
- **License obligations (ODbL):** visible attribution ("Data from Open Food Facts") on food detail screens sourced from OFF + in About; if we redistribute a derived food database, share-alike applies — our stored normalized copies of OFF rows must remain exportable/attributable. No mixing OFF rows into our proprietary Greek DB claims.
- Useful fields → canonical mapping: `nutriments.energy-kcal_100g→energy_kcal`, `proteins_100g→protein_g`, `carbohydrates_100g→carbs_g`, `fat_100g→fat_g`, `saturated-fat_100g→sat_fat_g`, `fiber_100g→fiber_g`, `sugars_100g→sugar_g`, `salt_100g→salt_g`, `sodium_100g (g)→sodium_mg (×1000)`, `serving_quantity/serving_size→food_portions`. Micros when present map to §5 keys.

## 3. USDA FoodData Central

- Endpoints: `/v1/foods/search`, `/v1/food/{fdcId}`. API key (free, api.data.gov) — **server-side only**, default limit 1,000 req/h (fine behind gateway cache).
- Data types priority: `Foundation` > `SR Legacy` > `Survey (FNDDS)` > `Branded` (Branded usually deferred to OFF). Mark Foundation/SR rows `quality='verified'`.
- Nutrient numbers of interest (FDC nutrient ids → canonical): 1008→energy_kcal, 1003→protein_g, 1005→carbs_g, 1004→fat_g, 1258→sat_fat_g, 1292→mono_fat_g, 1293→poly_fat_g, 1079→fiber_g, 2000→sugar_g, 1093→sodium_mg (salt_g = sodium_mg×2.5/1000), 1253→cholesterol_mg, plus vitamin/mineral ids mapped in `food-gateway/mappings/usda.ts`.
- Portions: `foodPortions[]` → `food_portions` (gramWeight).
- English-only names → Greek search handled by our Greek DB + client-side alias table; do not machine-translate USDA names silently.

## 4. Local Greek food & recipe DB

- Purpose: Greek staples (φέτα, γίγαντες, χόρτα, παστίτσιο…), Greek-labeled search, and seed recipes. **Originally authored** nutrient entries (from public-domain composition sources) — never scraped from commercial apps.
- Stored as normal `foods` rows (`source='greek_db'`, `owner_user_id=null`, both `name` and `name_el` populated, `quality='complete'`), seeded via `supabase/seed/` scripts (idempotent, reviewed like code).
- Seed recipes: original recipes with `title_el` + translated `title`, honest nutrition computed from ingredients.
- Initial target: ~150 foods + ~25 recipes at M5/M8; grows continuously.

## 5. Canonical nutrient model (contract)

Defined in DATA_MODEL §4; the Zod schema `CanonicalNutrients` in `src/domain/schemas/nutrients.ts` is the single contract. Gateway mapping rules:
- Missing value → `null` (never 0). Values per 100 g/ml only; provider per-serving values converted using gram weight or discarded if unconvertible.
- Unit conversions centralized (µg/mg/g, kJ→kcal ÷4.184) in one tested module shared by all mappers.
- Provenance recorded on every row: `source`, `external_id`, `source_updated_at`, `quality`. Conflicts across providers are surfaced (both results returned, ranked), **never merged**.

## 6. `food-gateway` Edge Function (client contract)

```
POST /food-gateway  { op: 'searchText', query, locale, page }        → { results: FoodHit[] }
POST /food-gateway  { op: 'barcode', barcode }                       → { result: FoodHit | null, alternatives: FoodHit[] }
POST /food-gateway  { op: 'getById', source, externalId | foodId }   → { food: Food }
```
`FoodHit` = normalized food + provenance + portions. Behavior: check `foods` cache first; fan out to providers (Greek DB → OFF → USDA for text; OFF for barcode); persist normalized results; per-user rate limit; Zod-validated in/out. Auth: user JWT required.

## 7. Vision provider (`vision-analyze`)

- Interface: `analyzeMealPhoto({ imagePath, locale }) → { items: [{ label, label_el, estimated_grams, confidence, nutrients: CanonicalNutrients }], overall_confidence, disclaimer_key }`.
- Provider selection by function env (`VISION_PROVIDER=openai|gemini`); prompts + JSON-schema outputs versioned in the function; responses Zod-validated; failures → typed error → app falls back to manual entry.
- Consent enforced server-side (SECURITY §6,7). Cost control: image downscaled client-side (max ~1280px), per-user daily call quota in the function.
- Decision on the initial provider is **deferred to M12** (compare accuracy/cost on Greek dishes then).

## 8. Health platforms

- iOS: HealthKit via a maintained Expo-compatible module (final lib pick at M11); read-only: steps, active energy, workouts, body mass. Requires Apple Developer account + entitlement.
- Android: Health Connect (`react-native-health-connect` or equivalent, pick at M11); same types; requires Health Connect app/OS 14+ path documented.
- Both behind `HealthDataProvider`; dedup rules in DATA_MODEL §5. No writes to health platforms initially.

## 9. Barcode scanning

`expo-camera` barcode scanning (EAN-13/EAN-8/UPC-A/UPC-E/QR) wrapped in a `BarcodeScanner` adapter. Requires a dev build (not Expo Go). Torch toggle, haptic on hit, manual barcode entry fallback.

## 10. Accounts / credentials checklist (who must create what)

**Personal-use note:** the app is for personal use, not commercial distribution — no store accounts are required.

| Item | Needed by | Owner action |
|---|---|---|
| Supabase project (URL + anon key) | M2 | create free project |
| USDA FDC API key | M5 | free signup, set as function secret |
| OFF User-Agent contact email | M5 | decide contact address |
| OpenAI **or** Gemini API key | M12 | create, set as function secret |
| Apple ID (free personal team) | M11 (HealthKit dev builds), sideloading | free; builds re-sign every 7 days. Paid $99/yr program only if 7-day re-signing becomes annoying (optional) |
| ~~Google Play Console~~ | not needed | personal APK installs directly |
| Expo/EAS account | M1 (dev builds) | free tier |
