# Phase137 — Hitbox/hurtbox authoring

COMPLETED. Exact roadmap title retained; individual tracker spec link blank,
so the bounded derived contract is explicit in qualification/phase-137.
Bounded creator/runtime contract qualified on the frozen final fingerprint.

Independent sphere Hitbox/Hurtbox components are discoverable on Cube/Sprite.
Positive finite world radius and signed world offsets are independent of mesh
scale/rotation and movement Collider. Optional Player Hurtbox lives in the
existing Level settings/history owner. Absent Cube/Player geometry preserves
historical bounds; absent Sprite remains excluded from combat. Disabled/future
geometry is inert and retained/diagnosed, not silently replaced with legacy data.

Hitscan, nearest melee and swept projectiles share canonical target resolution.
Solid occlusion and historical melee no-LOS stay unchanged. Apply Hitbox Damage
is an explicit Event Action: selected source Hitbox plus existing Damage,
optional target tag, one hit per eligible scene Health Object per invocation.
It does not silently fire every frame or add cooldown/LOS. Existing Health,
resistance/classification and death responses are reused; no Custom Script or
second combat runtime. Overlap Action does not target the legacy Player; existing
weapon paths consume its optional incoming geometry.

Show Colliders displays selected blue incoming/orange attack sphere rings,
72 pooled segments per sphere, maximum144, removed on Play/unselect/toggle.
Furniture is never authored or saved. Native history/Prefab/duplication/Save and
export seams use the existing public component transport. The existing Damage
capability help is extended, B grade and57-capability count unchanged.

Permanent focused normal-suite tests: authoring6, actual controller/combat
runtime10, Player host6, public policy/actual preview6. The numeric regression
captured RED Infinity<=Infinity for finite extreme centres/radii; only exceptional
overflow arithmetic is normalized. Ordinary arithmetic remains unchanged.
Actual high-speed projectile partitions30/60/144 choose nearest once. These are
meaningful invariant tests, not a synthetic substitute for browser acceptance.

Historical preimplementation native baseline074332994 observed absent creator
controls and off-axis legacy radius.3 miss/radius1 hit. Candidate73915d primary
075521407 proved42 observations: native Hurtbox miss/hit/disabled at identical
pose with unchanged Collider; native Hitbox+Damage25 actual Q yields Health75
and counter1 in Source/Editable/Playable; reusable Prefabs, independent duplicate
edits/history, Save/reload and Player authoring; bounded ring screenshots.
Root raw evidence and four PNGs reviewed. Fresh136 typed compatibility075500699
has11 observations, Fire100/Ice50 and magazine3-to2 in all three tiers; root
reviewed raw events and native Weapon/Playable PNGs. Error/request arrays empty.
These73915d proofs are historical, not transferred to final changed fingerprint.

Failed attempts remain preserved: native Undo/Redo intentionally clears selection,
so the harness now reselects through Scene before field editing; no product
history semantics changed. The initial Sprite fixture used legacy tags that
canonical Sprite serialization does not retain; its tag-filtered attack correctly
missed. Corrected fixture must use the real all-Health target policy. Historical
121 packaging test missed the newly required UMD module; actual dependency list
repaired without weakening assertions. Command074911908 preserved separately.

Final candidate fingerprint:
a7e3ed34d073f7d8eb5ff1cd7e2cb17b732aae3b522c29ceabbd6007d7499936.
Final command regression080230542 passed all8 gates, ending08:04:45.483Z:
normal suite, engine build,28 catalog builds, both sites, syntax656,JSON43,diff.
Final primary080223383 passed42 observations; supplement081052402 passed29;
fresh136 typed compatibility080711354 passed11. All start/final fingerprints
match a7e3; page/console/external-request arrays are empty. Coordinator reviewed
raw actual-input health/counter/ammo states and native/export screenshots.
Supplement proves Sprite absent/enabled/disabled100/75/100; isolated incoming
Player projectile starts at actual Graph owner, pre0/fired1/Health100, then75
and expiry0. OffsetX3/disabled preserve100; representative both exports hit75.
The earlier origin mismatch measured a different object than the Graph owner,
not a product instantiation defect. Diagnosis corrected; failed/partial runs
retained, no runtime patch made for that harness mistake.

PHASE_137_HITBOX_HURTBOX_AUTHORING_READY

Boundaries: sphere-only, no skeletal/bone regions, arbitrary shape authoring,
automatic attack schedule/cooldown/LOS, complete2D aiming, physical gamepad,
file-protocol offline or forced-GC claim. Browser Graph wiring is explicitly
imported, not a native Graph construction claim. No Game29, public content
identity change, commit/push/deployment or Phase138 implementation.
