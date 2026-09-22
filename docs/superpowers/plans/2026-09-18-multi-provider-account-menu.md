# Multi-provider Account Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-left account menu that supports simultaneous independent NetEase and QQ Music sessions.

**Architecture:** A backend account coordinator exposes all active public accounts and delegates QQ Cookie authentication to a dedicated service. The Vue renderer keeps an account list, projects the NetEase account for existing account-content pages, and uses focused account-menu and provider-aware authentication components.

**Tech Stack:** Java 21, Spring Boot, SQLite/JdbcTemplate, Vue 3, TypeScript, Lucide Vue, Node contract tests, JUnit/Mockito.

---

### Task 1: Lock the contracts with failing tests

**Files:**
- Create: `electron/tests/account-menu-contract.test.cjs`
- Modify: `electron/package.json`
- Modify: `backend/src/test/java/com/listenmusic/api/AuthControllerTest.java`
- Create: `backend/src/test/java/com/listenmusic/auth/QqMusicAuthServiceTest.java`
- Modify: `backend/src/test/java/com/listenmusic/auth/NetEaseAuthServiceTest.java`

- [ ] Assert that the shell renders a Lucide user button beside settings, a two-provider account dropdown, provider-specific login panels, and outside/Escape dismissal.
- [ ] Assert `GET /auth/accounts` returns both public account views and `POST /auth/qq/cookie` never returns credentials.
- [ ] Assert QQ Cookie login validates `/user/detail`, stores the cookie through `CredentialStore`, and persists a `qq` account.
- [ ] Assert NetEase QR login checks only the NetEase account, allowing QQ to remain active.
- [ ] Run the focused tests and confirm they fail because the new contracts do not exist.

### Task 2: Implement multi-provider backend authentication

**Files:**
- Modify: `backend/src/main/java/com/listenmusic/repository/AccountRepository.java`
- Create: `backend/src/main/java/com/listenmusic/auth/QqCookieLoginRequest.java`
- Create: `backend/src/main/java/com/listenmusic/auth/QqMusicAuthService.java`
- Create: `backend/src/main/java/com/listenmusic/auth/AccountAuthService.java`
- Modify: `backend/src/main/java/com/listenmusic/auth/NetEaseAuthService.java`
- Modify: `backend/src/main/java/com/listenmusic/api/AuthController.java`

- [ ] Add `findAllActive()` and keep records partitioned by provider.
- [ ] Validate and parse the QQ account identifier from `uin` or `wxuin`, call QQMusicAPI with the submitted Cookie header, and normalize nickname/avatar fields.
- [ ] Store QQ credentials encrypted and expose only `AccountView`.
- [ ] Route listing and logout through `AccountAuthService`; keep QR operations on `NetEaseAuthService`.
- [ ] Run backend tests and confirm they pass.

### Task 3: Implement the account menu and provider-aware login UI

**Files:**
- Create: `electron/src/renderer/src/components/AccountMenu.vue`
- Modify: `electron/src/renderer/src/components/AuthPanel.vue`
- Modify: `electron/src/renderer/src/services/api.ts`
- Modify: `electron/src/renderer/src/App.vue`

- [ ] Add typed APIs for all accounts and QQ Cookie login.
- [ ] Render a compact anchored dropdown with independent NetEase and QQ rows, real avatars, login/logout actions, and accessible labels.
- [ ] Make `AuthPanel` use NetEase QR for `netease` and Cookie entry for `qq`.
- [ ] Keep the account list synchronized after login/logout while preserving existing NetEase account-content behavior.
- [ ] Close the dropdown on outside click and Escape and share shell-control hover styling.
- [ ] Run the renderer contract test, full test suite, and TypeScript production build.

### Task 4: Visual and end-to-end verification

**Files:**
- Create: `electron/account-menu.png`

- [ ] Open the running renderer in headed Playwright.
- [ ] Verify icon alignment, dropdown placement, both provider states, QQ login form, outside dismissal, and narrow-window containment.
- [ ] Capture the final account-menu screenshot.
- [ ] Re-run backend tests, renderer tests, and build before reporting completion.

