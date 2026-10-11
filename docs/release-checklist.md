# Release Acceptance and Offline Recovery

Run commands from the repository root with Node 24, Java 21 and Maven on PATH.
The acceptance runner invokes child Node processes with `process.execPath` and
resolves the installed TypeScript CLIs directly. If a version-manager shim fails
before Node starts, invoke the installed `node.exe` by its absolute path.

## Automated Acceptance

The latest artifact, verification results and remaining manual release gates are
recorded in `docs/release-validation-2026-10-10.md`.

| Command | Coverage |
| --- | --- |
| `node scripts/verify.cjs frontend` | Every Node test in Electron `test` and standalone `test:*` commands, deduplicated by file; recovery/runner tests and `scripts/tests/*.test.cjs` included |
| `node scripts/verify.cjs typecheck` | Renderer, Electron main and preload TypeScript projects |
| `node scripts/verify.cjs backend` | Maven backend tests |
| `node scripts/verify.cjs offline` | Frontend tests, typechecks and backend tests |
| `node scripts/verify.cjs e2e` | Real browser QQ recommendation refresh/error retention and QRC/LRC lyric layout smoke tests |
| `node scripts/verify.cjs all` | Offline checks followed by browser acceptance |
| `node scripts/runtime-smoke.cjs` | Actual staged services, synthetic data, 12 HTTP authorization checks and owned-process cleanup |
| `node scripts/runtime-smoke.cjs --packaged` | Same checks using the unpacked Windows artifact and its bundled executable/resources |
| `node electron/tests/packaged-assets.smoke.cjs` | Build/ASAR equality, exact multi-size application/installer PE icon resources, PNG equality and packaged runtime resources |

Runtime smoke requires ports 17890, 3000 and 3300 to be free. It uses a temporary
home/data/token, blocks upstream network access in its API test processes and
stops all owned children. It does not install NSIS, run the full packaged UI or
validate a real provider account. Build the Windows artifact first for
`--packaged`; see README for staging and packaging commands.

Windows uses the standard assisted installer with directory selection and a
finish-page launch checkbox. Cancel before installation follows stock NSIS
behavior, not a custom mid-extraction rollback. Windows uses a hidden title bar
with transparent native caption buttons and a reserved draggable top area. Its
symbols follow the visible theme; the original English menu is removed. After building, run
`node tests/window-menu.smoke.cjs` from Electron with Playwright installed or
`PLAYWRIGHT_MODULE` set. It checks the real built window with isolated user data
and blocked backend requests, including guide/system themes, native overlay
geometry, maximize/minimize APIs, mini-window restoration and tray close.
Run `node tests/frameless-mini.smoke.cjs` from Electron for the transparent
independent mini window, five toolbar actions, shared appearance preferences,
lock/pin/minimize, queue geometry and unchanged main-window/audio ownership.
Collapsed resizing is limited to 340-720 pixels wide and 168-320 pixels high;
optional time/equalizer content increases the minimum, and the queue adds 208
pixels. Bounds fit the display work area. Locking removes drag and resize grips
without disabling playback controls or the unlock button.
Mini lyrics use 1/3/5 centered slots according to available height. QQ QRC uses
word timing; NetEase and its cloud/local-matched lyrics use whole-line color.
Only overflowing active text moves with playback, not short or paused lines.
Native card corners must have alpha zero; no outside inset/shadow is retained.
On Windows also verify the native rounded region and absence of `WS_THICKFRAME`;
transparent renderer screenshots alone do not prove native corner clipping.
Normal adjacent lyric changes use a short transform transition; seek/track/layout
changes snap. The cover and actual image enlarge within 72-180 pixel outer
bounds, wide windows shift lyrics right, and lyric type uses fixed height-based
tiers. Buttons retain their dimensions. The real mini smoke checks these paths.
Songs with nonblank translations use one or three original/translation groups;
the translation is bounded to two lines and does not alter provider timing.
The native Windows mask preserves pixels intersecting the CSS curve, allowing
Chromium's antialiasing instead of hard clipping the smooth edge. Show/focus/
blur/restore refresh native clipping even at unchanged geometry. Run
`node tests/mini-native-corners.smoke.cjs` from Electron to compare real screen
edge colors with renderer alpha over a known test backdrop at radius 32.
Regenerate branding frames with `node electron/scripts/build-icons.cjs`; the
ICO contains nine sizes from 16 to 256 pixels. Windows may temporarily cache an
older installed shortcut icon; no Explorer/user-data cache is automatically deleted.
Mouse-driven dragging, double-click maximization and Windows snap gestures still
need manual verification.

