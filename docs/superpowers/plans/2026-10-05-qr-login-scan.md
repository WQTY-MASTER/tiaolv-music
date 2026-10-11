# QR Login Scan Implementation Plan

> **For agentic workers:** Execute these steps inline in the current workspace. Do not create a Git commit unless the user explicitly requests it.

**Goal:** Add platform-specific Chinese login titles and a state-aware animated QR scan line.

**Architecture:** Keep the existing login polling and QR rendering unchanged. Derive presentation state in the Vue component and implement the scan effect using scoped CSS.

**Tech Stack:** Vue 3, TypeScript, scoped CSS, Node contract tests

---

### Task 1: Lock the UI contract

**Files:**
- Modify: `electron/tests/auth-ui-contract.test.cjs`

- [ ] Assert the Chinese provider names and spaced login heading.
- [ ] Assert scan-state derivation, conditional class, keyframes, and reduced-motion handling.
- [ ] Run `node tests/auth-ui-contract.test.cjs` and confirm it fails before implementation.

### Task 2: Implement the active scan line

**Files:**
- Modify: `electron/src/renderer/src/components/AuthPanel.vue`

- [ ] Normalize the QQ label to `QQ音乐` and keep NetEase as `网易云音乐`.
- [ ] Add `isScanning` for QR image states `WAITING` and `CONFIRMING`.
- [ ] Apply the conditional class and CSS pseudo-element animation inside the QR frame.
- [ ] Add a reduced-motion fallback.

### Task 3: Verify the desktop UI

**Files:**
- Test: `electron/tests/auth-ui-contract.test.cjs`

- [ ] Run the focused authentication contract.
- [ ] Run the complete Electron test suite.
- [ ] Run the production Electron build.
- [ ] Check the final diff for whitespace errors and accidental debug code.
