# QQ Personalized Playlists

Approved by the user: QQ account recommendations plus local listening preferences;
public hot playlists remain an explicitly labelled fallback. No QQ play reporting.

## Data Flow

- Fix `/getPersonalRecommend` to derive UIN, login and authst from the request cookie.
- `QqMusicProvider` reads personalized playlist results first, checks RPC errors,
  and falls back to hot playlists on unavailable/empty results.
- Add optional recommendation source/reason to `HomepagePlaylist`, preserving
  existing constructors and consumers.
- In `AccountCatalogService`, combine the current account's last 30 days of
  QQ listening statistics and QQ favorites. Brief unqualified plays are ignored.
- A focused helper ranks artist/album terms; at most three terms are searched
  using the existing QQ playlist search. No hard-coded game/song preference.
- Interleave at most four local results into twelve total results, deduplicate
  playlist IDs, and retain provider recommendations on local failures.
- Account-scoped caches continue to isolate users; manual homepage refresh
  bypasses cached featured results. New statistics invalidate only featured
  playlist cache and the QQ homepage snapshot, not unrelated page data.
- The QQ playlist section labels account, listening-preference and hot results.

## Verification

Tests cover request identity, RPC failure/empty fallback, response variants,
account isolation, ignored brief plays, favorite influence, diversity, deduplication,
and local search failures. Run backend tests, frontend tests/typecheck, QQ API
build/tests, and browser checks on desktop and narrow viewports.
