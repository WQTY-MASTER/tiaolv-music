# Lyric Rhythm And Mini Fill Validation

## Confirmed Defects

- Music Director labels were absent from both the credit extractor and lyric
  exclusion hints. The reported Chinese/English label returned zero credits
  and became a sung line. New LRC and QRC assertions failed before the fix.
- Mini character styles used incoming time directly, approximately every 100 ms.
  A native five-frame probe returned five identical fills before the repair.
- Bilingual pairs had a 6 px box gap and only 8 px between groups at default
  22 px font size. The supplied references require stronger group separation.

## Changes

- Added Chinese/English music-director labels to the existing paired recognizers.
  Credit text and timestamps stay intact; ordinary colon-containing lyrics stay
  in the sung list. No provider API or backend change was needed.
- Translated main rows use .35em bottom padding; single-language rows retain
  compact 2 px vertical padding. Original scale-room and 2 px translation margin
  preserve clearance at active 1.25x scale. Mini translation adds 2 px clearance.
- Mini owns a requestAnimationFrame lyric clock, without extra IPC or audio.
  Each sample anchors to actual synchronized time, not previously projected time.
  Projection stops at 150 ms without fresh time, never passes track duration,
  and does not rewind ordinary fill. Pause/seek/track reset reanchor immediately;
  pause and unmount cancel the frame loop. QQ word/NetEase line rules remain.

## Fresh Evidence

- Metadata/parser assertions passed LRC and QRC director extraction/exclusion
  and retained normal sung colons. The frontend verification suite includes them.
- Mini projection tests passed intermediate frames, stale-sample cap, duration
  limit and actual component clock pause/seek/track/unmount behavior. An added
  slow-media test first exposed cumulative drift, then passed after anchoring
  projection to synchronized rather than rendered time.
- Browser layout smoke passed 1600/900/390 widths with no horizontal overflow,
  non-overlapping active wrapped translations and equal row pitch. At 22 px:
  bilingual group pitch 78.9375 px, original/translation box gap 6 px when
  inactive and about 2 px when active, group gap 13.6875 px; Chinese pitch
  43.75 px. The screenshots were visually inspected.
- Native mini smoke passed advancing character fills between IPC samples,
  monotonic fill, pause freeze, intermediate upward line animation, immediate
  seeks, translated 1/3 groups, untranslated 1/3/5 lines and bounded translations.
  Cover, five tools, appearance sync, queue, lock/pin/minimize/return also passed.
- Native startup/layout and browser first-translation/QRC smoke passed.
- Final full frontend/script suite, three TypeScript projects and production
  build passed. Initial sandbox runs failed on dependency realpath/temp-file
  access; reruns with normal permissions passed without unrelated code changes.
- git diff --check passed for the edited source/tests (only CRLF warnings).
- Packaged app.asar frameless-mini smoke passed. Separate screen-first corner
  smoke passed five entries, shrink/enlarge and pin toggles; its first run was
  obstructed by another test window, so it was rerun alone without changing code.
- Final NSIS packaging and packaged asset checks passed. The owned preview
  was stopped; existing service listeners remained running.

Tests used isolated user data and synthetic lyrics/API responses. They are not
full installed-account playback or a guarantee for every GPU/driver. User
services and player were not stopped. No account or library data was reset.
Installer metadata and packaged verification: release-validation-2026-10-10.md.
