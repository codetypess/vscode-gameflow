# Specification-Driven Development Workflow

SDD means Specification-Driven Development in this repository. For any non-trivial feature, bug fix, refactor, architecture change, protocol change, persistence change, performance change, or large test change, write or update the relevant specification before implementation.

The goal is simple: make the intended behavior, design trade-offs, tests, and acceptance criteria explicit before code starts drifting.

## When To Use SDD

Use SDD for:

- New user-facing features
- Behavior changes in the extension, editor, runtime, webview, build flow, or save/reload flows
- Architecture, protocol, persistence, runtime ownership, build, or performance changes
- Refactors that change module boundaries or stable interfaces
- Bug fixes where the expected behavior is ambiguous or the fix may affect nearby flows
- Test changes that redefine expected behavior rather than only updating mechanics

An SDD is optional for tiny mechanical changes such as typo fixes, comment-only edits, or narrow renames that do not change behavior. If a tiny change grows during implementation, add an SDD before continuing.

## Document Locations

- SDD workflow guide: `docs/spec-driven-development.md`
- Spec index and baseline reading order: `docs/spec/README.md`
- Work-item specifications: `docs/spec/<short-slug>.md`
- Baseline specifications: numbered files registered in `docs/spec/README.md`

Use lowercase kebab-case slugs for work-item specs, for example `docs/spec/save-lifecycle-regression.md` or `docs/spec/editor-selection-regression.md`.

## Baseline Specs vs Work-Item Specs

The `docs/spec/` directory contains two kinds of specifications:

- Numbered files such as `01-product-scope.md` or `10-architecture.md` are long-lived baseline specs.
- Non-numbered kebab-case files are work-item specs for concrete changes.

When a change affects an existing rule, model, boundary, or user-visible behavior:

1. Create or update the work-item spec.
2. Update the affected numbered baseline spec in the same change when the new behavior should become the new baseline.

If the project does not yet have the required baseline, create only the smallest useful numbered spec and register it in `docs/spec/README.md`. Do not copy another project's architecture into this repository by assumption.

## Status Flow

Each work-item spec starts with a status line.

- `Draft`: scope and decisions are still being shaped
- `Approved`: ready for implementation
- `Implementing`: code is being changed against this SDD
- `Verifying`: implementation is complete and checks are running
- `Done`: accepted and complete
- `Superseded`: replaced by another SDD

Do not treat the SDD as frozen. If implementation reveals a better decision, update the SDD first or in the same change so the document remains the source of truth.

## Default SDD Process

1. Define the problem, current behavior, desired behavior, and non-goals.
2. If the task is a bug fix, follow `.agents/skills/bugfix-regression-testing/SKILL.md`, identify the root cause before attempting a fix, and plan focused regression coverage. Do not patch by blind trial-and-error.
3. Read `docs/spec/README.md` and identify which numbered baseline specs are affected.
4. Create or update a work-item spec under `docs/spec/`.
5. Make design decisions explicit, including rejected alternatives when they matter.
6. Break the work into implementation phases with exit criteria.
7. Implement against the SDD and keep the document synchronized with code changes.
8. Verify against the acceptance criteria before marking the SDD `Done`.

## Required Sections

Use these sections unless a task is truly small.

```markdown
# <Work Item Name>

Status: Draft
Date: YYYY-MM-DD
Scope: <short boundary>

## 1. Context

What exists today, why the change is needed, and what constraints matter.

## 2. Goals

The outcomes this work must achieve.

## 3. Non-Goals

The tempting things this work intentionally will not do.

## 4. Current Behavior

The relevant current user behavior, technical behavior, and known gaps.

## 5. Proposed Behavior

The target behavior from the user's point of view and from the system's point of view.

## 6. Design

Key architecture, data model, protocol, UI, persistence, or performance decisions.

## 7. Implementation Plan

Phases or steps, each with clear exit criteria.

## 8. Testing Plan

Automated tests, manual checks, fixtures, performance checks, and regression areas.

## 9. Acceptance Criteria

Concrete checks that must be true before the work is complete.

## 10. Risks and Rollback

Risks, mitigations, and how to back out safely if needed.
```

## Acceptance Criteria Rules

Acceptance criteria should be observable. Prefer statements like:

- Running the repository's validation command succeeds.
- Saving a document clears its dirty state and persists the expected data.
- Reloading the extension restores the last persisted state.

Avoid vague criteria like:

- The implementation is clean.
- Performance is good.
- The architecture is better.

If performance matters, name the flow, workload, threshold, and validation method.

## Implementation Rules

- Start from the SDD before broad code changes.
- For bug fixes, follow `.agents/skills/bugfix-regression-testing/SKILL.md`, confirm and record the root cause before implementing the fix, and add focused regression coverage whenever feasible. Do not rely on speculative patch attempts as the primary workflow.
- Keep implementation scoped to the SDD unless the user explicitly expands the task.
- Update the SDD when scope, behavior, or design decisions change.
- Update the affected numbered baseline spec when the change becomes the new lasting rule.
- Add or update tests in the same change when acceptance criteria depend on them.
- Record known follow-ups in the SDD instead of silently widening the current task.

## Review Checklist

Before considering SDD-based work complete, verify:

- The work-item spec status and scope match the implemented change.
- Goals, non-goals, and acceptance criteria are still accurate.
- Tests or manual checks map back to the acceptance criteria.
- The affected numbered baseline specs are updated when the lasting behavior changed.
- Any deferred work is explicit and does not hide a broken acceptance criterion.
