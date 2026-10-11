# QQ Cloud Recent Playback Reporting

Approved by the user on 2026-10-11: report once per real playback session after 30 seconds, excluding pauses/seeks, refresh after verification, show failure without automatic write retry, and never backfill old records.

## Protocol Evidence

The installed official QQ Music protocol DLL (version 21.41, SHA256 `3C6FB5C1DCCD71B51531AE64CAD11FDA3594B99963345220FC8EF750E865BC0E`) constructs `music.musicasset.PlayRecentlyWrite.ReportPlayRecentlyInfo` with `data: [{id, type, lastTime, listenCnt}]`. The numeric resource ID is serialized as a string; song resource type is 2; `lastTime` is Unix seconds; `listenCnt` is one qualifying play. This is distinct from Web/Android listening telemetry. Read-back uses the existing `PlayRecentlyRead.GetPlayRecentlyInfo` song snapshot. Static protocol evidence is not proof of successful live synchronization.

## Data Flow

Reuse `QqListeningSession` real media/wall-clock sampling. Add a UUID and an independent recent-report status so local statistics retry never repeats a cloud write. At 30 seconds, lock reporting before issuing an asynchronous request. Capture account, track, actual listened seconds and duration. Pause, buffering, seeks and account changes remain excluded by the existing sampler.

Add `POST /account/qq/recent-play-reports`, with account ID, session UUID, track ID, listened seconds and total seconds. Java validates the active account and source before resolving a credential. A new provider method sends one request to the QQ API service. No credential is returned to the renderer.

The QQ service resolves a MID to its numeric catalog ID, verifies private reads with the original credential, and sends the official report once. Deduplicate concurrent/repeated requests by account and session UUID, reject a UUID reused for a different song, and retain failures as terminal results. Do not refresh/retry an uncertain write or use a renewed read ticket as write authorization. Generated timestamps represent the current qualifying playback, not a caller-supplied historical date.

Require upstream business success and bounded read-only confirmation of the numeric song ID and fresh `lastTime`. Return only confirmed cloud tracks. Missing/malformed confirmation is a visible failure, not simulated success. HTTP rate limits and login rejection remain distinct. Local statistics continue independently when cloud reporting fails.

## Presentation and Scope

Update the card/list and its account-scoped recent cache from the confirmed cloud snapshot only. Do not merge local ranking/history. Ignore UI updates from an account that is no longer selected. Show one failure notification per session. Existing NetEase scrobbling and all playlist/favorite behavior are unchanged.

No backfill of the existing 19 tracks, batch synthetic plays, official-client control, account deletion, credential export or automatic logout. Real-account validation may report only a newly observed qualifying real playback; otherwise report live validation as pending.

## Verification

TDD covers time threshold, pause/seek/buffering exclusion, one-shot status, duplicate writes, changed accounts, invalid song/duration, login/business/rate failures, delayed/missing read-back, and scoped cache/UI updates. Run focused tests, full Java/QQ/Electron tests, typecheck, builds and packaged-asset verification. Do not terminate the user's existing services to run isolated checks.
