# Playlist Picker Covers Implementation Plan

**Goal:** Show the same full-quality playlist covers in target pickers and lists, keeping manually selected covers fixed.

**Architecture:** Reuse existing playlist cover resolution and original-byte image storage. Keep cover originals separate from the clearable appearance-background cache. Use a shared picker art component to resolve URLs and show a placeholder only when the preferred cover is missing or cannot load; never replace a failed custom cover with another song's cover.

**Tech Stack:** Vue 3, Electron, Node tests, isolated Playwright fixtures.

- [x] Reproduce missing picker images and cover-store URL failures before changing production code.
- [x] Display regular, platform and aggregate covers using existing priority rules; share aggregate cover selection with the overview.
- [x] Preserve platform/custom covers during removal, reorder and refresh; refresh platform playlist metadata when opening the picker.
- [x] Save selected desktop images as original bytes under an independent cover protocol; migrate available legacy file paths, keeping missing paths unchanged.
- [x] Verify displayed image pixels, custom-cover persistence after track changes and reload, actual original-byte equality and desktop/development loading.
- [x] Run focused regression, type checking and build. Do not change version, package, website or GitHub.

Verification: 14 focused Node tests passed. Isolated QQ/NetEase browser tests exercised real PNG decoding, original dimensions, platform covers, actual browser file selection and fixed aggregate covers after adding songs. Native production and isolated Vite development tests both exercised legacy file migration, real desktop selection, byte-for-byte copies, original-file moves, background-cache clearing, song removal and reload. Screenshot inspection confirmed cover rendering. Type checks and build passed; the existing aggregate drag contract was updated to reflect the previously added batch-mode drag guard. No real account writes, version changes, release packaging, website edits or Git commits were performed.
