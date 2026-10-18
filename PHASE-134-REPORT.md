# Phase134 — Melee weapon no-code builder

QUALIFIED bounded existing3D contract. Exact title and blank individual specification link verified in
the native authoritative tracker. Actual `fireMelee` is a nearest tagged-Cube
radius/cone check reusing `combatTargetSphere` and `applyHitDamage`; historical
implementation explicitly does not raycast solids. Inspect real dispatch and
validated named zero range/cone before changing any historical semantics.
Actual-source baseline5PASS/1RED preserved in runtime-baseline.json: valid named
range0 resolves0 but dispatch substituted2.5 and hit target2units away20→13.
Direct range0 misses; legacy inline0→2.5 separately passes. Root named-only
nullish reach repair now6GREEN, previous133runtime5/131runtime10 remaingreen
on b3f442d91fba618a79343626bb1602e2105b9fca79bc36b461822e88eaca0b92.
Nearest/radius boundary, fixed60degree half-cone, rear/overlap/tags/hidden/zero
damage characterized. Historical untagged solid wall does not block melee;
tagged solid can itself receive damage. No silent LOS migration or cone schema.
Guided native close-range builder now composes canonical definitions and binds
the fixed Player weapon in one history operation. Shared validated setup with
133 retains inline tuning/equipment/input and adds no projectile Prefab. Actual
host6/runtime6 and prior133runtime5 pass. Help discloses fixed cone, radius,
historical no-LOS and3D limits. Melee direction is Player forward; firstperson
muzzle may be camera-offset or equipped visual, NOT hitscan camera-ray direction.
First integrated attempt regression-20261011T053042506Z passed tests/build then
was invalidated by this help correction; no qualification/time transferred.
Frozen candidate ca3e2d32b421631fc63ec652e540bebfcc6c5b4575a6f1bdbf7b5e778f2de32c
is undergoing fresh broad gates. Browser tooling prepared separately; native
history/persistence/exports/gameplay now pass16 fresh observations on frozen
ca3e, including12 actual W/Q cases across Source/Editable/Playable/BuiltSite:
near health100→93, far/off-cone100, magazine3 unchanged; Graph Attack shares
the edge. Native singleUndoRedo, refusals, Save/reload and actual downloads pass.
All8 full gates include both134 host6/runtime6 and prior133host/runtime.
Fresh prior133native14 passes all hit/wall/zero cases onca3e after diagnostic
sim0 startup readiness was corrected in harness with real grounding/displacement
predicates; priorfailed13-observation cause is not retrospectively proven.
Root independently reviewed raw state and3 actual PNGs. Errors page/console/
external requests empty; all browser/server/full runners closed. Evidence is
qualification/phase-134/qualification.json. No2D combat/equipment/LOS rewrite
claim; Epoch14 creator review must revisit integrated2D/3D weapon coherence.
