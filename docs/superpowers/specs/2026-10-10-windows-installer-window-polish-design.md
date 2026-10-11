# Windows Installer and Window Polish

Later decision: `2026-10-10-integrated-window-titlebar-design.md` replaces the
native title-bar appearance choice below. The installer wizard scope is retained.

Approved scope: replace the one-click installer with the standard NSIS assisted
wizard and remove the main window's default English Electron application menu.

- Use `oneClick: false` and `allowToChangeInstallationDirectory: true`.
- Keep per-user installation as the default (`perMachine: false`).
- Keep the standard wizard's pre-install Cancel button and finish-page launch
  checkbox (`runAfterFinish: true`). Do not promise interruption or rollback
  during file extraction; retain the standard NSIS behavior.
- On Windows, call `Menu.setApplicationMenu(null)` before app readiness. Keep
  the native title bar, resize behavior and system window controls. Tray context
  menus and application keyboard shortcuts must remain available.
- Do not change backend services, app identity, data locations, version or
  playback. Uninstallation must not remove app data.
- Add focused regression tests, run frontend/type checks, rebuild Electron and
  the Windows installer, then update the artifact hash and verification scope.

Full NSIS installation, real-account playback and clean-machine acceptance are
separate manual gates. No real user data is modified by these checks.
