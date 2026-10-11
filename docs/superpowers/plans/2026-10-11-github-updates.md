# GitHub Updates Implementation Plan

> Execute inline using the executing-plans workflow. The user approved the existing settings entry, explicit download, progress, explicit restart/install, and browser fallback. No server migration or automatic installation.

**Goal:** Add GitHub-hosted NSIS updates to the existing About settings section.

**Architecture:** Use electron-updater in the main process with automatic download and install-on-quit disabled. Keep the current snapshot/event bridge; only the trusted main frame may check, download or install. Stop owned services before explicit installation. Keep a fixed project Release URL available after network or checksum failures.

**Tech Stack:** Electron 35, Vue 3, electron-builder 26, electron-updater 6.8.9, NSIS.

## Tasks

- [x] Add focused failing tests in `electron/tests/app-updates.test.cjs` for manual configuration, deduplicated operations, progress, failed checks/downloads, checksum-error refusal, service cleanup before install and development guards.
- [x] Run the focused tests; confirm missing updater-service assertions fail before implementation.
- [x] Implement `electron/src/main/appUpdates.ts`; extend `electron/src/shared/about.ts`; wire `main.ts`, `preload.ts` and `env.d.ts`. Use electron-updater's SHA-512 verification, not renderer-controlled download URLs or install paths.
- [x] Update `AboutSettings.vue` in place with progress, explicit download/install and browser fallback. Keep the existing auto-check preference; do not silently download or interrupt music.
- [x] Set client version `0.1.1`, pin electron-updater, update the pnpm lockfile and configure public GitHub Releases publishing. Release tag must be `v0.1.1`, matching the package/EXE version.
- [x] Run only update/about tests, typecheck, build and an isolated About UI smoke. Do not run unrelated music suites or mutate real accounts.
- [x] Build a separate bootstrap installer without automatic publishing or installing it on the user's behalf. Document release assets, first-install requirement, network fallback and the distinction between hash checks and publisher signatures.

## Verification

15 focused tests, the About settings contract, all three TypeScript projects,
production build and isolated About UI smoke passed. Independent review findings
for install error events, version prefixes and missing SHA512 metadata were fixed
and covered by the focused tests. The installer is 186,129,348 bytes; its version,
SHA512, blockmap and ASAR/build equality were checked. No real cross-version
installation or provider-account operations were performed.

The user subsequently requested publishing to GitHub, followed by static
distribution on the existing `wqty.online` website. Server credentials, provider
accounts and the device backend are not part of the release assets.

## Release Boundary

Production auto-updates require a published GitHub Release with installer, blockmap and `latest.yml`. A source push alone does not publish updates. The first updater-enabled build is installed manually; later versions use the update flow. Do not publish fake versions to test an update, bundle GitHub tokens, disable TLS checks or upload local account data.
