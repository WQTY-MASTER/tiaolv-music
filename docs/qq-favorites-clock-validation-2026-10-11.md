# QQ Favorites and Lyric Clock Validation

Date: 2026-10-11 (Asia/Shanghai).

## QQ Recent Playback Diagnosis

- Read-only inspection of the active account returned `GetPlayRecentlyInfo` request code 0 without a login refresh. The cloud snapshot contains exactly one song: `心月辞·长相望`, MID `000bjZqH448qnK`. This agrees with the user's recent-play card.
- The same account's local QQ statistics contain 19 distinct songs, 36 qualifying plays and about 7,265 seconds of listening. No account write, history deletion or credential replacement was performed.
- The library card reads `/account/qq/recent-tracks`, which calls `PlayRecentlyRead.GetPlayRecentlyInfo`. QQ playback only submits local `listening-stats`; the renderer's cloud scrobble path is restricted to NetEase, and `QqMusicProvider` does not implement scrobble. Thus cloud reads work but QQ playback is not reported back to cloud history.
- The official [Web player script](https://y.qq.com/ryqq/js/player.chunk.b14b319972b31bec62da.js) contains `cgi_music_webreport.fcg` listening telemetry. This alone does not establish that it updates `GetPlayRecentlyInfo`; no speculative account write was sent.
- Tencent's [recent-play reporting documentation](https://cloud.tencent.com/document/product/1081/67456) describes an IoT SDK with its own OAuth authorization, not a drop-in Web-cookie endpoint. It was not substituted into the project without protocol verification.
- QQ official recent-play synchronization remains **not implemented or verified**. Local records must not be merged into the cloud card as purported synchronization. Re-login or reinstall cannot supply the missing reporting implementation.
- Repeat this read-only check with `node scripts/inspect-qq-favorite-readonly.cjs --inspect-recent`. It reads the account credential only in memory, outputs no ticket values and rejects Musicu Write modules.

## Session Repair Installer Verification

- Latest installer: `electron/release/调律音乐 Setup 0.1.0.exe`, built 2026-10-11 15:03:40 +08:00, 185715948 bytes.
- SHA256: `EC13EAB885371934F24E87F86B95925A74D1B67570EA4D248B692D40F686A236`. Authenticode: NotSigned.
- Java package verification: 280 tests, zero failures/errors/skips. Electron frontend acceptance: all 102 deduplicated test files plus script tests passed. Typecheck and production build passed.
- QQ API build, lint and docs build passed. Full QQ tests: 661 passed, two unchanged Windows file-symlink `EPERM` failures; 31 focused session/favorite tests passed.
- Packaged-assets smoke passed: current renderer/main/preload assets, exact app/installer icon frames, backend jar, validated runtime and all 185 QQ dist files match. Signing-library files and license were also compared with the source dependency.
- Packaged runtime smoke was not rerun: the user's services occupy ports 3000, 3300 and 17890 and were not stopped. New-installer first-use behavior has not been verified by replacing the user's installation.
- This installer contains session/favorite safeguards. It does **not** add QQ official recent-play synchronization.

## Same-Installer Recovery and Session Repair: 14:58 +08:00

- The user freshly logged into the official website and added the original target successfully; it appeared in the official favorite list. This establishes working Web write access for a fresh session, not just desktop access.
- The user then logged out/in inside the existing installed app, without reinstalling or updating its service files. Private reads immediately returned code 0, with no renewal needed.
- The user added `远航星的告别` through that same installed app. A complete read-only snapshot confirmed MID `0038W0WD0TlByu` in the remote favorite list, as well as the original website-added target. No agent account mutation was performed in this follow-up.
- This isolates the reported installed failure to the old session rather than proving packaging broke the write interface. A read-only renewal had not established Web write capability. The exact general meaning of 80105 is still not asserted.
- Favorite preflight/write now explicitly use the original Web-issued credential, not the in-memory renewal cache. Explicit expiry stops before a mutation and is passed through as a login-required error. Existing non-favorite renewal remains unchanged. Regressions were observed failing before this change, including the cached-read-session case.
- QQ QR exchange now validates HTTP success, both business codes, account ID and music ticket before returning `isOk: true`. Four failure cases previously returned success; regression tests captured the failure before the repair. Multi-cookie responses retain complete values, including base64 padding.
- The Java account service now preserves the provider's specific login-expired reason instead of replacing it with a generic prompt. Its regression also failed before repair.
- Focused login/session/favorite checks: 31 passed. QQ build/lint passed; latest full QQ tests: 661 passed, two unchanged Windows file-symlink EPERM failures. Backend package succeeded. No user process or stored credential was modified by diagnostic tools.
- A new installer will carry these session-handling changes; packaging validation is recorded below when completed. Recovery by fresh login is verified separately from the new installer's first-use behavior.

## Follow-Up Investigation: 14:27 +08:00

The favorite write is still **not fixed**. No new installer is presented as a successful fix.

- The stored QQ ticket returned 1000 from private favorite-status/recent-play reads, while the public favorite directory remained readable. An explicit login refresh returned a matching account ticket; the private reads then returned code 0.
- A new preflight validates `SongFavRead.IsSongFanByMid` (or `IsSongFanById` for imported numeric entries) before a favorite mutation. Authentication refresh happens through this read, malformed/authentication-failed responses do not cause a write, and already-matching favorite state is a no-op.
- Added the pinned MIT dependency `@jixun/qmweb-sign@2.0.3` for the official `u6.y.qq.com/cgi-bin/musics.fcg`, text/plain, ag-1 transport. It is enabled only for favorite reads/writes. Existing non-favorite transports are unchanged. The staged runtime includes its code and license.
- Session-preflight test: exactly one newly authorized add returned 80105; favorite count 5/5, target absent, existing favorites retained. The exclusive marker is `result-session-fix.json`.
- Encrypted-transport test: exactly one separately authorized add returned 80105. Captured operation sequence: private read 1000, Login 0, private read 0, AddSonglist 80105, directory read 0. Count 5/5, target absent, existing favorites retained. Marker: `result-ag1-fix.json`.
- Official SDK baseline: the user separately authorized one addition through the current official browser SDK. The SDK received code 0 from private authentication and then 80105 from AddSonglist, using the official minimal parameters (no tid/bFmtUtf8). Read-back again showed 5/5, target absent, all existing favorites retained. Marker: `result-official-sdk.json`.
- The baseline rules out the hypothesis that merely replacing the local plaintext transport or removing extra write parameters resolves this session's rejection. It does not prove the meaning of 80105, an account-wide restriction, or that the official desktop client cannot write. Account writes stopped after the failed official baseline.
- Asked for a new-session comparison by signing into the official QQ website and attempting the same favorite action. Do not declare the favorite fixed or ship the partial changes as proof of success before that comparison and successful read-back.
- Latest checks: 36 focused transport/favorite/session tests passed; QQ build and lint passed; docs build passed; full QQ test run 654 passed, 2 unchanged Windows symlink EPERM failures. Electron favorite regressions (2 tests), typecheck and production build passed. Staged runtime validation passed. No user process, stored account or credential file was changed.

The sections below retain the earlier partial-build results and installer identity for audit; they are not a new successful favorite validation.

## Implemented

- The QQ library synthesizes the existing `account-favorites` presentation only when the remote playlist response omits its favorite directory. It uses the actual account favorites, does not create a remote playlist, and does not duplicate a real favorite entry.
- Favorite mutations are guarded per track. A pending add cannot become a removal when the heart is clicked again. Failures restore the previous flag and show the actual error in a visible toast.
- QQ favorite gateway failures are not automatically retried by Java. Explicit login rejection and HTTP rate-limit categories remain distinct. Other favorite failures return HTTP 502 with `FAVORITE_WRITE_FAILED` and the provider message, instead of an unhandled generic 500.
- `PlaylistDetailWrite` includes `tid: 0`, `bFmtUtf8: true`, and the resolved numeric song ID/type. Web GTK computation now follows the official SDK's separate legacy/modern cookie precedence; the non-Web login contract is unchanged.
- The lyric clock cannot lead the audio element by more than 150 ms. Buffering freezes interpolation, while seeks, pauses and resumed audio calibrate immediately. QQ QRC timing and NetEase line highlighting remain distinct.

## Account Verification: Not Successful

Exactly one authorized addition was attempted for `0034QXzv2ptMdw` (愿戴荣光坠入天渊). No removal was performed.

- HTTP status: 200; outer code: 0; request code: **80105**; inner retCode: 0.
- Favorite count before/after: 5/5. The target was absent afterward; all pre-existing favorite IDs/types were retained.
- Therefore `retCode: 0` is not sufficient proof of success. The favorite-write issue is **not resolved**.
- The verification script creates an exclusive marker before writing and refuses a second execution. `--inspect-auth` only reads field presence and ticket equality; it makes zero network requests and never prints ticket values.
- The user confirmed that the official QQ client can add favorites. This establishes that the account has working favorite access in that client, not that the same Web credential/request is equivalent.
- Read-only inspection showed the current user's tickets produce the same GTK values before and after the corrected precedence. The correction is valid but is not evidence that it fixes this particular 80105 response.

The official public [shared module](https://y.qq.com/ryqq/js/common.chunk.ddca9cfefd825f4a733d.js) calls the same `PlaylistDetailWrite/AddSonglist` method. The [Web SDK](https://y.qq.com/ryqq/js/vendor.chunk.d8b4489cbdb338cb0470.js) separately computes the two GTK values and includes a newer `encoding: ag-1` encrypted transport path. The local API currently uses plaintext JSON with a zzc signature. Whether this transport difference explains 80105 still requires verification; no automatic alternative write was attempted.

Official QQ recent-play reporting is also **not implemented or verified**. Existing local listening statistics must not be represented as official cloud synchronization.

## Verification

- Java: `mvn -q package`, 279 tests, zero failures/errors/skips.
- Java favorite regressions were observed failing before the single-attempt/error-mapping repairs, then passing afterward.
- Electron: complete `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:qq-favorites` passed.
- Browser smoke: fallback playlist, real favorite detail, actual heart clicks, one mocked write, visible 80105 toast, preserved existing state; no real account requests.
- Native mini smoke: transparent corner pixels/region, cover up to 180 px, translations, responsive rows, smooth intermediate frames, immediate seeks, QQ word/NetEase line highlighting and window tools passed.
- First-open native corner smoke: five entries at 720 x 320, 31 px radius, plus small/large/pin-off transitions passed against a known screen backdrop.
- QQ API: build and lint passed. Full test result: **645 passed, 2 failed**. Both failures are Windows `EPERM` creating file symlinks in CLI/MCP package-entry tests. These failures were not suppressed or changed. The focused favorite/GTK tests passed (20 tests).
- Packaged assets: six current build entries, exact PNG/ICO resources, backend jar, and all 185 QQ dist files matched the staged outputs.
- Packaged runtime smoke: 12 HTTP health/access/origin checks passed using isolated data and blocked upstream access. All three owned processes exited and their ports were released. No running user service was stopped.

## Installer

- File: `electron/release/调律音乐 Setup 0.1.0.exe`
- Built: 2026-10-11 13:18:47 +08:00
- Size: 185692451 bytes
- SHA256: `1E69E34CE218281A0F234DEBD06512F91023B4A9B346DAF74CD278405573C146`
- Authenticode: NotSigned. This is a partial-fix build, not proof of successful QQ favorite writes or official recent-play synchronization.

For IDEA, stop and rerun the project to load the new Java classes; restarting the IDE itself is unnecessary. A separate QQ API process must also be restarted to load its rebuilt dist. For the installed app, fully exit the app and its tray instance before installing over the existing directory; account/library data are not deleted by this installer configuration.
