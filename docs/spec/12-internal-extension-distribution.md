# Internal Extension Distribution Baseline

Date: 2026-11-18
Status: Implementation baseline

GameFlow packaging uses standard VSIX. Internal distribution is independent of editor activation and document IO. The shared publishing tools and standalone `codetypes.internal-updater` manage extension IDs and immutable versions; business extensions do not embed update clients.

The initial endpoint is the provisional intranet HTTP origin `http://vsix.bitserver.wang`. Catalogs are Ed25519 signed; the updater pins the public key and verifies package SHA-256 and manifest identity before installation. Signing keys never enter the public site or Git. User-level server configuration cannot be overridden by workspaces. Later HTTPS deployment must retain these signature checks.

Release files are immutable. Upload and identity verification finish before a signed catalog is atomically replaced under a shared publication lock. Catalog revisions increase across all publishers. Rollbacks require an explicit user action; ordinary polling only offers newer compatible stable versions.

Update checks run automatically, but every detected upgrade batch requires the user's explicit installation confirmation before any VSIX is downloaded or installed, including updater self-upgrades. The default mode is prompt; legacy automatic-install settings migrate to prompt, while paused checks remain paused. VS Code's global automatic-update setting cannot bypass this confirmation. The current interaction contract and verification are recorded in [internal-extension-update-prompts.md](internal-extension-update-prompts.md).

Only extensions explicitly enrolled in the current Profile are managed. The updater does not reload windows, enable disabled extensions or automatically install catalog additions. Remote windows and development extensions are excluded from automatic installation in v1. Installation uses VS Code's command and respects its trust/policy prompts.

Deployment, release commands, operational boundaries and verification evidence are maintained in [internal-extension-updates.md](internal-extension-updates.md) and the publishing tools README.
