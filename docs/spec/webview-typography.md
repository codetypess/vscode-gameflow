# Webview Typography

Status: Done
Date: 2026-11-23
Scope: GameFlow workbench and PSD editor interface text

## Context and current behavior

The Webview body already reads VS Code typography, but fixed sizes on tree rows, forms, dialogs and shared controls override it. In the reported workspace, the Explorer uses 13 px while the Prefab sync node names use 11 px.

## Design and implementation

Use `--vscode-font-family`, `--vscode-font-size` and `--vscode-font-weight` as the inherited interface defaults. Use 13 px, a platform UI font stack and normal weight in the standalone browser. Interface controls and labels follow the base size. Larger headings and compact annotations scale with the base font. Technical values can use the VS Code editor font family. Canvas artwork and exported content continue to use the document typography.

Remove local size overrides in the workbench, PSD workspace, settings and sync dialogs, including Tailwind classes in shared controls. Keep fixed-size font declarations scoped to artwork placeholders and graphical marks.

## Verification and acceptance criteria

- Node names, input values, field labels, command text and sync controls compute to 13 px in the standalone preview and follow changes to the simulated host font variables.
- Workbench and PSD tree rows and controls fit their default layouts. Existing narrow inspector and sync interaction tests pass.
- A canvas text node retains its document-defined size when the interface font changes.
- The production build and shared test suite pass.

The installed VS Code Webview host exposes all three CSS variables and supplies a default size of 13 px. Chrome computed-style checks covered the 13 px fallback, a simulated 15 px host font, and a 32 px document text node. Chrome regressions passed for the narrow inspector, PSD startup, PSD synchronization and Prefab synchronization. The production build and all 379 shared tests passed.
