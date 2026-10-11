# Remove Independent Identity Implementation Plan

> Execute inline against the user's explicit local-first product decision.
> Preserve the dirty workspace; no commits, user-data deletion or service stops.

**Goal:** Remove the independent identity service and invitation requirement while
preserving the existing eight-page onboarding, optional provider login and local protection.

**Architecture:** The removed Maven module has no runtime client integration.
Keep both existing route owners on the loopback backend. Remove only module-owned
sources, generated build output and dedicated identity documentation.

**Tech Stack:** Node.js regression checks; existing Electron/Vue and Java backend.

## Task 1: Establish the Removal Contract

- [x] Add `scripts/tests/local-first-product.test.cjs` with assertions that
  `cloud-server` no longer exists and runtime/public instructions have no identity entry.
- [x] Run `node --test scripts/tests/local-first-product.test.cjs`; confirm failure
  on the existing module and README, not on missing dependencies.
- [x] Reuse existing onboarding and authentication tests to protect platform login.

## Task 2: Remove the Unused Module

- [x] Verify the module has no database/credential files or reparse points.
- [x] Use `apply_patch` to delete its `pom.xml`, `README.md`, and all `src` files.
- [x] Verify the resolved absolute module path is exactly the workspace's
  `cloud-server`; verify its remaining files are generated `target` output only.
- [x] Remove that verified directory, without touching outside user directories.
- [x] Delete the module-specific design, plan and acceptance documents.

## Task 3: Correct Current Instructions

- [x] Update `README.md` to describe no app registration, optional provider login,
  local credentials and the unchanged three-service runtime; remove dead module links.
- [x] Remove only `cloud-server/target/` from `.gitignore`, retaining credential protections.
- [x] Update `docs/release-checklist.md` and the phase-one boundary spec so app identity
  is not a future requirement. Mark the original migration inventory historical.
- [x] Keep `docs/local-first-product-scope.md` as the current product decision.

## Task 4: Verify Without Live Account Changes

- [x] Run the new contract, existing startup/script regression checks, onboarding,
  provider-auth and local security/boundary tests.
- [x] Run all three TypeScript checks and the Electron production build.
- [x] Search runnable code and current instructions for stale identity references;
  run `git diff --check`. Confirm no existing runtime or account code changed.
- [x] Report results and the unchanged packaging/remote-deployment limitations.

## Acceptance

2026-10-10: the new contract failed on the existing module and README before removal,
then passed all three checks. The full frontend runner passed 99 explicit test files
and eight script suites. All three TypeScript projects and the production build passed.
Only removal-plan/test assertions retain deleted-module paths; current runtime code
and instructions have no executable identity entry. Whitespace checks passed.

No existing backend/provider/runtime source was changed in this removal. The backend
suite was not rerun; live provider login/playback and installer acceptance were not
performed. User services, local credentials and outside databases were not modified.
