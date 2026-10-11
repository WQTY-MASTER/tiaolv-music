# GitHub Updates

The first updater-enabled Windows client is 0.1.1. Existing 0.1.0 installations
need one manual overwrite installation because they do not contain the updater
implementation. This is not solely a Windows registry limitation.

## Client Behavior

- The existing About settings entry checks public GitHub Releases.
- The startup preference checks only; it does not download or install.
- The user selects download, sees progress, then selects restart/install.
- Download/network/checksum errors keep a browser link to the project Release.
- Only the trusted main window frame can issue update commands.
- Before launching the installer, the app awaits cleanup of its owned local
  services. It does not stop a user's IDE or independently started services.
- Development builds and non-Windows platforms cannot download or install.

## Publishing a Version

1. Change `electron/package.json` to the new semantic version.
2. Build the application and Windows NSIS installer.
3. Publish a non-draft, non-prerelease GitHub Release tagged `v<version>` in
   `WQTY-MASTER/tiaolv-music`. The tag, package version, installer version and
   generated `latest.yml` version must agree.
4. Upload the generated `.exe`, `.exe.blockmap` and `latest.yml` together.
   These are the update assets; do not upload the staged runtime directory,
   private tokens, user databases or account cookies. Keep previous release
   assets available for differential downloads.

A code push alone does not publish a client update. Locally building with
`--publish never` creates the assets without releasing them. A client already
running 0.1.1 needs a higher published version to exercise a real upgrade.

## Integrity and Release Trust

electron-updater verifies the installer against the SHA-512 in release metadata
in the main process. Failed verification cannot enable installation. The
renderer never chooses an executable URL/path or performs the security check.
Differential download is attempted by the library, with full download fallback.

Hashes detect corruption or changes relative to trusted metadata; they do not
protect against an attacker who can replace both installer and metadata. Keep
the GitHub account and publishing credentials secure. Authenticode publisher
signing is an additional protection and requires a signing certificate; none
was introduced by this change. Never bundle a GitHub publishing token in the
client or disable TLS verification to work around connectivity problems.
