# Phase 087 — Button actions without scripts

COMPLETED, 2026-10-10T09:40:50Z. Frozen source `8c4c3bdcb236fd5f42afa7ba2d4741e5addfa21eb0b12e1f3cff743882db9cf6`. This is not full product readiness.

Creators choose one canonical Action on a HUD Button and author its registered typed parameters through existing named reference controls. Explicit Object targets replace any imaginary HUD Self. Dynamic Signal/comparison values use their declared types; finite numeric edits preserve zero without converting invalid input to zero. Valid changed input captures history before mutation and coalesces typing; invalid/no-op/Play edits do not. Unknown Actions/extra parameters and unavailable references remain retained. Canonical Open Menu Page uses086 stack/pause ownership, not another UI/gameplay runtime.

Actual defects repaired:

- Native `button-actions-browser-20261010T092226407Z` reproduced a selectable Set Counter Action with no required parameter controls. Typed fields are now authorable without Script.
- Actual registered dependency collection omitted button-only Sound and inactive-level Prefab references. HUD parameters now use existing `scanActionParams` in all levels. Exact-tier native Audio observations additionally prove active/inactive button-only assets survive and decode.
- Actual Button execution now guards non-Play, paused and terminal state while retaining stable nodes/current parameters. Author preview never executes. Source and both exports prove actual Enter/Space on a focused Button cannot bypass Pause or Win.

Final evidence, same start/final fingerprint:

- Native24: `qualification/phase-087/button-actions-browser-20261010T093933989Z/proof.json`,09:39:33.993–09:39:54.697. Actual UI fields, Undo/Redo, invalid numeric rejection, preview, Save/reopen/future record; Source/Editable/Playable zero Counter, false Object value, explicit target/color, one click/one effect, typed Boolean Signal received false, running-game Menu owns/relinquishes pause, unknown Action inert, real paused/terminal keyboard attempts. Canonical graph validation passes before Play. Each tier native Sound click creates AudioBufferSource/Gain nodes observed through read-only CDP; both active/inactive assets decode. No claim that sound was heard. Zero page/console errors or external requests.
- Pure core9 and actual-source authoring/dependency/history/runtime-guard regressions registered in `tests/run-tests.js`. Includes independent fields, inherited/reserved metadata rejection, bounded library, zero/false/empty text, explicit targets, unavailable options, dynamic values, unknown data and before-mutation coalescing.
- Prior core14: `qualification/phase-073/core-browser-20261010T093852350Z/proof.json`; Transform/Visual/Collider/hierarchy/Prefab/persistence/exact exports remain green.
- Full8: `qualification/real-demo-collision/regression-20261010T093840771Z/results.json`; integrated suite, engine, all28 games, both sites,440 syntax files,40 JSON files and diff check PASS. Capability metadata/dashboard reconciled without grade inflation.
- Root/agent screenshot review confirms readable themed named-target controls, actual false field and bounded Menu card. Normal HUD-list scrolling is required for longer parameter lists; no arbitrary menu-canvas claim.

Preserved non-product failures: old081/083 isolated panel/nonbutton VM fixtures lacked the newly invoked helper; only fixture hooks added, all prior assertions preserved. Full093112 evidence retained. Native093412 receiver connected Boolean Signal to a text-only legacy Action; corrected to canonical typed Object graph variable, not a product patch. Native093452 placed the qualification future Button behind editor chrome; only fixture placement changed, no forced click. Native093905 canonical validation rejected a duplicate explicitly stored implicit Start; fixture corrected before final acceptance. Earlier18-pass proof on1cfff is historical, not a substitute for final24 guards on8c4c.

Limits: one registered no-code Action per Button, not an additional graph runtime. Object targets must be explicit. HUD/Menu records are level-owned, not Object Prefab components. Historical Custom Script is not a newly offered no-code Button choice. General responsive Menu composition and future widget/tween scope are not claimed. Dirty work preserved; no Game29, commit/push/deployment. Continue exact088.
