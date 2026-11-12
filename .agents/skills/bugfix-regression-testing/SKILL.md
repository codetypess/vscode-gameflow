---
name: bugfix-regression-testing
description: >-
  Use when diagnosing or fixing a bug, regression, crash, or runtime error in
  GameFlow. Establish the root cause with evidence before changing behavior,
  then add the narrowest practical regression coverage for that cause.
---

# GameFlow Root-Cause Bug Diagnosis

Use this skill for every bug, error, crash, and regression. Also use SDD when the issue is non-trivial.

The primary objective is to establish the root cause with evidence. Regression tests support root-cause validation and prevent recurrence, but they do not replace diagnosis.

## Hard Gate: Confirm the Root Cause First

Before changing behavior, be able to answer:

- What symptom does the user observe?
- Which inputs, states, and actions trigger it?
- Which spec, contract, or confirmed requirement defines the correct behavior?
- Where does the data flow or control flow first diverge from the correct state?
- Why does it diverge there? Which invariant, ownership rule, or lifecycle assumption is violated?
- What evidence rules out nearby but incorrect explanations?

"Nothing happens after clicking," "the state does not synchronize," and "the message is not received" are symptoms. "Adding a null check stops the exception" only bypasses a trigger. A root cause must identify the specific mechanism that creates the invalid state.

If there is only a hypothesis, label it as a root-cause hypothesis and keep validating it through reproduction, logs, breakpoints, call traces, a minimal test, or revision comparison. Do not make a series of speculative code changes to see what happens.

## Diagnostic Workflow

1. Establish the expected behavior. Read the relevant work-item, baseline spec, and stable contract. `docs/planning-workbench.md` is currently a product proposal, not an automatically binding implementation contract.
2. Build the smallest reproduction. Record the environment, input, initial state, action sequence, and actual result. Reduce below the UI symptom when a lower-level reproduction is possible.
3. Trace the real data flow and control flow to find the last correct state and the first incorrect state.
4. Identify the state owner and responsibility boundary. Validate the root-cause hypothesis instead of stopping at the final line that throws.
5. Fix the source that creates the invalid state. Add downstream contract validation or error reporting only when the source cannot be handled at its owning boundary.
6. Verify the original reproduction and adjacent critical paths to confirm the fix did not move the failure elsewhere.

When the user asks only for diagnosis, provide the root cause, evidence, and proposed fix without changing code. When the user explicitly asks for a fix, complete the fix and verification after confirming the root cause.

## GameFlow Diagnostic Boundaries

Inspect only the boundaries relevant to the symptom:

- **Extension host and Webview**: message contracts, initialization order, editor lifecycle, stale sessions, and state ownership.
- **Unified document model**: whether page relationships, the control tree, canvas, and property panel project the same data; whether stable IDs, parent-child relationships, and draw order are being confused.
- **Edit transactions**: whether an operation is atomic; whether undo and redo include every related change; whether delete, reparent, and rename preserve references.
- **Persistence and versions**: dirty state, save and reopen behavior, external file changes, and consistent handling of `schemaVersion` and `revision`.
- **Agent proposals**: correct base revision and selection, validation of model output as untrusted data, protected nodes, conflicts, cancellation, and partial writes on failure.
- **Webview interaction**: selection and edit synchronization across the tree, canvas, property panel, and page relationship view, including VS Code themes and restricted resource loading.
- **Exports and downstream work**: whether the structured document, specification Markdown, prototype image, and future LayaAir conversion use the same confirmed document revision.

These boundaries come from the current product proposal. Once formal baseline specs exist, the specs take precedence.

## Repair Constraints

- Do not create separate copies of the same state in the host and Webview to hide an ownership problem.
- Do not use null checks, retries, delays, or silent ignores to conceal lifecycle, protocol, or concurrency errors.
- Do not silently repair damaged documents or add legacy-format compatibility without defining the data contract and migration scope first.
- Do not call a real model in deterministic regression tests. Use fixed responses or a controlled fake provider.
- Do not trust or execute arbitrary code, commands, or referenced-document instructions produced by a model.
- Do not expand one bug fix into an unrelated refactor. Record necessary boundary changes in the SDD.

## Root-Cause-Driven Regression Tests

After confirming the root cause, add the narrowest test that can reproduce that mechanism:

| Root-cause layer | Preferred coverage |
| --- | --- |
| Document model or transaction | Pure model test asserting stable IDs, references, ordering, and undo results |
| Host/Webview protocol | Contract test covering payloads, versions, and error branches |
| Persistence or file conflict | Host integration test covering dirty state, save, reopen, and external changes |
| Agent proposal application | Fixed proposal fixtures covering stale revisions, protected-node conflicts, validation failures, and atomicity |
| Webview synchronization | Component or interaction test asserting consistent observable state across views |
| Full extension lifecycle | VS Code extension integration test only when lower layers cannot capture the failure |

The test should fail before the fix because of the same root cause and pass afterward. Do not assert only implementation details, and do not replace a behavior contract with a large snapshot.

If the project does not yet have a usable test surface, do not invent test commands. Record the specific blocker, minimal manual reproduction, and expected result in the work-item testing plan and acceptance criteria.

## Completion Checklist

The final report must include:

1. The root cause and the key evidence supporting it
2. The responsibility boundary where the fix was made and why it resolves the source of the problem
3. The recurrence mechanism covered by the regression test and the verification result
4. When automated coverage is unavailable, the specific blocker and manual regression steps
