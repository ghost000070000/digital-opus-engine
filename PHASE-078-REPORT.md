# Phase078 — Door/Gate component

COMPLETED. Final native product and integrated command qualification passed.
Source fingerprint: `06c5ac07da58413e39b71978f1d4f9f41f7238cfd04f6e958160d7b07af94043`.

The discoverable Cube/Sprite Door / Gate component owns its own panel, with Door
Enabled, Starts Open and optional Remember State in Game Save. Canonical Open
Door, Close Door and Toggle Door Actions compose existing Events and typed Self/
object targets. No Script, raw panel ID, Collider, Event, lock, inventory or
animation is silently created. The historical proximity-hide preset is accurately
named Proximity Door; its stable id and Sliding Door search alias are preserved.
The separate animated Opening Door preset and historical Actions are unchanged.

Opening hides the panel and disables only its existing supported Box/Circle2D
colliders. Closing restores the original visibility and exact enabled flags,
including originally disabled colliders. Stop and project serialization restore
authored state; optional Game Save captures semantic door state independently.
The scoped implementation adds Sprite door records without broadly changing
historical Sprite world-state persistence. Unrelated survivor component edits
are preserved. Rendering visibility is not globally redefined as physics enabled.

Close preflight refuses an occupied doorway atomically with visible feedback:
legacy Player geometry uses the actual solid collision routine; modern static
gates use supported enabled Kinematic actors, actual prospective world shapes
and mutual collision filtering. It neither pushes nor teleports actors nor retries
invisibly. A 2D Body must be Static; Kinematic gate configurations produce clear
validation and actionable feedback without mutation. Disabled/future/malformed
records are inert. Trusted Game Save restoration retains snapshot semantics;
it is not interactive close or global depenetration.

## Product evidence

Final native Cube run `door-browser-20261010T063735427Z`:18 PASS. Source, exact
downloaded Editable and Playable each accept real movement input, stop at closed
walls, open and pass, refuse closing while occupied, close when clear and block
reverse traversal. Native Game Save/Load restores door state. Add/configure,
Starts Open, disabled policy, Undo/Redo, Remove/Undo, independent duplicate,
Prefab, project Save/reopen and Stop restoration pass. Authoring screenshot was
reviewed: readable Solid/Static Body/Collider help and ordinary native controls.

Final modern Sprite run `modern-door-browser-20261010T063742068Z`:16 PASS.
Source, exact Editable and Playable each run actual Body2D gameplay; the moving
actor stops at x=1.499999 against the closed panel, crosses after opening, refuses
occupied close with a native toast, closes when clear and restores Collider state
through Game Save/Load. Starts Open, Stop and authored project serialization pass.
Both final runs retain the exact candidate start/final fingerprint and record zero
page, console or mandatory external-request errors. No forced-GC/memory claim.

Permanent actual-source characterization distinguishes hidden legacy solid from
hidden enabled modern Collider. Runtime suite:17 PASS, including original enabled
flags, shape/filter acceptance, atomic refusal, persistence, unrelated component
preservation, invalid/future policies, Static validation and real invalid Action
feedback. Strict schema catalogs add the concrete eighteenth registered component.
The capability grade remains B; no grade/feature-count inflation.

Earlier functional candidate f1c828 passed full integrated8 gates/407 JavaScript/
40 JSON/all28 games/both sites, prior Checkpoint9/core14 native checks and fresh
seven public native gameplay/restart cycles across all four controller families.
Final candidate changes only creator help/validation/invalid feedback and backed
capability metadata. Final command run `regression-20261010T064140865Z` passed
eight gates: normal integrated suite, engine, all28 games, both sites,408 JavaScript
syntax checks,40 JSON files and diff check. Start/final fingerprints match exactly.
Tracker readback changes only E79/E80:078 COMPLETED and079 IN PROGRESS. Strict
validation/formatting and protected original snapshot remain unchanged. Product
progression continues with the exact Moving Platform component phase.

Preserved attempts distinguish fixture/generation failures from product failures:
063019880Z lacked a new dependency in a legacy no-door test fixture; 063744919Z
had stale generated capability Markdown; 064105319Z retained a strict historical
improvement-phase expectation. Fixtures and generated views were updated without
weakening prior invariants. Modern063434098Z used the wrong toast selector; a
fresh corrected native run passed, without hidden gameplay mutation.

## Intentional limits

Hide/show gates only, not slide/swing animation. No automatic lock or inventory
system. Modern gate Bodies are Static, not a competing moving-platform controller.
Legacy occupancy covers the actual Player; modern occupancy covers supported
enabled Kinematic actors, not arbitrary Custom Script/NPC motion. Original
visibility and Collider flags are owned independently; custom scripts that
replace those records during Play are outside the qualified ordinary workflow.
Creators must author valid Solid or Collider geometry and safe saved states.
No public game content changed, Game29, commit, push or deployment occurred.
