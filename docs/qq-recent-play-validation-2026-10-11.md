# QQ Recent Playback Reporting Validation

## User Contract

The user approved one cloud report per real playback session after 30 accumulated seconds. Pauses, buffering and seeking do not qualify. No historical backfill, synthetic durations, favorite changes or history deletion were performed.

The renderer tracks cloud playback independently from local statistics. Opening QQ login or deleting local statistics does not create another cloud report for the same playback. Native audio `seeking` events reset the sampling anchor. Track completion, a new playback or account change starts a new session.

## Live Evidence

- Source: real QQ audio for `愿戴荣光坠入天渊`, MID `0034QXzv2ptMdw`, streamed and decoded in an isolated Edge browser.
- The existing active account and credential were read only. Credential values were not exported, printed or included in the evidence files.
- At `2026-10-11T15:51:51+08:00`, the shared sampler had observed 31 qualifying audio seconds in 32.093 wall-clock seconds. Duration was 232 seconds.
- Exactly one `music.musicasset.PlayRecentlyWrite.ReportPlayRecentlyInfo` request was sent. Request code was 0; response `ret` was 0; returned fields were `ret` and `timeList`.
- Fresh cloud read-back confirmed the song and current timestamp. Recent history now contains 2 songs instead of the earlier 1: the new target and `心月辞·长相望`.
- A separate later read-only diagnostic independently confirmed these two cloud songs with zero additional writes. Local statistics remained a separate, larger list; old tracks were not backfilled.
- Guard/evidence: `.test-tmp/qq-recent-live/attempt.json` and `result.json`. The verification script refuses a second run after its attempt marker exists.

The official protocol was first identified by read-only inspection of QQ Music 21.41's protocol DLL. Successful live read-back, rather than this static evidence or HTTP status alone, establishes cloud synchronization.

## Automated Verification

- Maven `package`: 286 tests, zero failures/errors/skips.
- Frontend verification runner: 112 deduplicated test entries passed.
- Electron Vue/main/preload typecheck and production build passed.
- Full browser acceptance passed, including QQ recommendations, lyrics layout/word timing and the new reporting workflow.
- Reporting browser fixtures exercise 30-second eligibility, pause time exclusion, small native seeks, repeated events, login-panel opening, local-stat deletion, confirmed history and a visible terminal 80105 failure. All backend calls in this fixture are intercepted; it cannot write to a real account.
- QQ core and MCP builds passed. Lint passed with zero warnings/errors. Documentation build passed.
- QQ full test run: 674 passed; two existing package-entry symlink tests fail with Windows `EPERM`. The same unrelated failures existed before this feature. No OS permission settings or unrelated tests were changed.
- Gateway/controller regressions cover original-session rejection, nested business errors, unsupported/unsafe IDs, one write for duplicate UUIDs, failure retention, malformed confirmation and bounded read-only propagation checks.
- Backend regressions cover captured-account ownership, credential-account mismatch, 30-second validation, confirmed-track mapping, error messages and preserved rate limiting without write retry.

Logs are under `.test-tmp/qq-recent-*.log`.

## Review and Scope

A read-only reviewer identified two edge cases before its review was interrupted by a usage limit: local-stat lifecycle could restart cloud reporting, and native small seeks did not reset QQ sampling. Both were independently reproduced with failing browser regressions and fixed; the expanded fixture now passes. No completed external-review claim is made.

Cloud failures are terminal for that playback; a fresh login does not silently replay an uncertain write. No durable retry queue is added. The gateway retains a bounded 24-hour in-memory deduplication cache; the renderer also enforces one attempt. Numeric-only imported song entries are explicitly unsupported rather than reported with a guessed type.

The live check validates the real source and QQ gateway. Java boundaries and renderer orchestration are validated with mocks. The user's installed application/services were not closed or replaced for testing; post-installation use of the final package remains a user-side acceptance step.

## Delivery

- Installer: `electron/release/调律音乐 Setup 0.1.0.exe`, built `2026-10-11 18:16:59 +08:00`, 185748758 bytes.
- Installer SHA256: `98B11D20F1A5BF08C3891F5E514DD0DD8CBEF41D86E3981A524263E1CD74C47C`.
- Staged backend SHA256: `1B1AE8280665A21306EB4379AB2B1CE862F47D9BBF18839FB77765EB397FD201`.
- Packaged-assets smoke passed: all 6 compiled app entries, PNG, 9 icon frames in app/installer, backend jar and all 187 QQ dist files match the final inputs.
- The installer is unsigned (`NotSigned`), consistent with the current development distribution.
- Completely exit the installed player, including its tray process, before overlay installation. Restart it afterwards so the new bundled services and renderer are loaded. No uninstall or data removal is required.
