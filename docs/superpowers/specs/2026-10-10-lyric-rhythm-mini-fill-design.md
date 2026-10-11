# Lyric Rhythm And Mini Fill

User approved this scope in chat on 2026-10-10.

## Scope

- Main lyrics use font-relative spacing: close original/translation pairs,
  separated groups; untranslated lines keep an even single-line rhythm.
  Active 1.25x scaling and wrapped text must never overlap.
- Mini keeps adaptive line/group counts and adds a small translation gap.
- Recognize music-director credits in Chinese and English in both credit
  extraction and lyric exclusion, including LRC and QRC. Keep credit text,
  order and time; retain colon-containing sung text that is not a credit.
- Keep approximately 100 ms IPC synchronization. Only the mini lyric component
  projects time per animation frame, bounded to 150 ms without a new sample.
  Pausing, track changes and seeks reanchor immediately. Ordinary playback
  must not rewind at each synchronization. Cancel frames when paused/unmounted.
- QQ timed words remain word-highlighted; NetEase remains whole-line colored.
  Native clipping, compositor, cover, tools and data storage are unchanged.

## Verification

Observe failing credit, local clock and spacing assertions before fixing.
Check intermediate native character fills, pause/seek reset, line transitions,
long translations and rounded corners. Run frontend verification, TypeScript,
build, isolated UI checks and packaged asset checks. Generate a new installer;
do not stop user services or alter real accounts/libraries.
