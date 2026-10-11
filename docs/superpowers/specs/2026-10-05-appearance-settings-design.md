# Appearance Settings Design

## Scope

The first appearance-settings phase includes theme mode, animation preference, light/dark accent colors, unified and per-page backgrounds, cover-derived player colors, global typography, interface density, and song-page lyric styling. Advanced sections without supplied controls remain visible as collapsed future entry points.

## Architecture

- `appearanceSettings.ts` owns defaults, validation, persistence, and theme/background resolution.
- `AppearanceSettings.vue` owns the settings controls and emits complete normalized preference snapshots.
- `App.vue` applies the snapshot through root classes and CSS custom properties, selects the active page background, and binds lyric focus behavior.
- Existing Electron image selection is reused. Only the selected path is persisted.

## Behavior

- Changes are immediate and require no save button.
- Preferences survive restart and malformed stored data falls back safely.
- System light/dark and reduced-motion preferences remain live while their matching modes are selected.
- A page background inherits the unified background until explicitly customized.
- Lyric controls affect the song detail page, including alignment, size, weight, spacing, inactive opacity, focus rows, word highlighting, and custom colors.
