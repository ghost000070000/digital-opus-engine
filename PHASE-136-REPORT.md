# Phase136 — Damage types and resistances utility gate

Utility decision JUSTIFIED: bounded optional incoming target ownership is useful
independently of source damage tuning. Exact authoritative title retained;
individual tracker spec link blank, derived contract explicitly documented.
Qualified on138daa2933dd79e8fd018759373c5d1b56e888e9272c381c2afed6c617aaf49d.

Native equal100-Health baseline with the same25-damage hitscan demonstrated no
mitigation controls; arbitrary armor tags never promised mitigation. Optional
Damage Resistance on Cube/Sprite and legacy Player owner now expresses neutral,
fractional, immunity and weakness without scripts or a new combat runtime.
Ordinary/Fire/Ice is a bounded vocabulary, not a project taxonomy. Labels explain
0 immune,0.5 half,1 unchanged,2 double. Healing/SetHealth/instantKill/negative
historical Actions retain semantics. Pure public resolution precedes existing
Health/death responses once; invalid/future data stays retained/diagnosed/inert.

Damagev2 validv1 migration retains amount/extensions and assigns Ordinary;
invalid/future records do not silently upgrade. WeaponDefinitionv2 new captures
explicit category; historicalv1 resolves Ordinary without mutation until explicit
editing. Existing hitscan/melee/projectile, Simple/State AI attacks, Damage
Player/Object, Apply Damage Component and Fire Projectile share classification.
Player profile owns existing settings/history, not a detached scene object.
Packaging seams include source, editor export, catalog and built editor site.

Permanent focused normal-suite tests: pure policy9, actual Damage routes8,
Resistance authoring9, Damage classification authoring7, Weapon classification5,
actual dispatch/geometry/projectile paths4 and Player host6. Earlier actual
knockback6/portable AI anchor4 prerequisite repairs are recorded separately in
qualification/phase-136/prerequisite-qualification.json; fresh normal suite covers
them. Finite validation, malformed/accessor refusal, no-op/Play history guards,
independent transport and historical compatibility are meaningful invariants;
no impressive fuzz count or unnecessary multi-hour stateless soak claimed.

Final native component-player072714054 proof11,07:27:14.057–07:27:30.365Z:
native Damage Add/type/amount/history/Save/reopen and Player profile authoring.
Six real Q cases in Source/Editable/Playable: Fire Player/target100, Ice50 from
100 at source25, exactlyone event each. Graph wiring imported and explicitly
labeled, not native Graph construction. Final Prefab072738361 proof15,
07:27:38.361–07:28:02.449Z: actual capture/palette instantiate, independent
duplicate edits/UndoRedo, native Sprite components, Save/reload and exact exports.
Actual Q Fire remains immune after reuse; original references unchanged. Native
Behavior classification shown only as uncommitted draft; no committed workflow
claim. Browser/console/external request arrays empty, identical start/final138daa.
Root raw proofs and fresh Player/Sprite/Playable screenshots reviewed; scoped
Player button styling now matches editor theme.

Preserved automation failures: ungated downstream imported Graph nodes,
premature lazy-health readiness, unnamed placedPrefab selecting wrong actor.
Actual records/runtime distinguished these from product failures. The deliberate
validv1 migration regression initially failed and opted-in validated migration
was repaired without weakening expectations. Final command072715167 caught
stale generated capability documentation; canonical generator refreshed it,
assertions retained and fresh full072746025 started. No failed time/counts moved.

Remaining limitations: custom category taxonomy, native Graph construction and
all attack-mode browser combinations, general2D aiming, physical gamepad,
file-protocol offline and forced-GC acceptance are unclaimed. Cube/Sprite native
components and export semantics do not imply a complete2D combat authoring kit.
Node-local Graph gate discoverability is recorded friction for epoch review.
No public game identity changes, newGame29, commit/push or deployment.

Final command072746025 passed all8 gates, ended07:30:36.163Z: integrated suite,
build, catalog28, both sites, syntax648, JSON43 and diff. Start/final fingerprint
identical. Fresh Weapon proof073134067 has11 observations and six actual Q hits:
Fire100/Ice50, magazine3 to2 in Source/Editable/Playable. Fresh135 compatibility
073107018 has15 observations across Source/Editable/Playable/BuiltSite, native
ammo/history/persistence and Source equipment switching. Root reviewed raw
evidence and fresh native Weapon and ammo/equipment PNGs. Preserved135 rerun
072956631 had a fixture version mismatch: v2 config labeled v1, correctly refused
by public inspection. Tool now preserves template.version; assertions and product
semantics unchanged. All final browser error/console/external-request arrays empty.
No failed evidence/time/counts transferred. final-qualification.json indexes proof.

PHASE_136_DAMAGE_TYPES_RESISTANCES_READY

Next exact phase137 is Hitbox/hurtbox authoring. This closes the bounded phase
contract, not the complete product program or every combat workflow.
