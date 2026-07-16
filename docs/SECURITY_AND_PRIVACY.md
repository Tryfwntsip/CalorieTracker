# SECURITY_AND_PRIVACY — CalorieTracker (working title)

Status: revised 2026-07-16 — **local-first, single-user, no backend**. All data lives on the user's device. Weight, food, mood, activity, and health data remain sensitive personal information even without a server.

## 1. Data locality (the core guarantee)

- Everything is stored in the on-device SQLite database (+ small preferences). **No account, no server, no cloud copy, no telemetry.** Nothing leaves the device except the explicitly optional calls in §4.
- Consequence: device loss = data loss unless the user makes a local backup (M13 backup/export). The app makes this trade-off visible in the M13 UI.

## 2. Threat model

Assets: the SQLite DB, optional meal photos, optional vision API key.
Threats: device theft/loss (mitigated by OS-level encryption + optional future SQLCipher), malicious/poisoned external data (OFF responses), accidental data loss (mitigated by backups + migration discipline), leaking data through optional network calls (§4), secrets in the repo (CI secret scan even though none are expected).

## 3. Device data protection

- Baseline: iOS Data Protection / Android file-based encryption cover the DB at rest on a locked device.
- Preferences in AsyncStorage hold nothing sensitive (theme/language). Any future secret (M12 vision key) goes to **expo-secure-store** (Keychain/Keystore) only.
- Optional app-level lock (biometric/passcode gate on open) — nice-to-have, deferred; revisit after M14.
- SQLCipher (encrypted DB file) — deferred, documented trade-off (adds native complexity for a single-user device that is already OS-encrypted).

## 4. Network calls (all optional, all user-visible)

| Call                                            | When                                                      | What is sent                                          | Mitigations                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Open Food Facts barcode/text lookup             | unknown barcode scanned / optional online search          | the barcode or search term only — never personal data | TLS; custom User-Agent; response Zod-validated + sanitized before persistence; cached so repeat lookups stay offline    |
| Vision provider (M12, optional, off by default) | user photographs a meal AND has entered their own API key | the meal photo (EXIF/GPS stripped on device)          | user-supplied key in secure-store; direct TLS call; image not retained unless opted in; feature invisible without a key |
| Health platforms (M11)                          | user enables per-type read access                         | nothing leaves the device — OS-local reads            | per-type OS permission prompts; read-only                                                                               |

Never sent anywhere: diary contents, weight, mood, profile, identifiers. There are no analytics/crash SDKs.

## 5. External data hygiene

- All OFF/vision responses are Zod-validated; text fields length-capped and control-character-stripped before touching SQLite (poisoned-catalog defense).
- All SQL is parameterized via the repository layer; no dynamic SQL anywhere.
- Vision output is untrusted **data**, never instructions; rendered as plain text and always user-confirmed before saving.

## 6. User rights & data control (all local, M13)

- **Export:** CSV + JSON of every table via the OS share sheet.
- **Backup/restore:** copy out / restore the SQLite file with schema-version check.
- **Wipe:** two-step confirmed deletion of DB + preferences (+ secure-store entries). Irreversible and stated so.
- **Rectification:** everything is editable in-app.
- Photo retention: meal photos (M12) deleted after analysis unless the user opts in to keep them.

## 7. Content & tone safety

- No medical claims anywhere; disclaimers at calculation points and in Profile → About (already live since M1).
- Dangerous-goal guardrails (PRODUCT_SPEC §4) are domain-level, tested, and cannot be bypassed by UI code; supportive copy when a goal is blocked.
- Notifications are never shaming, guilt-inducing, or manipulative; copy checklist enforced in review.

## 8. Engineering guardrails

- No secrets in the repo — expected secret count is zero; CI runs a secret scan (gitleaks) and `npm audit` (high+ fails) anyway.
- Dependencies reviewed on add (AGENTS rule 11); Expo SDK upgrades tracked deliberately.
- M14 review checklist: permission prompts audit (camera/health/notifications honest and minimal), export/restore/wipe drill, dependency audit, backup of a real device DB restored on a clean install.
