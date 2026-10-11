# Cloud Client Request Boundary: Phase 1

Date: 2026-10-10.
Status: user approved phase 1 scope on 2026-10-10; implemented and verified with
automated regression checks. Real-network acceptance remains unverified.

## Confirmed Product Decisions

Updated product decision on 2026-10-10: the desktop and its loopback services own
local music, playback, preferences and provider credentials. No independent app
registration, invitation or activation is required. QQ/NetEase login is optional
and local. See `docs/local-first-product-scope.md` for the current scope.

This phase implements only the client request boundary. It does not implement
registration, authentication, public serving or migration of existing data.

## Approach

Retain the current Java-backed local library and the standalone desktop runtime.
Introduce a small shared module defining the existing loopback origin and the
logical ownership of application routes. Use it from renderer, preload and
Electron main where those layers currently duplicate backend URL decisions.

Alternatives considered in the source audit were rewriting all local services
in Electron, or running separate full server stacks per user. Neither is needed
for this phase; both add work beyond the approved local/cloud responsibility
split. No new backend framework, dependency or user-facing settings are needed.

## Route Ownership

| Paths | Logical owner | Transport in this phase |
| --- | --- | --- |
| `/library`, `/playback`, `/cache` and their subpaths | Device | Existing loopback backend / trusted preview proxy |
| `/auth`, `/account`, `/catalog` and their subpaths | Online service | Existing loopback backend / trusted preview proxy |
| `/health` | Device health | Existing loopback backend / trusted preview proxy |

Only exact root paths and slash-delimited children match. `/accounting` is not
an account API. Parse the pathname separately from query/fragment; a value in a
query must never decide ownership. Do not classify arbitrary external URLs as
application APIs merely because their paths resemble a known route.

Unknown legacy relative resource paths retain their existing standalone URL
resolution without being declared online routes. Future remote mode must reject
unknown routes by default; this phase must not silently invent remote ownership.

`/library/tracks/{id}/lyrics/match` remains a device-owned orchestration request.
Any future remote dependency requires a separate design; local cache and
sidecar writes remain on the device.

## Integration Scope

### Renderer API

Keep existing exported API names, data contracts, cancellation, timeout handling,
HTTP status handling and page-cache invalidation. Make local versus online
request ownership explicit behind the existing callers, without rewriting views
or the playback state machine. Existing `/auth` routes are optional provider
login routes, not a separate app-registration or activation system.

Special paths that bypass the generic JSON helper also participate in the
boundary: current-account reads, catalog audio URL creation, and resource URL
resolution. Do not change the 204/404 current-account behavior or introduce a
JSON expectation for media responses.

### Preload and Main

Preload library/playback/health remain device-owned; preload catalog search is
online-owned but still uses the same standalone transport. Cloud upload targets
the online service logically, while file selection and reading remain local.
Main-process cover/download requests distinguish an exact application origin
from third-party resources, preserving their existing authorization rules.

The local token stays in main/server-side proxy handling. Do not add token access
to preload or renderer. External redirects and CDN requests must never inherit
the local token. Do not alter navigation restrictions or introduce a second
webRequest listener that overwrites the existing listener.

### Preview and Runtime

Browser preview continues using its trusted same-origin `/backend` proxy for
both logical owners. Packaged desktop continues using the existing loopback
backend. Preserve query parameters, media URL resolution and external resource
URLs. Keep the three-service runtime, staging manifest and installer resources
unchanged until a cloud-capable local-library runtime is separately ready.

## Explicit Non-Goals

- No runtime remote URL switch, remote-address UI or cloud-client installer yet.
- No app login UI, registration endpoint, invitation issuance or password store.
- No disabling the loopback filter, widening CORS or exposing service ports.
- No account/database migration, automatic credential import or user-data reset.
- No library/history/settings synchronization or new background uploads.
- No change to existing lyrics, recommendations or playback behavior.

## Current Provider Boundary

The previous independent-account and invitation plan has been cancelled.
Provider credentials and QR sessions remain on each device. The existing
installation token continues to protect local interfaces and is never a shared
server credential. Both route owners currently use the same loopback transport.

If a shared online service is proposed later, design credential handling,
request isolation, HTTPS and rate limits separately before enabling it. A public
API must not reuse the current globally active provider account or session files.

## Verification

Focused tests must establish route ownership and standalone compatibility before
the integration changes. Cover exact prefixes, query/fragment handling, false
prefix matches, both owners' URLs and unclassified legacy resource handling.

Integration tests exercise local library, online search/accounts, catalog audio,
local covers, external covers and current-account 204/404. Check that token values
remain absent from renderer/preload requests and external requests. Verify that
existing range/media behavior and preview proxy protection are unchanged.

Run the full frontend/script suite, all three TypeScript projects and production
build. Run existing QQ recommendation and lyric browser smoke tests. These
checks use synthetic data and do not require server credentials or stopping the
user's current services. Backend source remains unchanged in this phase.

Acceptance means explicit local/online ownership with unchanged standalone
behavior and passing regression checks, not a publicly deployable service.

Implementation acceptance passed on 2026-10-10: focused tests, the full
frontend/script suite, all three TypeScript projects, production build and
three mocked browser smoke suites. Independent review found no actionable
defects. See `docs/release-checklist.md` for results and verification limits.

## Implementation Safety

Preserve all existing dirty-worktree changes. Limit code edits to the shared
boundary, its actual integration points and focused tests. Do not commit, reset,
restart services or edit real user data as part of this phase. Server/domain/
credential requests are deferred to the later deployment phase.
