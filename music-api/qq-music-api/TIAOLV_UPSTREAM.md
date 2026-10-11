# QQ Music API Source Provenance

This directory vendors the QQ Music API source used by Tiaolv Music as normal
files in the main repository. It is not a Git submodule and does not require a
separate checkout to build the desktop application.

- Upstream: https://github.com/sansenjian/qq-music-api
- Upstream revision: `45d0d275b590d8c3f99270e7f74135873172c71a`
- Vendored on: 2026-10-11
- Upstream license: MIT; see [LICENSE](LICENSE).
- Additional third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The vendored tree includes Tiaolv-specific changes to QQ session handling,
favorites and playlists, recommendations, recently played reporting, QRC
lyrics, song normalization, API controllers, documentation, and regression
tests. These changes are maintained in the Tiaolv repository and are not
represented as upstream releases.

Install dependencies from `package-lock.json` and build through the root
runtime staging commands described in the main [README](../../README.md).
Local Git metadata, dependencies, generated output, and account configuration
are excluded from the main repository.
