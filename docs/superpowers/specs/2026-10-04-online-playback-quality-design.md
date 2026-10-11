# Online Playback Quality Design

## Goal

Add provider-aware, globally persisted playback quality preferences to the playback settings page and bottom player bar. The setting affects online audio only. Local files always keep their original audio data and expose only their file format, such as `FLAC` or `MP3`.

## User Experience

### Playback Settings

Add three controls to the playback settings card:

1. **NetEase playback quality**: Auto, Hi-Res, Lossless, Very High, Standard.
2. **QQ Music playback quality**: Auto, Lossless, High, Standard.
3. **Reload current track after quality change**: disabled by default.

The preferences are global and persisted with the existing renderer settings. Changes made in settings and in the player bar update the same state.

### Player Bar

Replace the placeholder HiFi action with a quality action beside the desktop lyrics button. Its tooltip is `音质`.

- NetEase tracks show the NetEase quality choices.
- QQ Music tracks show the QQ Music quality choices.
- Local tracks do not expose a selector. The panel displays the file's own uppercase format, for example `本地音频 · FLAC`.
- An online track currently playing through a preferred matching local download is treated as local playback and displays that local file format.

Changing an online quality preference applies to the next online track by default. When immediate reload is enabled, the current online source is resolved again while preserving its playback position and playing or paused state. Local playback is never reloaded for a quality preference change.

## Preference Model

The renderer owns and persists these settings:

- NetEase: `auto | hires | lossless | exhigh | standard`
- QQ Music: `auto | flac | 320 | 128`
- Reload current online track: boolean, default `false`

A manually selected quality is a maximum requested quality, not an exact-only mode. If unavailable or unauthorized, resolution continues through lower levels so playback remains available.

## Playback Resolution

The catalog audio route accepts a validated provider-specific quality query parameter. The renderer passes the current global preference whenever it creates an online audio URL. The backend remains responsible for provider calls, authentication handling, fallback, and redirects to the resolved media URL.

### NetEase

1. Call `/check/music?id=<id>` before resolving a playback URL.
2. If the track is unavailable, return no playable URL without attempting alternate providers or unblock APIs.
3. Resolve through `/song/url/v1` only. Do not use the legacy `/song/url` route.
4. Auto fallback order: `hires -> lossless -> exhigh -> standard`.
5. Manual modes start at the selected level and continue downward. For example, `lossless` tries `lossless -> exhigh -> standard`.
6. Accept the first non-empty playable URL. Authentication failures remain login failures and must not be disguised as quality fallback.
7. `/song/url/v1/302` is a last-resort transport fallback only when `/song/url/v1` fails unexpectedly or returns a malformed response after availability has passed. It is not used to bypass permissions, and the legacy `/song/url` route is never called.

### QQ Music

Use the existing `/getMusicPlay` integration with the qualities the installed API supports:

- Auto: `flac -> 320 -> 128`
- Lossless: `flac -> 320 -> 128`
- High: `320 -> 128`
- Standard: `128`

Do not expose a master-quality option because the current `/getMusicPlay` contract cannot request it. A playback login error stops fallback and keeps the existing account-expiry behavior. Empty or unavailable media URLs continue to the next lower quality.

### Local Playback

Local audio never receives an online quality parameter and is never transcoded. The quality UI derives an uppercase format label from the local track codec or file extension. Existing preferred-local-playback matching stays ahead of online resolution: when a matching local download is selected, its URL and format are used directly.

## API Boundaries

Introduce a provider-neutral playback quality request at the `MusicProvider` boundary rather than leaking UI labels into providers. Each provider validates and maps the requested value to its native API value.

The catalog controller rejects unsupported quality values instead of silently accepting arbitrary input. Existing callers without a quality parameter retain a compatible default (`auto`). The public audio response remains a redirect so the current HTML audio flow and external media hosting behavior stay intact.

## Error Handling

- General unavailability detected by NetEase `/check/music` produces an unavailable-track result.
- Missing high-quality resources fall back to lower qualities.
- Login expiration remains an authentication error and opens the existing provider login flow.
- Complete fallback exhaustion produces the existing playback failure path, allowing the application's automatic-next behavior to run.
- Immediate reload restores the prior source if resolving the replacement fails, so a settings change does not unnecessarily interrupt a playable track.

## Testing

Backend tests cover:

- quality query parsing and rejection of invalid values;
- NetEase availability preflight, ordered `/song/url/v1` fallback, manual starting levels, login failures, and 302 backup boundaries;
- verification that legacy `/song/url` is never used;
- QQ automatic and manual fallback orders and login failures.

Renderer tests cover:

- preference defaults, validation, persistence, and two-way synchronization;
- provider-specific player menu contents;
- local and preferred-local format display;
- next-track default behavior and position-preserving immediate reload;
- removal of the placeholder HiFi action.

Run the Electron test suite, renderer type checking/build, backend tests, and a desktop visual check of the settings and player quality panel.
