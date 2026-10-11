# Release Hardening Implementation Plan

**Goal:** Implement the user-approved safety, portable packaging and acceptance
work without changing playback features or existing user data.

**Architecture:** Separate Java local-access filtering, Electron trusted-request
authorization, service lifecycle management, build-resource staging, and offline
verification/recovery tooling. Integrate through a runtime manifest and a private
installation-local token file. Each implementation receives focused tests.

**Tech Stack:** Java 21 / Spring Boot, Electron / Node, Vue / Vite, node:test,
JUnit / MockMvc, Playwright, Maven and electron-builder.

## 1. Local API Boundary (Root)
- [x] Add filter tests: unauthenticated data denied, valid token allowed, hostile
  Host/Origin and non-loopback denied, public health, OPTIONS and media requests.
- [x] Implement local token storage and filter, loopback configuration, trusted
  Electron token injection and safe same-origin web preview proxy.
- [x] Test token/header privacy and frontend route/media resolution. Keep isolated
  MVC unit tests testing their controllers; add explicit boundary integration tests.

## 2. Portable Runtime Staging
- [x] Test manifest, required resources and fail-closed staging validation.
- [x] Restore Maven target, build/stage Java runtime/backend/API resources and wire
  electron-builder resources. Do not copy development credentials or .env files.
- [x] Build/stage locally and report missing prerequisites without masking failure.

## 3. Owned Service Lifecycle
- [x] Test startup order, readiness timeouts, occupied ports, startup rollback and
  cleanup ownership using dependency injection.
- [x] Add a focused Electron main-process runtime manager consuming the manifest.
  Integrate in main startup/shutdown, with hidden windows and useful errors.
- [x] Smoke-test actual staged services with synthetic user data where possible.

## 4. Acceptance and Recovery
- [x] Unify all standalone frontend tests and replace placeholder e2e with browser
  smoke commands; include separate backend/typecheck verification commands.
- [x] Test offline recovery with synthetic directories, safety guards and rollback.
- [x] Document development, packaging, data recovery, release limitations and a
  manual acceptance checklist. Do not migrate real user data during testing.

## 5. Review and Verify
- [x] Review each unit for spec compliance and quality, then integration security.
- [x] Run full tests/typechecks/builds and browser/runtime checks; inspect output.
- [x] Finish with a concise account of implemented work and remaining limitations.

Automated results are recorded in `docs/release-validation-2026-10-10.md`.
The manual release gates remain unverified. The current local-first product
decision is recorded in `docs/local-first-product-scope.md`; independent project
accounts and invitations have been removed. This work does not implement public
online services or multi-user isolation.

No commits or worktree resets: the workspace already contains user changes.
