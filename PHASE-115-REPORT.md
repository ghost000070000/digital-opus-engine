# Phase 115 — Hovercraft/vehicle controller exposed settings

Status: COMPLETED. Final qualified source
`b66cde86e77fa322983d9f4668632b3e82e008500add830691550df9a2f6d060`.

Native baseline `hovercraft-browser-20261010T223908543Z` preserved six observed
states from the complete unmodified Survival Arena 3. Actual throttle, steering
and Boost worked; speed/acceleration were hidden and five handling fields absent.
Mounted actual-source RED preserved nine runtime passes and five missing bindings.

Bounded repair exposes existing speed/acceleration plus steering, Boost impulse,
Boost acceleration, Boost maximum speed and drag using guarded, coalesced Undo.
Own historical zero/null/blank values remain intact until explicit repair.
Runtime fallbacks, fixed .55 radius, Boost timing, controller/Camera/visual ownership
and all public game content remain unchanged. No new vehicle or2D controller.

Historical pre-repair candidate `9a3ba817db8f940f47ff4c1abd4ea8954a0f4de8091041003eda8c1d730d033a`:
root independent registered18 PASS. Fresh full `regression-20261010T224552802Z`
closed22:47:29.769Z with all8 command gates passing and matching source hashes.
Command gates do not qualify real creator/export behavior. Sole native/four-tier
campaign was next; phase115 was not yet qualified at that checkpoint.

Native `hovercraft-browser-20261010T224915426Z` completed44 functional observations
but FAILED the zero-page-error gate. Stack-enabled diagnostic225048662 reproduced
two genuine gameplay-click exceptions: pickEntity assumed a Terrain Entity although
canonical Terrain is handle-backed. Actual-picker RED20PASS/1FAIL preserved.
Bounded repair removes only that unsupported assumption, preserving Cube hidden
roles, Cube priority and Water exclusion. Existing first-person conversion stays
available in a default-collapsed explicitly labeled section; generic Player View
at Start remains visible. Repaired candidateb66cde86 received fresh gates below.

Final: registered actual22 PASS; prior11414/11222/11329/10313 PASS. Fresh full
225345583 closed22:55:31.031Z all8 gates, syntax533/JSON40/catalog28/bothsites,
matching source hashes. Final native225553280 ran22:55:53.281–22:56:49.020Z,
45 observations in Source/Editable/Playable/BuiltSite, zero page/console/external
errors. Actual throttle/coast/steering/Boost and Terrain clicks pass. Solid wall
z4.9499+.55 stops below face5.5; matching non-solid reaches12.878–12.882.
Intentional lower Boost cap5 yields actual5. Water altitude1.529–1.558 and original
craft/palette visuals remain. Seven-field history, invalid/noop/Play refusal,
raw0/null repair, independent duplicate, complete Save/reopen/assets/context,
exports/lifecycle and FP conversion/one Undo/exactrestore pass. Root reviewed
raw states and readable controls/actual Playable wall images. See qualification.json
and root-native-review.json; failed attempts preserved, not transferred.

Scope is existing world-XZ Hovercraft, not new wheel/buoyancy/XY physics. Level
Player is not Object Prefab. No physical gamepad, offline file-protocol, forced-GC
or fresh28-game soak claim. Overall product not ready; proceed to exact Phase116
2D platformer controller, composing existing physics/input/camera systems.
