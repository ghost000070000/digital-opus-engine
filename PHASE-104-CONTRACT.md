# Phase 104 — Top-down/isometric camera preset builder

COMPLETED on98adad4a; exact authoritative title, Epoch11. Historical prerequisite
was qualified103 source0b96d708. Final actual-source/full/native/compatibility
evidence is in PHASE-104-REPORT.md andqualification/phase-104/qualification.json.
Build discoverable named top-down and isometric Camera presets using existing
ordinary Camera objects, canonical Chase and the actual topdown XZ controller.
No competing camera loop, controller migration or105 2D camera work.

Public composition: `Camera.setChaseOptions({ bearingMode:'fixed', bearingYaw })`
stores finite radians. `bearingMode:'followTarget'` is the historical default.
Partial updates preserve existing options; invalid provided policy/yaw refuses
before mutation. Fixed-bearing first acquisition uses the same half-unit target
lift as updates, while historical acquisition framing is unchanged. Top-down
uses bearing180degrees/distance9/height18.5/pitch0. Isometric uses orthographic
height20/bearing-135degrees/distance9/height(0.5+9/sqrt(2))/pitch0. Both use zero
velocity lead. Authors may change these framing values; arbitrary edits/zoom
are not guaranteed to retain equal-axis isometric geometry.

Characterize actual native creation and gameplay first. Existing Chase follows
Player yaw, so angled framing alone is not fixed-bearing isometric. W=-Z/D=+X
movement and rotate-to-movement must stay unchanged. Add a bounded opt-in public
Chase bearing policy only where actual evidence establishes the missing capability;
historical omitted policy remains follow-target. Preserve partial public updates,
finite validation, independent author records, no-op/Play-safe history and typed
shot references. Fixed policy must work on initial target acquisition and updates.

Historical Camera normalization and default Player spawn must restore follow-target
at ownership boundaries, never through per-tick overrides. Authored active Cameras
and Start Actions apply after spawn. View Through/Return, fixed-to-historical shot,
level transitions/restart and all four controller defaults must avoid policy leaks.

Top-down preset must preserve map-north orientation during real W/D movement.
Isometric is a rendered geometric claim: validate equal projected world-axis
lengths under orthographic projection and a stable diagonal bearing, including
the actual runtime target-height offset; do not infer it from Euler labels alone.
Preset composition retains ordinary Camera duplication, typed references in
ordinary-object Prefabs, Save/reopen, Undo/Redo and both export tiers. Standalone
Camera component Prefab representation remains unsupported and must not be claimed.

Qualify actual creator placement/naming/framing/reference switching, native gameplay,
Source/Editable/Playable/built-site, permanent public/host regressions, proportional
prior camera/input/public-game checks and normal integrated builds. Dungeon Descent
is the relevant public topdown representative. No physical-device/offline/all28
fresh soak claim. No106 obstruction,107 zones, shake or future camera builder work.
