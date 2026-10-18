# Phase 008 — Characterization

`PHASE_008_GAMEPLAY_PRESETS_READY`

## Baseline and regression

Phase 008 began from the Phase 007 integrated baseline of 254/254 checks and the unchanged engine bundle of 158,687 bytes / 40,950 gzip bytes / 22 sources. Existing unrelated dirty work was preserved.

- Phase 008 preset contract: **40/40 passed**.
- Integrated suite: **294/294 passed** after adding Phase 008.
- Microsoft Edge preset audit: **PASS**, with no page errors.
- Authoring friction registry: **valid**, 23 records / 21 open canonical / 2 Critical / 13 High / 2 duplicates.

## Edge dogfood

`node tools/audit-phase-008.js` used the real editor UI at 1366×768 and 1920×1080. It confirmed:

1. a visible **Apply Gameplay Preset** entry adjacent to Add Component;
2. search focus, category/result descriptions, empty search, Escape cancellation, focus restoration, and viewport fit;
3. parameterized Damage Zone application with exactly one Undo entry;
4. explicit **Update Existing Setup** on repeat application, updating one Behavior rather than duplicating it;
5. Undo returning damage 31 → 23 and Redo returning 23 → 31;
6. a small loop composed from Damage Zone, Collectible, Checkpoint, Moving Platform, Opening Door, Spawn Point, and Basic Enemy;
7. visible ordinary outputs: Behaviors, Health, follow AI, tags, animation clip, Solid/spawn fields, and values;
8. Save/Load, Project Validation, Prefab, Duplicate, editable export, and playable export parity;
9. zero Custom Script and zero page errors.

Manual fallbacks recorded honestly:

- seven ordinary scene objects still had to be selected or placed because Phase 008 presets configure an existing object;
- the sample's existing Player was used because Player creation is not a Phase 008 preset.

## Packaging

- Engine: **158,687 bytes / 40,950 gzip bytes / 22 sources** (unchanged; presets are editor-only).
- Game exports: **28/28**, 113.0 MB total, 4,133 KB average.
- Engine site: **28/28**, 1,318 KB editor, 213.9 MB total; path and broken-link checks passed.
- Games site: **28/28**, 134.5 MB total; path and broken-link checks passed.
- Live local preview: **28 games**, 4 Featured and 24 Samples.
- No deployment or DNS operation was performed.

## Friction result

AFR-0003 remains **CONFIRMED / HIGH / REPEATED**. Seven common roles no longer require discovering and wiring multiple conditional panels, but uncataloged legacy capabilities still do. AFR-0017 remains **CONFIRMED / MEDIUM / REPEATED** because Audio Zone and Fog Zone were intentionally not claimed without a dedicated live audit.

## Exit

`PHASE_008_GAMEPLAY_PRESETS_READY`

Phase 009 was not started. No new runtime feature, Sprite Renderer, game 29, deployment, DNS, commit, or push was performed.
