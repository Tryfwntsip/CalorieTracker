# SECURITY_AND_PRIVACY — CalorieTracker (working title)

Status: Phase 1. Binding. Weight, food, mood, activity, and health-platform data are treated as **sensitive personal information** throughout.

## 1. Threat model (summary)

Assets: user health/lifestyle data, auth credentials/sessions, provider API keys, meal photos.
Main threats: cross-user data access (broken RLS), key leakage via the mobile bundle, over-collection (photos, health data), injection via external food data, account takeover, data loss on device/sync, unlawful retention after deletion.

## 2. Authentication & sessions

- Supabase Auth. Email+password with email verification; password reset via email link (deep link into app). Apple/Google sign-in enabled later on the same user model.
- Password policy: min 10 chars, checked client- and server-side (Supabase settings); no composition theater.
- Session tokens stored in **expo-secure-store** (Keychain/Keystore), never AsyncStorage. Auto-refresh; sign-out clears SQLite user data and secure storage.
- Rate limiting on auth endpoints (Supabase defaults + captcha option if abuse appears — deferred).

## 3. Authorization

- **RLS default-deny on every table**, policy pattern in DATA_MODEL §10. No table without RLS ever reaches production; CI runs RLS tests that attempt cross-user reads/writes and must fail.
- Edge Functions derive user identity **only from the JWT**; a `user_id` in a request body is ignored/rejected. Service-role key exists only in function env, never in the app, never in the repo.
- Storage buckets private with per-user prefix policies; access via signed URLs with short TTL.

## 4. Secrets & configuration

- Client bundle may contain only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is safe **only because** RLS is airtight — hence §3).
- USDA and AI-vision keys live in Edge Function secrets; rotation documented in the function READMEs.
- `.env` gitignored from the first commit; `.env.example` lists every variable with placeholder values; pre-commit secret scan (gitleaks) in CI.

## 5. Data protection

- In transit: TLS everywhere (Supabase default); certificate pinning considered post-release (deferred — D-risk low with Supabase domains).
- At rest (server): Supabase/Postgres encryption at rest.
- At rest (device): SQLite contains sensitive logs; device-level encryption (iOS Data Protection / Android FBE) is the baseline; SQLCipher considered post-release if requirements harden (deferred, documented trade-off).
- Backups: Supabase automated backups; restore drill before public release (M14).
- No PII in logs, crash reports, or analytics events. Logger redacts tokens and emails by construction.

## 6. Consent management

- Granular, versioned, timestamped consents (DATA_MODEL §9): analytics (default **off**), AI photo processing, AI image retention, each health data type separately.
- Features requiring consent hard-check it server-side where enforceable (e.g. `vision-analyze` refuses without `ai_photo` consent; retains image only with `ai_image_retention`).
- Consent screen copy is plain-language, in both locales; policy version bump forces re-display of what changed.

## 7. Meal photos

- Upload to private bucket over TLS; analyzed server-side; **deleted immediately after analysis unless retention consent is on**; a scheduled cleanup job enforces this as defense-in-depth.
- EXIF (incl. GPS) stripped on-device before upload.
- Photos never used for anything except the user's own analysis; no model-training use.

## 8. Health platform data (HealthKit / Health Connect)

- Read-only scopes, requested per data type, only when the user enables that integration; purpose strings honest and specific.
- Imported data stays in the user's own rows; never shared; deleting the account deletes imports.
- Platform policy compliance (Apple/Google health data rules): no advertising use, no disclosure, documented in-app.

## 9. User rights (GDPR-aligned)

- **Export:** self-service, full CSV + JSON of all user rows via `export-data` function; delivered as signed URL with expiry; audited.
- **Deletion:** self-service, two-step confirmation; `delete-account` removes auth user, all rows (cascade), storage objects, and scheduled exports; audited (`account_deleted` event keeps only a hashed user reference); irreversible and stated so.
- **Rectification:** everything user-visible is editable in-app.
- Data minimization: onboarding collects only what the calculation needs; optional fields clearly optional.
- Retention: active accounts keep data indefinitely (user-controlled); non-consented photos ≤ 24 h; export bundles ≤ 7 days.

## 10. External data hygiene

- All provider responses (OFF, USDA, vision) are Zod-validated and sanitized server-side before persistence; text fields length-capped and control-character-stripped (defense against poisoned catalog data).
- Barcode/user search input parameterized end-to-end (no dynamic SQL anywhere; Kysely/supabase-js only).
- Vision output is treated as **untrusted data, never instructions**; rendered as plain text, never executed or interpreted.

## 11. Content & tone safety

- No medical claims anywhere; disclaimers at calculation points and in Profile→About.
- Dangerous-goal guardrails (PRODUCT_SPEC §4) are domain-level and tested; support resources copy shown when a blocked goal is attempted.
- Notifications: never shaming/guilt/manipulative; copy checklist enforced in review.

## 12. Audit & operations

- `audit_events` append-only trail for security-relevant actions (DATA_MODEL §9).
- Dependency hygiene: `npm audit` + Dependabot in CI; Expo SDK upgrades tracked per release.
- Security review checklist run in M14 (see ROADMAP): RLS audit, secret scan, permission prompts audit, storage policy audit, export/deletion drill, dependency audit.
