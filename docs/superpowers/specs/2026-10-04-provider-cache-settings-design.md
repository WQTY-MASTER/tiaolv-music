# Provider Cache Settings Design

## Scope

Add a dedicated Cache settings page for cover, lyrics, and online metadata caches. Audio streaming cache and offline-download management are out of scope.

## Behavior

- The default managed cache directory is `${user.home}/.tiaolv-music/cache`.
- Users can select another directory or restore the default directory.
- Cover, lyrics, and metadata writes are independently enabled and default to enabled.
- Disabling a category stops new writes. Existing entries remain readable until explicitly cleared.
- Cache entries are isolated by category, provider, and resource identifier. QQ Music and NetEase entries cannot collide.
- Lyrics entries contain LRC/QRC/YRC text, translations, format, source, and credits. Credentials and cookies are never cached.
- Metadata caching applies only to online provider lookups and never writes into local track tags.
- Statistics report managed cache bytes and entry counts by category.
- Clear cache deletes only the managed cache directory contents. Local music, playlists, account data, and offline downloads are untouched.

## Architecture

`ProviderResourceCache` owns persistent settings, hashed cache keys, atomic file writes, directory changes, statistics, and clearing. `OnlineCatalogService` wraps provider track, lyrics, and cover lookups with read-through caching. `LocalLyricsCache` delegates its software-cache storage to the same managed lyrics category.

`CacheController` exposes settings, updates, statistics, and clear operations. The renderer uses these endpoints and the existing native directory picker. The new Cache settings section presents the path, statistics, three switches, and a destructive clear action with an explicit confirmation.

## Safety

- Cache filenames are SHA-256 hashes of `category + provider + resourceId` and never use raw external identifiers as paths.
- Directory operations are normalized and limited to category subdirectories created by the cache service.
- Settings updates are persisted atomically.
- Moving the cache directory copies managed entries before switching and leaves unrelated files alone.

## Verification

- Unit tests cover default settings, provider isolation, disabled-write behavior, persistence, statistics, clearing, and directory migration.
- Service tests cover read-through reuse for metadata, lyrics, and covers.
- Controller and renderer contract tests cover the REST and UI surfaces.
- Run the complete Maven suite, Electron test suite, production build, and a Playwright visual/interaction pass.
