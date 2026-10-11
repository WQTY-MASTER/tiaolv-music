# Mini Lyrics And Transparent Surface Repair

Approved by the user on 2026-10-10: adaptive 1/3/5-line lyrics, timed coloring,
overflow-only horizontal movement, and no rectangular outer shell. Preserve the
existing rounded card, cover, toolbar, appearance synchronization and playback.

## Findings

Mini snapshots carry only the current plain-text line, so the mini renderer has
neither adjacent lines nor character timing for coloring. Its CSS applies an
eight-second left-moving animation to every lyric, even short lines. The card
has an eight-pixel inset, large outer shadows and a backdrop filter; previous
pixel checks allowed a translucent corner and did not inspect the entire outer
edge. These effects must not draw outside the rounded native card.

## Approved Behavior

- Native card fills the window without rectangular padding or outside shadows.
  Keep its rounded clipping, internal cover shadow, backgrounds and appearance
  controls. Native glass effects are clipped inside the rounded surface.
- Send parsed lyric lines/timing alongside the existing metadata snapshot;
  reuse lyricSync and desktopLyricsOverflow, never fetch lyrics or mount audio
  from the mini window. Continue lightweight playback-time updates.
- Use available lyric-region height, not window width, to display 1, 3 or 5
  slots. The current line is in the middle, adjacent lines are muted. Beginning
  and ending slots can be empty rather than shifting the current line.
- Follow the user's later clarification: QQ QRC timings control character
  coloring; NetEase always highlights the current whole line, even when YRC
  timings exist. QQ without QRC timing falls back to whole-line highlighting.
  Local timed files retain the existing format-based policy. Played color uses the existing
  mini accent; unplayed and surrounding text use the current text theme.
  NetEase cloud tracks and local tracks marked `online-netease` also use whole
  lines; the real backend provider marker is carried in the snapshot.
- Only an active overflowing line moves, by the measured overflow distance and
  current playback progress. Short lines, future lines and paused playback do
  not drift. Seeking recalculates both coloring and offset.
- Keep existing width/height bounds, optional time/equalizer, lock and queue
  expansion. Enlarging a queue does not count its height as lyric space.

## Verification

Add pure model tests for slots, timing, fallback, seeks and bounded scrolling.
Extend real Electron smoke with synthetic timed lyrics, paused/playing states,
minimum/large sizes and strict transparent outside pixels. Run frontend tests,
three typechecks, production build, both Windows smokes and packaged validation.
Do not stop existing services or read real account/library data. Physical Windows
compositor appearance and real provider playback remain manual acceptance.
