# Phase 096 — Contextual input maps

COMPLETED. Exact authoritative title;095 qualified before implementation.
One additive project-authored InputContexts library uses canonical Input Action
identities, not another physical binding store, poller or scripting system.

## Creator surface and ownership

Project Input Contexts has named create/select/rename/delete, typed Action
membership and Camera look checkbox. Up to32 contexts with up to140 distinct
canonical Action references each. Version1 InputContexts library records retain
unknown supported extensions; malformed/future data stays unchanged and visibly
unavailable. Stable generated IDs are internal, not free-typed creator fields.
Player settings provides a typed initial-context picker for the current level;
absent/null means unrestricted historical input. An empty selected context
intentionally accepts no logical gameplay Actions. Look is explicit per context.
Definitions/default references use independent project history, Save/reopen,
level duplication and both exports. Prefab Actions retain typed project-local
context references; no foreign-project context bundle is claimed.

Set Input Context selects one context; Reset Input Context returns to the
authored initial selection. Both are ordinary canonical Actions available to
Behaviors/graphs/sequences/HUD Buttons. One active selection, not a new modal
stack; existing pause ownership remains independent. Active selection is
transient, never serialized, and resets on Stop/restart/level lifecycle.

## Logical semantics and compatibility

Unconfigured projects preserve every current control, including Arrow secondary
movement. Context gating applies to canonical Action conditions and gameplay
input consumers, all four controller primary/Arrow paths and direct touch
gameplay callbacks. Mouse/touch/right-stick look follows the Camera look flag.
Physical Input leases remain aggregate facts: inactive Actions cannot clear a
shared code needed by active Actions or mutate author/player/device maps.
Legacy raw physical-key Conditions and Custom Script remain explicit unscoped
escape hatches; no new context system may reinterpret their historical meaning.

Valid inactive Actions are ordinary false input, so NOT is true. Missing Action
or unavailable context dependencies remain invalid/fail-closed even through
NOT/OR. Missing authored initial context must not fall back to unrestricted.
Invalid Set Input Context is inert with validation feedback, not a silent broadening.
Held reflects the current logical context immediately; Pressed requires a fresh
physical press after a selection transition. A held key/pad/touch source must
not synthesize a press on activation. Compile bounded definitions per session,
not per frame; invalid definitions and dangling references remain inspectable.

The additive canonical Input.pressVersion(code) identifies a real aggregate
press without consuming it. Same-code independent owners share its epoch;
stamps are retained only while held or unconsumed, then released with the
existing transport state. Context transitions snapshot epochs, including
already-released unconsumed presses. A fresh release/press rearms even if no
Action query observed the released frame. Reset restores an unavailable
authored initial reference fail-closed rather than retaining a more permissive
transient selection.

Escape/Pause/Start, Stop and screen Close/Resume remain reachable. Inventory
opening follows its logical Action; an already-open inventory can always close.
Do not turn discovery-only092 controller sets into permission lists. Do not gate
explicit gameplay Actions such as scripted attacks merely because input is off;
gate their input callers instead.

## Qualification

Strict bounded pure schema/identity/retention/compile tests and permanent actual
controller/Condition regressions for four families, primary+Arrow movement,
shared codes, direct touch, look, held transitions and pause/navigation ownership.
Native named authoring/typed membership/history/Save/reopen/duplication/Prefab
reference retention; actual keyboard/mouse/touch context switching and meaningful
gameplay response in Source and exact Editable/Playable. Controlled pad fixtures
are not physical hardware evidence. Relevant091–095 browser/regression and normal
integrated/engine/catalog/sites/syntax/JSON/diff must pass on final frozen source.
No097prompts/098layout/099diagnostics, Game29, external service or deployment.
