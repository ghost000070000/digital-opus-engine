# Digital Opus Engine — Phase 004 Report

## Outcome

Phase 004 converts the Phase 001 friction audit into an operational, evidence-backed registry. It adds no broad engine or editor feature and does not close issues merely because earlier code improved part of them.

`PHASE_004_FRICTION_WORKFLOW_READY`

## Baseline

- HEAD: `f1dc3516b585ebf5aa868006792c1dc1b9039da9`, branch `main`; unrelated dirty work preserved.
- Engine: 158,687 bytes / 40,950 gzip / 22 sources.
- Automated baseline: 112/112 checks.
- Game exports: 28/28, 111.0 MB total.

## Registry contract

- Permanent IDs use `AFR-####` and are independent of table order.
- Lifecycle: OBSERVED, REPRODUCED, CONFIRMED, PLANNED, IN_PROGRESS, RESOLVED, ACCEPTED_LIMITATION, DUPLICATE, INVALID.
- Creator impact and observation frequency are separate fields.
- Every classified issue records one primary root cause, optional contributors, creator journey, correct fix layer, stable affected systems, reproduction, evidence, and optional phase linkage.
- RESOLVED and ACCEPTED_LIMITATION are guarded by explicit multi-part standards.
- Duplicates retain their identity and evidence and point to a canonical record.

The machine-readable source is `authoring-friction.json`; `AUTHORING-FRICTION-REGISTER.md` is the human view. `tools/authoring-friction-report.js` validates the contract and deterministically clusters open canonical records into Markdown summaries.

## Current counts

- Records: 23.
- Open canonical: 21.
- Open Critical: 2.
- Open High: 13.
- Open Medium: 5.
- Open Low: 1.
- Duplicate observations preserved: 2.

Top systems are Behaviors and Texture Assets at four open canonical records each. Add Gameplay is the top creator journey at six. DATA_MODEL, MISSING_CAPABILITY, and VIEWPORT_UI are tied as top primary root causes at three each.

## Dogfood

`tools/audit-phase-004.js` exercised Microsoft Edge against the real Arsenal Run editor:

1. Dragged a Cube from the palette and added an On Start → Show Message behavior.
2. Added Move Object, selected one of 129 real object options, and passed Project Validation.
3. Imported a real one-pixel PNG, confirmed its library row, returned to the object Inspector, and applied it.

The run had no page errors. Evidence is retained in `phase-004-dogfood.json` and is reproducible by rerunning the audit.

## Findings

- AFR-0021 duplicates AFR-0003: object creation is direct, but adding gameplay still starts in the dense conditional Inspector.
- AFR-0022 duplicates AFR-0003: Phase 003 made cross-object selection safe, but discovering the relevant behavior/action remains Inspector-dependent.
- AFR-0023 is new: a texture asset row exposes Rename and Delete but no Apply to Selected action; creators must switch back to the object's Material controls. It is LOW severity, REPEATED frequency, WORKFLOW root cause, and belongs in the asset-pipeline layer.

AFR-0014 remains CONFIRMED rather than RESOLVED. Phase 003 added useful structured preflight, but unregistered prefab, socket, and state-name contracts still need manual play testing.

## Shared-fix candidates

Repeated correct layers identify bounded future investments: shared viewport/direct-manipulation primitives; asset application and diagnostics; searchable component composition; stable project-model identity; incremental semantic validation; and one onboarding vocabulary for authoring versus runtime persistence. These are candidates, not an automatically assigned roadmap.

## Coverage grades

No no-code coverage grade changes are legitimate in Phase 004. The phase adds development governance and evidence tooling, not a new creator capability. Grades remain A4 / B28 / C19 / D3 / N/A1.

## Final verification

- Integrated automated checks: 139/139 passed (33 engine + 28 Phase 002 + 35 Phase 003 + 27 Phase 004 + 15 showcase + 1 public integration).
- Registry validation: 23/23 records valid; all 20 original findings preserved.
- Live browser: all three dogfood workflows passed with no page errors.
- Game exports: 28/28, 111.0 MB total.
- Engine output: unchanged at 158,687 bytes / 40,950 gzip / 22 sources.

## Recommended next phase

Proceed to Phase 005 only when explicitly requested. Based on current evidence, its strongest bounded candidate is the searchable Add Component/component-catalog workflow associated with AFR-0003, using the schema and reference foundations from Phases 002–003. The Phase 005 brief remains authoritative over actual scope.

## Boundaries

No Phase 005 work, Sprite work, game 29, Wave 10, commit, push, deployment, or DNS change was performed.
