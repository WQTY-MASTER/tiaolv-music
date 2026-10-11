# Appearance Settings Implementation Plan

> **For agentic workers:** Execute inline in the current workspace. Do not commit unless the user explicitly requests it.

**Goal:** Replace the appearance placeholder with a persistent, live settings experience matching the supplied reference.

**Architecture:** Keep normalization and storage in a framework-free service, UI controls in a dedicated Vue component, and application-wide rendering in `App.vue` through classes and CSS variables.

**Tech Stack:** Vue 3, TypeScript, scoped CSS, Electron file dialog, Node tests

---

### Task 1: Appearance preference domain

**Files:**
- Create: `electron/src/renderer/src/services/appearanceSettings.ts`
- Create: `electron/tests/appearance-settings.test.cjs`

- [ ] Define typed defaults for themes, accents, backgrounds, density, and lyrics.
- [ ] Normalize malformed persisted data and clamp numeric ranges.
- [ ] Resolve system theme, animation preference, and inherited page backgrounds.
- [ ] Verify defaults, round-trip persistence, and invalid-data recovery.

### Task 2: Appearance settings component

**Files:**
- Create: `electron/src/renderer/src/components/AppearanceSettings.vue`
- Create: `electron/tests/appearance-settings-contract.test.cjs`

- [ ] Add live theme, animation, accent, background, cover color, font, and density controls.
- [ ] Add expanded unified/per-page background editor using the existing image picker.
- [ ] Add the expanded lyric styling editor and collapsed advanced entries.
- [ ] Verify labels, controls, image actions, and no-save interaction contract.

### Task 3: Application integration

**Files:**
- Modify: `electron/src/renderer/src/App.vue`
- Modify: `electron/package.json`

- [ ] Mount the component in Settings > Appearance.
- [ ] Persist emitted preferences and react to system theme/motion changes.
- [ ] Apply theme, density, background, font, accent, and animation classes/variables.
- [ ] Apply lyric focus and style variables to the song detail page.
- [ ] Add the new tests to the complete Electron test script.

### Task 4: Verification

- [ ] Run focused appearance and authentication tests.
- [ ] Run the complete Electron test suite.
- [ ] Run the production build.
- [ ] Inspect the page in an isolated Electron smoke window and check the final diff.
