# Lyric Startup, Spacing And Motion

## Confirmed Causes

- Startup restores a track from SQLite queue/history with lyrics and format,
  but the stored Track model has no translation field. restorePersistedSession
  parsed that original without requesting the platform's complete lyric payload.
  Opening/closing the detail panel does not itself request lyrics. Replaying or
  switching tracks uses loadOnlineTrackAssets and brings back the translation.
- The main currentTime ref changes mainly at line boundaries. The mini time
  watcher transmitted that stale value, so the receiver observed multi-second
  jumps and classified normal next-line playback as a seek. Existing animation
  smoke manually supplied 0.1 s increments, hiding the missing upstream clock.
- Translation margin and original scale-room margins collapsed in block layout.
  The prior scale-room plus translation margin also produced excess whitespace.
- The local platform API returned a leading opening quote in both original and
  translation for the reported line. It is source punctuation, not parser output.

## Changes

- Restore cached lyrics immediately, then hydrate full QQ/NetEase/cloud lyrics
  independently of panel visibility. Preserve paused state, seek position,
  volume and audio source. Guard completion with track ID and asset request ID;
  keep cached lyrics on failure and do not request platform lyrics for local files.
- Send actual playback-clock time at approximately 100 ms intervals, plus forced
  position changes. Metadata snapshots use the same live lyric clock rather
  than stale reactive time. No full per-frame reactive rendering was added.
- Use compact original line boxes while retaining the adjustable line-height
  setting, equal 2 px row padding and a non-collapsing bilingual flex column.
  The original and translation have about 2 px clearance even at active 1.25x
  scale and wrapping. Font, color and translation font size remain configurable.
- Render opening quotes in a hanging position without altering source text or
  character timing. The mini reserves a font-dependent gutter and clips only
  its translation content, so opening marks remain visible.
- Keep QQ word-timed versus NetEase whole-line coloring, bounded long-line
  motion, seek snap, native clipping and default hardware compositor.

## Fresh Verification

- New executable App function tests initially failed for missing startup lyric
  requests and zero between-line mini clock updates, then passed 4/4. They cover
  QQ, NetEase, cloud, local/no-request, offline, stale ID/request completion,
  position/volume/audio preservation and clock throttling.
- Browser startup smoke passed three providers with mocked APIs: translation is
  ready before opening detail, immediately reused by mini, and requested once.
  Original/translation text and hanging-quote alignment were checked.
- Layout smoke initially failed for excess translation gap. It passed at
  1600/900/390 widths after the fix: active wrapped translation gap approximately
  2.03/2.06/1.97 px, no overlap or horizontal overflow, consistent row padding.
- QRC lyrics smoke passed metadata prelude, active scale and character colors.
- Native frameless mini smoke passed intermediate upward animation frames,
  immediate backward seek, QQ/NetEase rules, translated groups, quote visibility,
  cover bounds, controls, appearance sync, queue and return.
- Native startup/layout passed. Screen-first blue-corner smoke passed five
  entries, non-topmost shrink/enlarge and pin-on/pin-off.
- Full frontend/script verification, all three TypeScript projects and
  production build passed. The new unit tests are registered in package scripts.

Browser and native checks used isolated data and synthetic platform responses.
The single real-song API read confirmed quote/translation fields; no token was
printed. User services and player were not stopped, and real account/library
data were not reset. Full installed-account playback remains user acceptance.
Installer metadata is recorded in docs/release-validation-2026-10-10.md.
