# Playlist Context Favorites

**Scope:** Remove the duplicate Add Favorite command only from the streaming self-created playlist toolbar. Selected-row context favorites must apply to all selected visible songs, not just the clicked song. Preserve existing favorites/recent toolbars, single-row behavior and account boundaries. No commits, publishing, packaging or website changes.

**Design:** Reuse `runStreamingTrackBatch` and the existing context completion callback. A mixed selection adds favorites and skips already liked songs; an all-liked selection removes favorites. Removing favorites from a normal playlist must not remove its songs. Capture the menu account/playlist identity and reject stale operations. Show counts/reasons and retain failed selections.

- [x] Extend `electron/tests/account-playlist-actions.smoke.cjs` with both-platform mixed likes, refusal/retry, all-liked unlikes, unchanged playlist membership and absence of the duplicate toolbar button. Observe a failure before implementation.
- [x] Remove the `executeBatch('like')` button only in the `batchMode === 'playlist'` branch of `StreamingDailyMixPage.vue`.
- [x] Update App.vue's selected context favorite handler to call `runStreamingTrackBatch`, validate the captured account/playlist and return results to the existing selection callback. Allow unlike in normal account playlists and only remove rows for unlike in favorites views.
- [x] Run the account UI regression, focused batch/contract tests, type checking and build. Review screenshots. Leave source ready for IDEA acceptance without creating an upload package.

**Verification:** Both-platform isolated account UI regression passed (mixed selection, duplicate skips, partial like/unlike refusal, retry, unchanged playlist membership, toolbar simplification and existing account-switch flows). Eight focused Node tests passed. Type checking and production build passed. The corrected UI test was also run against the original single-song handling to verify that it detects the missing batch operation. No real account mutations were performed.
