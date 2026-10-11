# Desktop Release Hardening

The user approved the release-readiness recommendations. Preserve the existing
player UI, accounts, music files and dirty worktree. No feature redesign, version
bump, automatic credential upload or changes to the music providers' behavior.

## Local Access

Bind the Java backend to loopback. Protect all application-data and mutation
routes with an installation-local random token, rejecting non-loopback clients
and unexpected Host/Origin headers. A minimal GET health endpoint can remain
public. Store the token outside the repo; never place it in a renderer bundle,
URL or log. Electron attaches it only to trusted application requests. File-page
Origin null is not authentication: it requires the same token. Web preview uses
a same-origin loopback Vite proxy with origin/fetch-site checks and server-side
token injection. Media range requests and cover images remain functional.

## Self-Contained Windows Runtime

Restore Maven's normal target directory. Stage a runnable Spring Boot jar, Java
21 runtime and the two music API runtimes/dependencies, with a deterministic
manifest consumed by Electron. Use Electron's bundled Node runtime for API child
processes. Services listen only on loopback. Start them before loading the main
window, wait for readiness with a timeout, reject occupied ports rather than
killing foreign processes, and stop only owned processes on exit/startup failure.
Log files live in user data and do not contain credentials. Build failures must
not produce a supposedly complete release. Keep developer entry points working
with verified protected services. Direct upstream API launch commands are not
protected application services and must not be reused automatically.

## Acceptance and Data Recovery

Unify existing offline frontend tests (including isolated commands), type checks,
backend tests and real browser smoke tests under documented commands. Do not
silently skip failures or treat a placeholder as e2e coverage. Provide offline
backup/restore tooling or a verified procedure covering backend data and Electron
settings, excluding credentials by default. Restore must preserve a rollback copy
and refuse unsafe destinations or running services. Verify with synthetic data.

## Verification Boundary

Run focused red/green tests before implementation, full offline tests, typechecks,
build/staging and an installed-runtime smoke check when possible. Do not claim a
clean-machine install, code signing or real account upstream availability unless
actually tested. Report environment/network limitations and remaining release
requirements explicitly.
