# Phase 106 — Camera collision/obstruction handling

COMPLETED at2026-10-10T18:12:03Z on frozen
16a01e32a33d0c7cadf653780991e8e77d97bd65b4c8fb88084f538a8d89378e.
105 predecessor4f532; exact title/number unchanged. Historical work notes below.

Final acceptance: actual-source16/full8/native35+geometry6, fresh prior10227/
10429/10520/096117 and four exact public Playables actual input/walls/restart.
Public18inputs/608contacts/533held/36368 independent checks, zero penetrations,
page/console/mandatoryexternal errors. ArsenalFP, RelicTP, DungeonTopdown and
SurvivalHover native pause Restart and post-restart movement verified. Raw probe
NOT_QUALIFIED_INITIAL_CHARACTERIZATION labels retained; bounded compatibility
is not a fresh all28 campaign/60-minute soak. Canonical all28build/sites passed.
Browser heap estimates20.4–40.2MB are observations, not forced-GC stability.
Camera query is stateless; only opting in adds candidate scans. No new cache,
retained solver records or duplicate camera/player runtime. Capability metadata
was authored before freeze and points to this report for current qualification.
Final independent root fingerprint matches all native runs; fresh diff check0.
Machine evidence: qualification/phase-106/qualification.json and
native-final-compatibility-20261010T181032326Z.json. Remaining limitations below
are intentional bounded scope, not open106 gates. No107 implementation leaked.

Native baseline175200115Z,17:52:00.116–17:52:05.329Z,4f532start/final:
actual Third-person Camera authored via palette/Inspector; actual KeyW movesPlayer
1.164m. Visible solid wall[0,3,-3],scale[8,6,1] occludes Camera sightline:
renderedeye[0,4.946,-5.787],target[0,1.05,.713], segmententry.494/exit.648.
Root reviewed raw and screenshot: entire gameplay obscured. Native non-solid
toggle keeps historical camera pose. Missing new opt-in control is a106 capability
gap, not a previously promised API regression or playercollision failure.

Actual-source RED17:52:39.3848678Z: historical defaultPASS; renderedeye safetyFAIL,
eyeZ−8 beyondwallZ−4.5..−3.5, canonicalrayfirsthit3.560992 vssegment8.139410.
Preserved qualification/phase-106/actual-camera-obstruction-red.json.

Bounded shared repair: Camera public validated atomic obstruction options/query;
only opted-in Chase presentationeye pulls target-side ofnearest expandedbox/sphere
entry. Desiredfolloweye/options/Player remain unchanged; resolver evaluates at
actual eye observation, not stale pre-controller Camera update. Public Physics
statelessdistance query reuses canonicalrayAABB/raySphere/localQuaterniongeometry.
Hostcandidate adapter uses same itemColliderConfig shape/size/worldoffset as real
legacycollision; excludesPlayer, hidden/destroyed/non-solid/non-cube/ramp. Ordinary
Camera authoring/history/options/validation/preview/defaultownership compose this
same public runtime. Defaultdisabled preserves historical projects.

Limits explicit: conservative box corners; expanded-origin containers ignored
rather than using exit asentry or inventing depenetration; no terrain/ramp/triangle
mesh, modernXYCollider, fullfrustum, fixedcinematiceye relocation or107+claims.
Frozen16a01e32: actual-source16PASS and full8PASS,511JS/40JSON/all28build/sites,
matching start/final fingerprint. Main native180404615Z actual timestamps
18:04:04.616–18:04:27.354Z,35PASS across Source/exactEditable/Playable/
built-site, actual KeyW displacement1.16–1.28m, rendered eyeZ−2.207 before the
physical wall faceZ−2.5. Root reviewed whole raw proof and repaired Playable image:
actual green Player visible rather than entire wall occlusion. UndoRedo/invalid
inputs/independentduplicate/ViewReturn/Save/reopen/typedPrefab Interact pass.
Native Destroy/restart and camera-less default release/reacquisition pass.
Non-solid and uncheckedpolicy retain historical uncorrected sightline.
Initial180314 four authoring gates then hidden Project-tab navigation timeout
preserved; visible chrome navigation repair only, no product change/oracle weaken.
Native geometry180507053Z18:05:07.053–18:05:15.181Z,6PASS: native Inspector
authors32° rotatedbox with(.35,.15,.2) worldoffset and sphere collider radius2
on Cube with(.2,0,.1) offset. Actual Source/exactPlayable KeyW moves1.16–1.28m;
independent inverse-quaternion/expanded-shape segment stays clear, endpoint
surface clearance .28637m box/.29955–.29965m sphere exceeds .25m policy. Root
reviewed whole raw proof and both rendered Playable images. This is authored
collider clearance, not mesh-triangle/frustum or all-content alignment proof.
The proportional compatibility gate above subsequently closed on this fingerprint.
