# CalorieTracker (working title)

Personal cross-platform (iOS/Android) nutrition & lifestyle tracker: food diary, calorie/macro goals, multi-source food search, barcode scanning, AI meal-photo estimation, recipes & meal planning, intermittent fasting, health-platform sync, and progress analytics. Greek + English, metric units, dark/light themes, offline-friendly diary. Personal use — no ads, no paywall, no telemetry.

**Start here:** [AGENTS.md](AGENTS.md) (project rules) → [docs/ROADMAP.md](docs/ROADMAP.md) (current milestone).

## Docs

| Doc | Contents |
|---|---|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Feature specification (13 areas) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, layering, offline sync, adapters, decisions log |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Postgres schema, canonical nutrients, RLS, SQLite mirror |
| [docs/SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Threat model, consents, user rights |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 14 milestones with scope/tests/acceptance |
| [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) | Test layers, E2E journeys, coverage gates |
| [docs/API_AND_DATA_SOURCES.md](docs/API_AND_DATA_SOURCES.md) | OFF/USDA/Greek DB/vision/health providers, licensing |

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript (strict) · Expo Router · Supabase (from M2) · Zod · i18next · Jest + React Native Testing Library.

## Getting started

```sh
npm install
cp .env.example .env   # Supabase values needed from Milestone 2 onward
npm start              # then press i (iOS sim), a (Android), or w (web)
```

## Quality gates (all must pass before any commit)

```sh
npm run typecheck
npm run lint          # zero warnings policy
npm test
```

## Status

- ✅ M1 — Foundation & design system (tokens, themes, i18n en/el, UI kit, 5-tab shell)
- ⏭️ M2 — Authentication & profile (needs a Supabase project)

## Disclaimer

All calorie and nutrient values are informational estimates, not medical advice.
