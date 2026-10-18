# Phase 107 — Camera zones and blends

COMPLETED. Qualified source fingerprint:
`62fa403b0167a73512c8987366aaf20f0ca7a91907728f76568117c736b6bb9e`.

The no-code workflow remains ordinary repeat Trigger Volume Enter/Exit events,
typed Change Camera Actions and Blend Duration. Actual input enters, exits and
re-enters authored zones. No new CameraZone component or Camera runtime.

Existing blends now preserve acquisition presentation, smoothly interpolate
same-projection span/clip interval/up, reject invalid durations before mutation,
and enforce newest cut/blend/path ownership. Moving endpoints refresh through
canonical Camera application/getters, not copied Chase math. Behavior Add
validates duration before Undo with creator feedback.

Final evidence:
- Actual-source/public Camera: 20 PASS / 0 FAIL. See
  qualification/phase-107/actual-camera-blends-green.json.
- Eight integrated command gates passed: regression-20261010T183041909Z.
  Engine, all28 games and both sites built; builds are not gameplay evidence.
- Native main183243209Z:37 gates, actual creator/input/rendered transitions,
  history, Save/reopen, independent duplicate, ordinary Prefab placement and
  Source/exact Editable/Playable/built-site parity.
- Moving handoff183319522Z:8 gates across four tiers. Terminal eye movement
  approximately .12–.14m and target .16–.25m alongside Player ~.11m replaces
  the preserved six-metre pop.
- Existing positive intro blends183715798Z:8 gates, Signal Zero/Relic Runner2.
- Destroyed/missing target183800944Z:5 gates. Acquired transient shot may finish
  from retained record; later missing-ID Actions no-op; restart restores state.
- Prior106 native35+rotated/offset box/sphere geometry6 and096 native117 passed. Bounded actual public
  firstperson/thirdperson/topdown/hovercraft movement/wall/restart compatibility
  passed; no fresh all28 collision acceptance or soak.
- Raw proof paths, matching start/final fingerprints, empty page/console error
  and external-request arrays, and closed browsers are summarized in
  qualification/phase-107/native-final-compatibility-20261010T183809881Z.json.

Preserved failures:
Baseline16a01 actual source/native181905740Z reproduced span/up snapping,
stale path ownership and invalid duration. Earlier selector/small-volume
attempts remain automation/fixture diagnostics.
Partial185e2440 passed native33/full8 but actual Source/Playable182828309Z
reproduced eye6.3175/6.3216m and target6.4445/6.4450m jumps vs Player
.1092/.1118m. That evidence is preserved, not transferred qualification.
Source observation4abbf3 predates repair; the two permanent moving tests landed
after repair and are not claimed as exact prepatch executions. Final62fa was
qualified afresh.

Intentional limits:
Different projections switch immediately while view position blends; no matrix
morph. Overlapping zones use ordered events, not priority arbitration.
Cinematic fixed blend/path does not promise106 Chase-only clearance or full
frustum safety. Portable seeds plus native authoring are not blank-world
authorship. Ordinary-object Prefabs preserve Camera references; standalone
Camera component Prefabs are unsupported. No physical device/offline/newall28
soak/publication/Phase108 claim.
