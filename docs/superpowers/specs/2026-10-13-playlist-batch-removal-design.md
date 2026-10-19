# Playlist Batch Removal

## Approved Scope

- Add a batch toolbar to local playlist details, including local favorites, and aggregate playlist details.
- Provide row checkboxes, select all currently filtered rows, a selected count, remove, and exit batch mode.
- Confirm removal in an application dialog; cancellation changes no data. Do not use native confirmation dialogs or delete audio files.
- Aggregate removal follows the existing group semantics: remove the selected song with all of its sources, including sources hidden by the filter.
- Save changes before updating the visible list. Report success; on failure retain the list and selection and show a reason.
- Correct NetEase ordinary-song removal to `/playlist/tracks` with `op=del`, `pid`, and `tracks`. Preserve ownership checks and read-back verification.
- Return safe actionable removal errors. Keep account-change guards and retain failed streaming selections.

## Verification

- First reproduce the wrong NetEase removal route with an offline failing provider test and exercise the shipped gateway module.
- Test local custom playlists and favorites: select, filtered select-all, cancel, remove, failure, and reload persistence.
- Test aggregate merged sources, filtered select-all, cancel, remove, failure, and reload persistence.
- Test streaming single and multi-song removal, refusal without false success, and preserved failures.
- Run type checks and an Electron-window smoke test using isolated data. Do not write to real accounts or delete original files.

## Delivery

Deliver source changes for IDEA desktop testing first. Do not generate an installer or upload ZIP until the user asks again. A later upload will be marked beta, without changing GitHub or the website.
