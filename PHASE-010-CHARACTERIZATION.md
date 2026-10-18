# Phase 010 Characterization

## Starting condition

Phase 009 qualified the first-run path, but capability truth still lived primarily in a manually maintained 55-row Markdown inventory. Grade totals, evidence, friction, and UI presentation could diverge. Creators and developers had no searchable in-editor answer to “what can I genuinely build without code today?”

## Reassessment method

Every capability was reconsidered against the unchanged rubric: discoverability, UI completeness, code/raw-data dependence, reference safety, Save/Load, Export, validation, and workflow pleasantness. Existing grades were retained unless checked-in phase evidence and an exercised creator workflow supported movement an upgrade. Runtime breadth alone was not accepted as evidence.

Two foundational capabilities that Phase 001 did not inventory separately—Components and Gameplay Presets—now have stable catalog entries. This changes the inventory denominator from 55 to 57, so the catalog records both the original Phase 001 totals and a normalized 57-row baseline.

## Qualification evidence

- Machine catalog validation: 57 unique stable IDs, canonical grades, bounded support values, resolvable local evidence, and valid friction references.
- Dashboard UI: loaded all 57 records from the local catalog and passed A/B/C/D/N/A, category, and search filtering in Microsoft Edge.
- Blank-project gauntlet: normal editor UI only; 38 counted interactions; customized environment, Top-Down Player, Health component, Collectible and Checkpoint presets, Click interaction, counter state, Counter HUD, Win action, Save/Load, zero-error project validation, Play, and a 1,383,498-byte Playable Export.
- Guided first-game qualification: clean local state; 24 counted interactions; 9/9 outcomes; interruption/resume, Save/Load, state isolation, Help, and a 1,383,658-byte Playable Export.
- Neither qualification used Custom Script.

## Honest movement

- Onboarding: D → A, supported by Phase 009 clean-profile closure.
- Templates: C → B, because examples, one-click gameplay roles, and the first-run chooser now cover the common starting path. The missing broad genre-template catalog remains documented.
- Components: normalized D → B as a newly explicit row, supported by schema-driven searchable Add Component, Undo, validation, Save/Load, prefab/duplicate, and export tests.
- Gameplay Presets: normalized D → B as a newly explicit row, supported by seven discoverable roles and end-to-end survival tests.
- No capability was downgraded.
- Validation remains C because `AFR-0014` is still open despite a zero-error result for the qualified project.

## Remaining pressure

Sprites/2D and Tilemaps remain D. The most concentrated unresolved Critical/High pressure is AI State Machine, Behaviors, and Node Graph (three linked issues each), followed by AI, Animation, Cameras, Equipment, Prefabs, Sprites/2D, and Variables (two each). This is recorded rather than hidden behind aggregate scores.
