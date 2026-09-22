# Multi-provider Account Menu Design

## Goal

Add a user icon beside the existing settings control. Its dropdown shows NetEase Cloud Music and QQ Music at the same time, with independent login state and logout actions.

## Architecture

- Keep provider credentials in the Java backend's encrypted `CredentialStore`; never return cookies to the renderer or save them in browser storage.
- Add an account coordinator that lists all active provider accounts and dispatches provider-specific login/logout behavior.
- Keep NetEase QR login unchanged. QQ Music uses a pasted cookie, validates it against a configurable QQMusicAPI instance (default `http://127.0.0.1:3300`), extracts the account profile, and stores the cookie securely.
- Replace the single-account renderer state with an account list while retaining the NetEase account projection used by existing recommendation and playlist views.

## Interface

- The top-left user button uses a Lucide line icon and the same dimensions, color, focus, and hover treatment as the settings button.
- Clicking it opens a compact anchored dropdown with one row for each provider. Logged-in rows show avatar, nickname, and logout; logged-out rows show a login action.
- Clicking outside or pressing Escape closes the dropdown.
- NetEase login opens the existing QR modal. QQ login opens a cookie entry modal with a password-style multiline field and a clear privacy note.

## API

- `GET /auth/accounts` returns every active public account view.
- `POST /auth/qq/cookie` accepts `{ "cookie": "..." }`, validates the credential, stores it encrypted, and returns only public account fields.
- `POST /auth/{provider}/logout` removes only that provider's credential and active state.
- Existing NetEase QR endpoints remain compatible.

## Error Handling And Tests

- Blank or malformed QQ cookies return a client error without persistence.
- QQMusicAPI connection, expired-cookie, and profile-shape errors produce user-readable messages.
- Backend tests cover concurrent provider accounts, public response fields, QQ validation, and provider-specific logout.
- Renderer contract tests cover icon placement, two-provider menu content, provider-specific auth flows, outside dismissal, and shared control styling.

