# Phase132 — Projectile weapon no-code builder

## Qualified —2026-10-11T04:59:06Z

COMPLETED bounded existing3D projectile authoring contract. Frozen source:
`758edda7444797c3ec437f5a55a306e6bfae39d97bfa526969890415b8911564`.
Native construction now composes a saved definition, an ordinary reusable Cube
Prefab and fixed Player binding without manual hidden scene setup. One Undo
restores libraries/owner; explicit compatible Prefab reuse never overwrites it.
Invalid/duplicate/Play/unsupported2D setup refuses atomically. Inline tuning,
equipment, controls and scene are retained; owner changes are disclosed.

Actual host7/runtime6 permanent regressions pass. Fresh full8 runner
`regression-20261011T045636151Z` passed04:56:36.152–04:58:39.105Z, same source
fingerprint: integrated tests, engine,28catalog, both sites,621syntax,40JSON,diff.
Final native `browser-green-20261011T045809039Z` passed04:58:09.040–04:58:24.794Z,
nine observations, zero page/console/external errors. Blankvisual builder creates
asset+yellowCube+fixedref with oneUndo/Redo; compatible visual reuse, duplicate/
speed0 refusal, actual Save/browserreload/projectLoad and native exports pass.
Four independent Source/Editable/Playable/BuiltSite real W/Q cases observe a
player-owned projectile speed9/Damage7 then visible tagged target Health100→93.
The inherited Graph still observes Q; no hidden runtime writes or firing calls.
Root personally inspected native dark-controls and Playable actual-hit PNGs:
readable controls/review text and crosshair-aligned visible target, no UI overlap.

Honest limitations: existing3D controllers only, 2D aiming explicitly refused;
single-Cube Prefabs only, not assembly/Sprite projectile support; fixed weapon
builder, not equipment equipped-fire; existing3second/.3radius/zero-gravity
Player dispatch, not a ballistic authoring system. Solid objects occlude rather
than take tagged-target damage. Terrain endpoint-height and scale-AABB bounds
remain existing solver limits. No new Game29 or public content mutation.
2D combat integration remains product friction for an integrated later gate.
Proceed to133 exact Hitscan weapon no-code builder; no new combat solver assumed.

Historical in-progress notes below are retained, not current qualification state.

IN PROGRESS, bounded derived contract; exact tracker title, blank individual link.
Native baseline `browser-baseline-20261011T045337669Z` proves existing manual
projectile setup works, actual Q emits a real speed6/damage3 shot and Graph noise.
The missing capability is coherent construction, not absent projectile runtime.
Active level Camera owns first-person firing origin; target fixtures must align
to its actual ray, not assumed body position. No baseline target-damage claim.

Candidate758edda adds native Build a projectile weapon within Level Player.
One changed history transaction creates a named definition and either ordinary
single-Cube starter Prefab or an explicitly selected compatible existing Prefab,
then binds/enables fixed direct Attack. Inline tuning/equipment/controls/scene
stay retained; review text discloses owner gate changes. Validation before any
mutation rejects malformed/nonfinite/name/counter/duplicate/typedPrefab/Play data.
No hidden placed projectile or new solver. Existing 3D controllers only; 2D aim
is explicitly unqualified/refused, not silently advertised as working.

Actual-source host6 and projectile runtime6 pass, previous11329/131host15 green.
Native construction/Undo/reuse/Save/load/exports and actual target damage still
pending. Full regression running, not a final qualification claim.