Java uses a short application-specific directory under the current user's
standard OS temporary directory to avoid Windows JDK loopback-pipe failures
with long temporary paths. API temporary state remains under Electron user data.
This does not change the backend database, account or settings locations.

Browser acceptance needs an already-running web preview (`npm run serve` in a
separate terminal), Playwright and Microsoft Edge. Install the project's browser
test dependency locally or set `PLAYWRIGHT_MODULE` to an existing absolute
Playwright module path. Set `LYRICS_TEST_URL` to another loopback preview URL if
port 5173 is occupied. A missing dependency, unavailable server, failed browser
launch or assertion causes failure. These browser tests use synthetic tracks and
mock backend responses; they do not prove upstream account access or playback.
Screenshots are written to `electron/.playwright-cli/`.

Recovery tests create only synthetic temporary directories. In restrictive
Windows sandboxes, directory renames, junction creation or loopback connections
may be denied; run those tests with sufficient local permissions. A denial is a
failed verification, not a successful or skipped test.

## Offline Backup

1. Quit the app fully, including its tray icon. Stop the backend and QQ/NetEase
   API services, plus any Electron development processes. Do not restart them
   during backup or restore.
2. Choose a new backup directory outside both data roots. Ensure enough free
   space for the backup and, for restore, another full copy of current user data.
3. Run `node scripts/data-backup.cjs backup --archive G:/Backups/tiaolv-2026-10-09`.

The default roots are `%USERPROFILE%/.tiaolv-music` (backend) and
`%APPDATA%/调律音乐` (Electron). The archive is a normal directory with a versioned
`manifest.json`, relative paths, file sizes and SHA-256 hashes. It includes the
SQLite database and existing WAL/SHM/journal files together, backend settings,
Electron JSON settings and Local Storage/LevelDB preferences. It does not copy
music files from library folders or caches stored elsewhere.

Credentials, keys, cookies, local access tokens, QQ runtime authentication config
(`runtime/qq/config`, including `user-info.json`), browser sessions, caches and
logs are excluded by default. Database account identities and library/history
information remain personal data, so keep even the default backup private.
Do not mistake LevelDB `.log` files for application logs: they are required to
recover local preferences and are retained. Cached backgrounds, covers and audio
may need to be regenerated after recovery.

For an intentionally private backup with credentials, append
`--include-credentials`. The tool prints a privacy warning. Keep the entire
directory offline with access limited to its owner; never upload it to issue
trackers or source control. A credential-inclusive restore needs the same flag.

If Java's home or Electron's user-data location was customized, pass both paths
explicitly, for example:

```powershell
node scripts/data-backup.cjs backup --archive G:/Backups/tiaolv-custom `
  --backend-root G:/Private/.tiaolv-music `
  --electron-root G:/Private/electron-user-data
```

Custom backend roots must end in `.tiaolv-music`. Custom Electron roots must end
in `调律音乐`, `tiaolv-music-electron` or `electron-user-data`. Other destination
names, filesystem roots, home directories, overlaps, symbolic links and junctions
are refused. Custom roots are explicit authorization for those app data folders;
the tool never reads target paths from the archive manifest.

## Restore and Rollback

With all services still stopped, run:

```powershell
node scripts/data-backup.cjs restore --archive G:/Backups/tiaolv-2026-10-09
```

Use the same custom-root flags when needed. Before changing either target, the
tool checks every manifest entry and hash, stages complete replacements, and
checks that the app and service ports are still offline. It preserves existing
files that are absent from the backup, including excluded credentials and
caches. Database sidecars from the current database are removed from the staged
copy and replaced only by sidecars from the backed-up database snapshot.
Represented `Local Storage/leveldb` and `IndexedDB/*.leveldb` directories are
authoritative complete snapshots: existing files are removed only from their
validated staged copies before restoring the archived files. Old SST files,
journals and manifests are never mixed with the restored LevelDB snapshot.

Each original directory is renamed to a sibling `.rollback-<id>` directory.
The command prints both rollback paths. Keep these directories until the
restored app has been checked. If a root swap fails, the tool restores the
original targets; it never recursively deletes original user data. Interrupted operations
may leave `.partial-<id>` or `.restore-<id>` folders. They are incomplete and must
not be treated as finished backups. After a sudden shutdown during the swaps,
inspect the printed or sibling rollback paths before restarting the app.

