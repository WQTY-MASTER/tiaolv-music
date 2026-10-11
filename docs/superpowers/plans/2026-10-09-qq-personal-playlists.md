# QQ Personalized Playlists Implementation Plan

**Goal:** Implement the user-approved account/local hybrid playlist feed.
**Architecture:** Keep provider HTTP parsing separate from pure preference ranking
and account orchestration; extend playlist DTOs with optional provenance.
**Tech Stack:** Spring Boot / Java 21, Vue / TypeScript, Koa QQ API / Vitest.

1. Write and run failing QQ API identity tests; derive cookie identity using the
   existing cookie resolver without altering other recommendation types.
2. Write and run provider tests for personalized results, nested RPC errors and
   empty fallback; attach `qq-personal` or `hot` provenance to parsed playlists.
3. Write pure ranking/blending and account service tests. Extract weighted artist
   and album seeds from current-account 30-day statistics and favorites, search
   three terms with existing provider search, and cap/interleave local results.
4. Preserve provenance in Vue playlist mapping, render source labels, and invalidate
   featured cache/home snapshot after listening changes. Manual refresh bypasses
   featured cache. Test scoped cache invalidation and source presentation.
5. Run backend/frontend/QQ API verification and browser screenshots. Do not commit
   unrelated dirty changes or restart the user's running application without need.
