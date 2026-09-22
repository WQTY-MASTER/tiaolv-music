# Streaming Home Provider Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the streaming home into a provider-aware home page for NetEase Cloud Music and QQ Music.

**Architecture:** The renderer owns a persisted selected provider and derives login state from the shared account list. Account content endpoints resolve the requested provider, its active encrypted credential, and the matching backend `MusicProvider`; QQMusicAPI is adapted through a dedicated provider implementation.

**Tech Stack:** Vue 3, TypeScript, Lucide Vue, Java 21, Spring Boot, RestClient, JUnit, Node contract tests.

---

### Task 1: Add failing home and provider tests

- [ ] Add a renderer contract for the `主页` heading, cloud selector, two source options, provider login guide, and provider-scoped requests.
- [ ] Add controller/service tests proving `/account/qq/recommendations` resolves the QQ account rather than rejecting it.
- [ ] Add QQ provider tests for `/recommend/daily` and `/recommend/playlist/u` with the encrypted credential forwarded as a Cookie header.
- [ ] Run the focused tests and confirm expected failures.

### Task 2: Make account content provider-aware

- [ ] Pass the route provider through `AccountController` into `AccountCatalogService`.
- [ ] Resolve the matching active account, credential, and `MusicProvider` by provider ID.
- [ ] Implement QQ recommendation, playlist, playlist-detail, search, metadata, lyric, and playback URL mapping against QQMusicAPI.
- [ ] Run backend tests.

### Task 3: Build the streaming home

- [ ] Add persisted NetEase/QQ source state and a shared-account projection.
- [ ] Add the cloud icon selector with outside-click and Escape dismissal.
- [ ] Render the current provider's login guide when signed out.
- [ ] Load and render provider recommendations and playlists when signed in, refreshing after login and source changes.
- [ ] Add responsive styling matching the existing application.

### Task 4: Verify

- [ ] Run full backend and renderer tests and the production build.
- [ ] Inspect desktop and narrow layouts in headed Playwright.
- [ ] Capture the final streaming home screenshot and leave the local preview running.

