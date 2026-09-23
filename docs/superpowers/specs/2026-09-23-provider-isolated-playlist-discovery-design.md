# Provider-Isolated Playlist Discovery Design

## Goal

Add a QQ Music curated-playlist section below the two QQ ranking cards. Its "发现更多" action opens a QQ-only discovery page that shares the NetEase discovery page layout but never shares provider data or view state. Playlist cards from both surfaces continue to open the existing streaming playlist detail template.

## UX

- QQ home shows up to 12 curated QQ playlists beneath the ranking cards.
- The section title is "把喜欢，听成一张歌单", with "CURATED PLAYLISTS" as supporting text and a top-right "发现更多" action.
- QQ discovery reuses the existing discovery grid, filters, sorting, paging, loading and error presentation.
- QQ discovery omits the NetEase-only high-quality mode.
- Switching providers restores that provider's own category, sort, page, results and loading state.
- Playlist selection routes through the existing streaming playlist detail page.

## Data Boundaries

- Catalog discovery endpoints accept an explicit `provider` query parameter and default to NetEase for compatibility.
- QQ discovery data is sourced from the local QQMusicAPI `/getRecommend` response.
- QQ home curated playlists use `response.recomPlaylist.data.v_hot`.
- QQ discovery uses `response.playlist.data.v_playlist`, while category metadata comes from `response.category.data.category`.
- Every QQ playlist ID is prefixed with `qq:` before it reaches the renderer.
- NetEase discovery requests and cached UI state remain independent and unchanged.

## Error Handling

- Home recommendations can fail without hiding rankings or daily recommendations.
- Discovery failures stay scoped to the currently selected provider.
- Empty pages preserve the existing discovery empty/error treatment.

## Verification

- Backend tests verify provider routing and QQ response mapping.
- Renderer contract tests verify QQ-only placement, provider-aware requests and navigation.
- The Electron production build must complete.

