# Reliability and Playlist Optimization Design

Date: 2026-10-13
Status: Approved by user

## Scope and Constraints

Implement the five findings from the project review, then optimize bulk online
playlist removal, manage original playlist-cover storage, and progressively
extract relevant responsibilities from App.vue.

Keep version 0.1.6, application identity, user data locations, existing playlist
IDs, default appearance, and playback behavior unchanged. Do not create an
installer or upload archive, publish or commit to GitHub, or modify the website.
Do not test writes against the user's real music accounts or music library.

## Delivery Order

1. Repair the five confirmed defects and add regression tests.
2. Optimize bulk removal and add original-cover statistics and safe cleanup.
3. Extract the responsibilities exercised by those changes into focused modules;
   verify the same public behavior and persistence formats after each extraction.

Incremental extraction is preferred over leaving every change in App.vue or
rewriting the player and account system in one pass. App.vue remains the view
coordinator. Avoid unrelated formatting, dependency, and metadata changes.

## Five Defect Repairs

### Verification Entry

Support the existing Node test commands with multiple test-file arguments.
Validate every file and allowed flag, deduplicate tests without dropping flags,
and include the new account and bulk-operation regressions in the normal offline
verification path. Unsupported command syntax still fails explicitly. Browser
fixtures have a separate runnable acceptance entry, not silent omissions or
live-account integration tests.

### Reliable Local Playlist Persistence

Compute an immutable next snapshot and persist it before replacing displayed
state. Apply this ordering to local and aggregate playlist creation, track
addition, renaming, and ordering affected by this work. Storage failures keep the
previous state and user input and show an actionable error. Never report success
for an unsaved mutation. Preserve existing storage keys and playlist identities.

### Online Batch Addition

Deduplicate selected tracks and split requests into at most 100 tracks each.
Capture the account and target playlist at the start. Stop issuing new requests
when that context changes. Keep successful and failed IDs distinct, preserve
failed selection for retry, and show actual platform errors. Do not automatically
retry ambiguous writes. Retain the existing same-platform target rule and
platform verification of successful operations.

### Complete Request Timeouts

Keep cancellation and timeout handling active through response-body parsing,
including failed HTTP responses. Dispose listeners and timers in a final block
after the whole request. Preserve HTTP status and platform error messages.
Align the desktop preload request path with the same timeout behavior; do not
silently reclassify a caller cancellation as a platform failure. Add explicit
bounded backend HTTP timeouts where needed so abandoned requests cannot wait
indefinitely for a local gateway.

### Favorites Name Persistence

Persist and restore the local favorites display name using a backward-compatible
metadata setting. Keep the stable favorites ID and its songs unchanged. Default
to the existing name only when no valid custom name exists. Name-saving failure
does not change the visible name or dismiss its dialog as successful.

## Bulk Online Playlist Removal

Add a bounded batch-removal API with an explicit result containing successful
IDs, failed IDs, and safe failure reasons. Retain the existing single-track API
for compatibility.

For NetEase, validate ownership once per batch, submit the existing playlist
operation with multiple track IDs, and verify membership once per batch rather
than fetching account playlists and the complete target list for every song.
Bound batches to at most 100 tracks. Use the verified membership result, not just
an HTTP success, to determine success. A failed or unavailable readback must not
be presented as a fully verified success.

For QQ Music, reuse only capabilities confirmed in the existing gateway. A
single-track-only gateway may retain bounded sequential writes within a batch;
do not invent a platform bulk API or introduce unbounded concurrency. Keep
account credentials captured for the operation and check playlist editability.

The UI retains the removal confirmation and shows processed/total counts during
work. Remove successful items from the visible list and selection; failed items
remain selected with their reasons and can be retried deliberately. A page or
account change stops new chunks and prevents late responses from replacing the
new page's state. Cancellation does not claim that an already sent platform
request has been rolled back.

## Original Playlist-Cover Storage

Add an independent statistics view in the existing cache/data settings showing
original-cover count, total bytes, and reclaimable unused files. Keep original
covers distinct from downloadable cover caches and appearance backgrounds.

Cleanup is an explicit confirmed action, not automatic eviction. Collect all
persisted local, favorites, copied, aggregate, and custom playlist-cover
references plus active selections before considering a managed file unused.
Preserve files imported within the previous 24 hours and files still in progress
to avoid a race between image import and playlist saving. The reclaimable count
excludes this protected interval. If reference enumeration is malformed or incomplete, refuse
cleanup and display an error instead of treating unknown data as unreferenced.

Only hash-named regular files inside the application's playlist-covers directory
may be reclaimed. Reject directory links and linked files. Never traverse or
delete source-image paths, music files, appearance backgrounds, or other user
directories. Scope statistics and cleanup IPC to the trusted main window. Refresh
statistics after importing or cleaning images.

Keep retained image bytes exactly unchanged: no recompression, resizing,
transcoding, or quality-dependent URL rewrite. Custom cover precedence and fixed
cover behavior remain unchanged when songs are added, removed, sorted, or when
the original source image is moved.

## Progressive Code Extraction

Extract reusable request lifecycle handling, save-before-publish playlist
persistence, captured-account bulk operations, and cover-reference collection
into focused modules or composables using current project conventions.

Extract a bounded part of playback state management, such as serialized queue
persistence, without replacing the audio engine, changing queue identity, or
altering fade/lyrics/mini-player behavior. Keep public integration boundaries
small and explicit. Existing account revision guards and pure playlist helpers
are reused, not duplicated.

## Acceptance Criteria

- Standard frontend verification discovers and executes multi-file test scripts
  and the new offline regressions; type checking passes.
- Storage failures produce no ghost local or aggregate playlists, no unsaved
  ordering or song changes, and no false success messages.
- Favorites rename survives reload; failed saving preserves the original name.
- Adding 101 or more songs uses bounded requests, preserves failed IDs, reports
  actual errors, and cannot continue under a changed account.
- A stalled response body times out; caller cancellation remains effective after
  headers; timer/listener disposal works on every result path.
- NetEase bulk removal reduces playlist-list/detail reads to batch-level reads,
  displays progress, handles partial failure, and retries only failed selections.
- QQ and NetEase use isolated gateway fixtures, including permission, timeout,
  membership-verification, and account-switch cases.
- Original-cover cleanup deletes only eligible unused managed files. Referenced,
  in-progress, linked, and uncertain references are protected.
- Retained cover bytes match the originals before and after cleanup; covers
  still display after reload and after source-image moves.
- Focused unit tests, isolated browser/Electron checks, backend tests, standard
  verification, type checking, and build pass without real-account writes.
- No version change, release archive, installer, GitHub action, or website update.
