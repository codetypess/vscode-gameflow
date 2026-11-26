# Internal Extension Distribution Baseline

Date: 2026-11-18
Status: Implementation baseline

原型工作台 (formerly GameFlow, extension ID `codetypes.vscode-gameflow`) packaging uses standard VSIX. Display-name changes preserve extension IDs, command IDs, configuration keys and document formats so existing installs upgrade in place. Each extension embeds a shared self-update client and reads `<package.name>/metadata.json` from the distribution server; users install one VSIX. The standalone internal updater is legacy and is not required. Document IO and editor behavior remain independent of update installation.

The initial origin is the provisional intranet HTTP endpoint `http://vsix.bitserver.wang`. Each extension reads its own `<package.name>/metadata.json`; the sibling `<version>.vsix` is the download target. Plain JSON metadata is Ed25519 signed; the client pins the public key and verifies package SHA-256 and manifest identity before installation. Signing keys never enter the public site or Git. Workspaces cannot override the update source or the user's automatic-check preference. Later HTTPS deployment must retain signature checks.

Release files are immutable. Upload and identity verification finish before per-plugin metadata is atomically replaced under a shared publication lock. Signed revisions increase across publications. Rollbacks require an explicit user action; ordinary polling only offers newer compatible stable versions.

Update checks run automatically after startup and every six hours, but each upgrade requires explicit installation confirmation before any VSIX is downloaded or installed. Closing the prompt or choosing later leaves the installed version intact. VS Code's global automatic-update setting cannot bypass confirmation. The owning extension exposes its own check and log commands, with an application-level preference to disable automatic checks.

The self-update client only checks its owning extension, uses the user's automatic-check preference, and preserves metadata revisions and pending installs across restarts. Startup and periodic checks require no enrollment or companion extension. It does not reload windows, enable disabled extensions or install unrelated plugins. Remote windows and development extensions are excluded from installation in v1. Installation uses VS Code's command and respects its trust/policy prompts. Per-plugin metadata, publication and verification are defined in [embedded-extension-updates.md](embedded-extension-updates.md); the old catalog remains only for download listings and legacy compatibility.

Deployment and release commands are maintained in the publishing tools README; current implementation and verification are recorded in [embedded-extension-updates.md](embedded-extension-updates.md). Earlier standalone-updater work items retain historical evidence only.
