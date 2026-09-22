# Song Detail Cover Ambient Design

## Goal

Use the current cover artwork to create a soft, readable ambient gradient on the song detail page and its embedded bottom player. The ordinary player outside the detail page must remain unchanged.

## Design

- Sample the resolved cover image through a small canvas and derive two representative colors.
- Ignore transparent, nearly black, and nearly white pixels so borders and empty areas do not dominate the result.
- Blend extracted colors heavily with white to keep the page light and lyrics readable.
- Cache palettes by cover URL and ignore stale asynchronous results after rapid track changes.
- Fall back to the track's existing primary and secondary colors when no cover is available or canvas sampling fails.
- Apply the palette through CSS custom properties on the song detail root and the detail-only `PlayerBar` instance.
- Add an opt-in ambient variant to `PlayerBar`; the normal instance does not receive it and preserves its white background.

## Verification

- Unit-test palette softening and filtering helpers.
- Contract-test detail-only palette wiring and the opt-in player variant.
- Run the full test suite and production build.
