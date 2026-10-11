# Mini Cover And Translation

Approved by the user on 2026-10-10.

- Preserve the current mini-player surface, controls and provider highlighting.
- Grow the actual album image with the window; cover ring reaches 180 px at
  720 x 320, but wide/short windows still respect the available height.
- When any lyric has a nonblank translation, use stable original/translation
  groups. Show at most three centered groups; insufficient space shows one.
- Untranslated songs retain adaptive 1/3/5 lines. Missing translations do not
  create an empty translation label. Long translations are bounded to two lines.
- QQ original lyrics retain word timing; NetEase retains whole-line coloring.
  Translations use whole-line styling, not invented word timing.
- Validate responsive geometry, smooth transitions, provider rules and actual
  Windows compositor pixels using isolated synthetic data.

The user's installed main/preload bytes match the preceding build. Blue corners
have not reproduced in isolated Windows focus/move/resize/pin/restore checks.
Do not describe the reported corner issue as fixed without reproducing it.

Follow-up request: eliminate all surplus corner frames when changing radius.
Add a bounded defensive native-region refresh on show/focus/blur/restore; keep
metadata-only updates cached. Test simulated lost clipping independently of the
unreproduced user symptom, with both controller and real Windows region checks.

Follow-up jagged edge: pixel-center hard clipping removes partially covered CSS
curve pixels. Use pixel-box intersection to keep that antialiasing fringe while
still removing the outer corners. Test all four curves and compare real screen
edge colors against renderer alpha composited over a known backdrop.
