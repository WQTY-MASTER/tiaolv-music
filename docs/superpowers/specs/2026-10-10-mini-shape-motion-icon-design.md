# Mini Player Shape, Motion, Layout and Icon

Approved in chat on 2026-10-10, including the subsequent responsive layout refinement.

## Scope

- Preserve the existing round record cover, white/glass surfaces, toolbar and playback buttons.
- On Windows disable the native thick frame and apply a rounded native window region matching the configured radius. Refresh on resize, appearance changes and queue expansion. Keep custom resize grips and position locking.
- Animate normal adjacent lyric changes over 280 ms using stable keyed rows and transform-only movement. Seek, track changes and layout changes must snap immediately. Do not measure text on every clock packet.
- Keep QQ QRC word timing and NetEase whole-line highlighting unchanged. Short lyrics remain stationary; only overflowing active lines move horizontally.
- Scale the cover within 72-128 pixels using available content space. In wide windows center it in a wider left column and shift the lyric column right. Use fixed compact/medium/large lyric metrics selected by available height, not continuously viewport-scaled type. Retain adaptive 1/3/5 visible lines.
- Keep toolbar/playback button dimensions unchanged, including minimum size and expanded queue bounds. No new user settings or account changes.
- Simplify the existing raster logo while preserving black/white/gold and the record/needle motif. Produce a multi-resolution ICO for desktop/installer/taskbar and a PNG for renderer/tray use.

## Verification

Unit tests cover rounded regions, radius/size synchronization, responsive metrics and animation decisions. Real Electron tests cover visible lyric counts, animation intermediate positions, immediate seek positioning, provider highlighting, small/wide layout geometry and controls. Validate native Windows region/frame rather than relying solely on Chromium transparent screenshots. Validate ICO dimensions, rebuild the installer, and record fresh artifact hashes. Use isolated test data; do not stop user services or touch their library.

## Icon Asset Provenance

Built-in image generation, edit mode, transparent background. Input: `electron/resources/app-icon.png` (previous raster mark). Selected output was copied into the same project asset path and normalized to 512 pixels by the Electron conversion utility. No new dependency was added.

Final prompt: Simplify the existing music-player application logo, preserving black/white/gold, the circular record and upper-left gold angular needle. Keep one bold white rim and small white spindle; remove orbit spaghetti, decorative dots, glows, shadows and fine detail. Use thick geometric shapes and generous negative space readable at 16-48 pixels. Center the isolated mark on a transparent square canvas. No text, watermark or UI mockup.
