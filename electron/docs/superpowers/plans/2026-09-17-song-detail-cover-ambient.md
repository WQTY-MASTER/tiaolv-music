# Song Detail Cover Ambient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a soft cover-derived ambient gradient to the song detail page and its embedded player without changing the ordinary global player.

**Architecture:** A focused cover-palette service owns color sampling and white blending. `App.vue` watches the resolved current cover, supplies CSS variables to the detail view, and opts only the detail `PlayerBar` into ambient styling.

**Tech Stack:** Vue 3, TypeScript, Canvas 2D, scoped CSS, Node contract tests

---

### Task 1: Cover Palette Service

**Files:**
- Create: `src/renderer/src/services/coverPalette.ts`
- Create: `tests/cover-palette.test.cjs`

- [ ] Add failing tests for RGB parsing, white blending, representative-color selection, and fallback palettes.
- [ ] Run `node tests/cover-palette.test.cjs` and confirm the missing-module failure.
- [ ] Implement pure palette helpers and asynchronous canvas image sampling with safe failure handling.
- [ ] Run `node tests/cover-palette.test.cjs` and confirm it passes.

### Task 2: Detail Theme Wiring

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `tests/player-ui-contract.test.cjs`

- [ ] Add failing contract assertions for the cover palette watcher, detail CSS variables, stale-request guard, and detail-only ambient player prop.
- [ ] Run `node tests/player-ui-contract.test.cjs` and confirm the new assertions fail.
- [ ] Watch the resolved cover URL, cache palettes, generate fallbacks, and bind the CSS variables to the detail root and embedded player.
- [ ] Add a light layered linear gradient to `.song-detail`.
- [ ] Run `node tests/player-ui-contract.test.cjs` and confirm it passes.

### Task 3: Opt-In Ambient Player

**Files:**
- Modify: `src/renderer/src/components/PlayerBar.vue`
- Modify: `tests/player-bar-layout-contract.test.cjs`

- [ ] Add failing assertions that `PlayerBar` exposes an ambient prop and only its ambient class uses cover-derived CSS variables.
- [ ] Run `node tests/player-bar-layout-contract.test.cjs` and confirm the assertions fail.
- [ ] Add the ambient class binding and translucent gradient surface while retaining the default white `.player-bar` background.
- [ ] Run the targeted tests, `npm test`, and `npm run build`.