For manual rollback, close everything again, verify both absolute app data and
rollback paths, rename the current restored folders aside, then rename each
matching rollback folder back to its original app data name. Do not merge
SQLite databases or their sidecars from different snapshots. Do not delete the
current restored folders until the rollback has been verified.

Default backups do not provide logged-in account sessions on a new machine.
Sign in again after restoring to a fresh profile. Existing credentials are
preserved when restoring over the same profile, but account/session state may
still require reauthentication.

## Manual Release Gate

- Install the packaged application on a clean Windows machine without Node,
  Java or Maven; verify all bundled services start and stop with the app.
- Confirm occupied backend/API ports produce a useful startup error and do not
  terminate another application's process.
- Play local audio and available QQ/NetEase audio; pause, resume, seek, change
  tracks, change output devices, and test unavailable or restricted tracks.
- Verify QRC/LRC lyrics, translation, seeking from a lyric, desktop lyrics and
  reopening the mini-player after its window closes.
- Drag mini-window edges/corners at both limits, including time/equalizer and
  queue modes. Check lock/unlock, appearance persistence, minimize/recovery,
  multi-monitor positioning and uninterrupted real audio when returning to main.
- Test sleep timer, tray close/quit, global shortcuts, media keys and restart
  persistence of settings, playlists and history.
- Disconnect the network during playback and data loading; inspect failure
  messages, cached results, recovery on reconnect and cache clearing.
- Switch accounts and providers; verify account-specific lists and cached data
  refresh correctly, including after sign-out and reauthentication.
- Perform a synthetic backup/restore rehearsal and a separate consented user
  recovery rehearsal before depending on the tool for irreplaceable data.
- Verify installer metadata, antivirus behavior, code signing and license/notice
  distribution for the bundled Java runtime and third-party API dependencies.

Passing source tests or mocked browser smoke tests does not certify clean-machine
installation, signing, third-party licenses, real account access or upstream
availability. Record the actual package version/artifact, OS, commands and manual
results for each release; leave unperformed gates explicitly unverified.

The backend HTTP transport does not automatically follow redirects, keeping its
private local API token out of redirect targets. NetEase audio redirect lookup
reads the original Location header. Remote cover/RPC endpoints that themselves
require redirects remain a compatibility item for real-provider acceptance.

## Local-First Product Scope

On 2026-10-10, the user cancelled independent app accounts, invitations and
activation. The desktop starts directly with the existing eight-page onboarding,
which may be skipped. QQ/NetEase login is optional and uses the existing local
provider credentials. Local music, preferences, playlists and history remain on
the device. See `docs/local-first-product-scope.md` for the current decision.

The unused independent identity module, generated output and its dedicated
instructions have been removed. No provider account or external user database
is deleted. Do not remove local access-token checks, loopback restrictions or
credential protection: those protect local data, not an app-registration gate.

The original migration inventory in
`docs/cloud-migration-boundary-audit-2026-10-10.md` is now a historical assessment,
not the current implementation roadmap.

Phase 1 now uses `electron/src/shared/backendRoutes.ts` in renderer, preload and
main: device and online routes have separate logical ownership, while both still
resolve to the same standalone loopback backend. No remote address setting or
app login has been enabled. The existing installer has not been rebuilt with
these phase 1 changes and is not a cloud-client artifact.

Phase 1 acceptance on 2026-10-10: 25 focused checks passed; the full frontend
runner passed 99 explicit test files plus script suites; all three TypeScript
projects, Electron production build and all three browser smoke suites passed.
Browser tests used mocked accounts/media. Preload and main IPC behavior tests
used synthetic files/network dependencies. The preview was initially offline;
only Vite on 127.0.0.1:5173 was started to complete browser acceptance. Backend
ports remained offline; no user services or database contents were changed.
No backend source was edited or backend test suite rerun in this phase.
Independent review found no actionable defects and reran 22 focused tests
successfully. VM/mocked checks do not certify Chromium redirect handling or
range playback against running services; real Electron networking and provider
playback remain unverified for these changes.

## Future Online Services

The existing installer still includes the local Java backend and both provider
workers. Removing unused app identity does not make it a cloud-client artifact,
and remote deployment is not a prerequisite for standalone release.

Any future shared public search or API-forwarding service requires a separate
design and acceptance for HTTPS, rate limits, credential handling and request
isolation. Provider login states must never be shared across clients. Local
paths, databases and the installation token must not be uploaded or embedded as
a common server credential. Remote outages must not prevent local playback.

The loopback filter remains intentionally unsuitable for public serving. Do not
disable it or expose ports 17890, 3000 or 3300 as a deployment shortcut.
