# Phase 007 — Characterization

`PHASE_007_SEARCHABLE_ADD_COMPONENT_READY`

## Baseline

Before Phase 007 changes, `node tests/run-tests.js` passed 214/214 checks. The engine bundle was 158,687 bytes / 40,950 gzip bytes / 22 sources. Existing unrelated dirty work was preserved.

## Focused and direct regression

- Phase 007 Add Component contract: **40/40 passed**.
- Phase 002 schema/component: **28/28 passed**.
- Phase 003 references/validation: **35/35 passed**.
- Phase 006 reusable Inspector fields: **42/42 passed**.
- Integrated suite: **254/254 passed** (33 engine + 28 Phase 002 + 35 Phase 003 + 27 Phase 004 + 33 Phase 005 + 42 Phase 006 + 40 Phase 007 + 15 showcase quality + 1 public-site integration).

The Phase 007 suite covers registry-owned discovery, explicit addability, current singleton multiplicity, eligibility, already-present detection, label/ID/category/token search, stable ordering, empty results, inspectable rejection, default creation, one transaction callback, compatibility/runtime application, validation, Save/Load, snapshot Undo/Redo, duplicate, prefab round trip, test-only schema extensibility, Sprite-shaped architecture readiness, reusable mount slots, keyboard/ARIA hooks, responsive constraints, and export-pipeline inclusion.

## Microsoft Edge dogfood

`node tools/audit-phase-007.js`: **PASS**, no page errors.

Using ordinary controls in Arsenal Run, the audit:

1. selected a cube without Health and found the visible Add Component control;
2. opened it by keyboard and confirmed search focus;
3. verified `No matching components`, Escape cancellation, selection preservation, and focus restoration;
4. searched for Health, moved the active result with Arrow Down, and added with Enter;
5. verified schema defaults and the live Health adapter with exactly one Undo entry;
6. verified the generic Phase 006 section and sensible section focus;
7. verified the all-present and disabled `Already added.` states;
8. edited a reusable field, undid the field edit, undid the component addition, and redid it with defaults intact;
9. saved and loaded the project;
10. ran Project Validation with no Health issue;
11. saved a prefab and duplicated the object, preserving the added component;
12. generated editable and playable exports containing the picker and component data;
13. confirmed the dialog/search stayed visible and inside the viewport at 1366×768 and 1920×1080.

## Build and packaging

- Engine: **158,687 bytes / 40,950 gzip bytes / 22 sources**—unchanged because Phase 007 is editor-only and adds no dependency or framework.
- Game exports: **28/28**, 112.3 MB total, 4,106 KB average.
- Engine site: **28/28** examples, 1,292 KB editor, 213.2 MB total; path-safety and broken-link checks passed.
- Games site: **28/28**, 133.8 MB total; path-safety and broken-link checks passed.
- Live local preview refreshed: 28 games, 4 Featured, 24 Samples.
- Editable and playable export parity passed in browser and existing contract tests.
- No deployment or DNS operation was performed.

The roughly 13 KB editor-package increase from Phase 006 is the zero-dependency registry discovery and accessible picker UI. Engine output did not grow.

## Friction result

AFR-0003 remains **CONFIRMED / HIGH**, but frequency is reduced from **PERVASIVE** to **REPEATED**. Registered components are now obvious, searchable, eligible, and generically addable without internal IDs or custom wiring. Full closure would be dishonest because many legacy capabilities—notably Behaviors—are not registered schemas and still depend on conditional Inspector discovery. AFR-0014 remains unchanged; Phase 007 uses its existing validation paths but does not repair prefab, socket, equipment, or state-name semantic coverage.

## Exit result

`PHASE_007_SEARCHABLE_ADD_COMPONENT_READY`

No Sprite Renderer, game 29, Wave 10, broad Inspector/Transform/Terrain migration, AI or Equipment redesign, socket overhaul, deployment, DNS, commit, or push was performed. Phase 008 was not started.
