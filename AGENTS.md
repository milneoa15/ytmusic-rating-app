# Repository Guidelines

## Project Structure & Module Organization
The Angular workspace sits at the repository root. Feature code lives in `src/app`, with UI pieces under `components/`, shared DTOs in `models/`, and reusable logic in `services/`. Keep new functionality collocated with its component, SCSS, and spec (`playlist-manager/playlist-manager.component.{ts,scss,spec.ts}`). Runtime configuration belongs in `src/environments`, while static assets (icons, manifest) stay in `public/`. Build artifacts are emitted to `dist/`—treat that directory as disposable output.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. Use `npm start` to serve the app locally at `http://localhost:4200` with live reload. `npm run build` compiles a production bundle into `dist/`, and `npm run watch` rebuilds on change without hosting. Execute `npm test` for Karma/Jasmine in watch mode; append `-- --watch=false --code-coverage` when you need a single pass and coverage numbers. Vercel deploys call `./build-vercel.sh`, which hydrates `src/environments/environment*.ts` before running the production build.

## Coding Style & Naming Conventions
Respect `.editorconfig`: UTF-8 files, 2-space indentation, trailing newlines, and trimmed whitespace. TypeScript favors single quotes per the Prettier settings embedded in `package.json`; align imports and object literals accordingly. Components ship as `FeatureThingComponent` classes stored in dashed directories (`feature-thing/`). Services follow the `*.service.ts` suffix, and interface-like models live in `models/` with PascalCase names. Keep SCSS selectors BEM-friendly to match existing styles.

## Testing Guidelines
Unit specs mirror their targets (`foo.component.spec.ts`) and sit beside implementation files. Extend Jasmine suites when touching behavior, covering UI states (empty playlists, failed logins) and service branches (YouTube Music API retries). When adding asynchronous logic, prefer Angular testing utilities such as `fakeAsync` and `flush`. Run `npm test -- --watch=false --code-coverage` before opening a PR to ensure coverage does not regress.

## Commit & Pull Request Guidelines
Write concise, imperative commit subjects under 72 characters (e.g., `Fix build script to create environment.ts`). Group related changes and describe rationale plus context or issue links in the body. Pull requests should summarize the change, list affected modules, attach screenshots or CLI output for UI or tooling updates, and confirm local `npm test` results. Request review from a teammate familiar with the impacted feature area prior to merging.

## Security & Configuration Tips
Never commit raw secrets—use environment variables consumed by `build-vercel.sh` and scrub credentials from tracked files. Review `SECURITY_SETUP.md` before rotating keys or adjusting OAuth flows. If you introduce new third-party libraries, document their purpose and license in the PR to keep the deployment checklist current.
