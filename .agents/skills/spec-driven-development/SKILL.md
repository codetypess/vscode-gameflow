---
name: spec-driven-development
description: Use the repository SDD workflow for non-trivial behavior, architecture, protocol, persistence, or test changes. Create or update work-item specs under `docs/spec/` before implementation and keep baseline specs synchronized when lasting rules change.
---

# Spec-Driven Development

This is the agent skill entrypoint for the repository SDD workflow.

Keep this file short. Detailed workflow rules live in [WORKFLOW.md](WORKFLOW.md) inside this skill directory.

## When To Use

- New user-facing features
- Non-trivial bug fixes
- Behavior changes in the extension, editor, runtime, webview, build, or save/reload flows
- Architecture, protocol, persistence, runtime ownership, or performance changes
- Refactors that change stable interfaces or module boundaries
- Tests that redefine expected behavior rather than only mechanics

## Command Entry

For non-trivial repository work, read this workflow first:

```text
.agents/skills/spec-driven-development/WORKFLOW.md
```

Then use these repository sources of truth:

- Workflow guide: `docs/spec-driven-development.md`
- Spec index and baseline map: `docs/spec/README.md`
- Work-item specs: `docs/spec/<short-slug>.md`

For bug fixes, also read [../bugfix-regression-testing/SKILL.md](../bugfix-regression-testing/SKILL.md). The default expectation is root-cause-first, with focused regression coverage whenever feasible.

## Canonical References

- Workflow: [WORKFLOW.md](WORKFLOW.md)
- Repository guide: [../../../docs/spec-driven-development.md](../../../docs/spec-driven-development.md)
- Spec index: [../../../docs/spec/README.md](../../../docs/spec/README.md)
