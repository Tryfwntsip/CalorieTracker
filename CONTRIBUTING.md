# Contributing

Thank you for helping improve CalorieTracker.

## Before you start

- Check the [roadmap](docs/ROADMAP.md) and open an issue before starting a large change.
- Keep the app local-first. Do not add accounts, a backend, telemetry, ads, or cloud storage.
- Never commit personal health data, local databases, credentials, API keys, or `.env` files.
- Keep user-facing text available in both English and Greek.

## Development

```sh
npm install
npm start
```

Use a native development build for features that need native capabilities:

```sh
npx expo run:ios
npx expo run:android
```

## Quality checks

Run all checks before opening a pull request:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

Pull requests should be focused, explain the user-visible change, include tests for new behavior, and update the relevant documentation. Use Conventional Commit-style titles such as `feat:`, `fix:`, `docs:`, `test:`, or `chore:`.

## Reporting security issues

Do not open a public issue for a suspected vulnerability or exposed secret. Follow the private reporting instructions in [SECURITY.md](SECURITY.md).
