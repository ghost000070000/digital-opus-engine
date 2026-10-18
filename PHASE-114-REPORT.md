# Phase 114 — Top-down controller exposed settings

Status: COMPLETED. Qualified source fingerprint:
`038d3fa7bde5600bc40215e5b2ad88615d8b074252bb21f4753ff1e4b4a03111`.

Complete canonical Dungeon Descent native baseline222055573 proved missing
Turn toward movement and hidden horizontal radius controls despite working
runtime settings. Existing guarded Player authoring now exposes both; positive
finite radius, strict Top-down-only boolean edits, independent history and Play
refusal preserve unrelated input, visual and Camera settings. Vertical controls
remain hidden for this flat world-XZ controller. Detailed ground/Camera guidance
is discoverable without a large always-open settings paragraph.

Mounted authoring RED7PASS2FAIL and later explicit-null RED13PASS1FAIL are
preserved. Null previously behaved false at runtime but displayed true and
refused deliberate true repair. The bounded raw-property read now agrees with
runtime, preserves imported null until explicit edit, and allows Undo to restore
it. Omitted settings retain historical defaults without render mutation. No
movement, collision solver, Camera, schema or public game content was rewritten.

Registered actual-source14 tests and prior11222/11329 pass. Fresh full command
run222917677 passes all eight gates: integrated suite, engine/catalog28 builds,
both sites, syntax531, JSON40 and diff. Native final223224223 CLOSED31 observations
22:32:24.224–22:33:10.234 on matching start/final source; no page, console or
external-request errors. Source, exact Editable, exact Playable and built-site
all preserve heading policy, wall/corner radius clearance, non-solid passage,
ordinary level switches and Restart. Source/Editable/site Stop preserves author
settings. Native history, Play guards, independent duplication and complete
Save/reopen preserve the local skinned ranger, clips, palette and input context.

At radius .8 the real player stops at x2.6999 and corner z−2.6999; body edges
±3.4999 remain inside wall faces±3.5. Radius .2 reaches x3.2999 with yaw0 retained
when turning is off. Pass-through comparison reaches x10.612–10.615. Root
independently reviewed raw states and readable controls/Playable corner images.
The first green attempt's wrong duplicate-button locator is preserved and
classified as automation failure, not product collision failure. A stale
generated capability inventory was mechanically regenerated before final gates.

Evidence: qualification/phase-114/qualification.json, root-native-review.json,
root-command-review.json, root-failed-attempt-review.json, actual-null-turning-
green.json, and topdown-browser-20261010T223224223Z/proof.json.

Limitations: this is the existing 3D world-XZ controller, not future XY platformer
or 2D top-down physics. Flat solids block horizontally regardless of height;
Terrain contact may raise the player but this path adds no falling, Jump or water
buoyancy. Current chase heading is not a fixed-bearing Camera promise. Level
Player settings are not an Object Prefab; copied-level editing has local history,
not structural cross-level Undo. No physical gamepad, file-protocol/offline run,
forced-GC stability, new public game or fresh28-game soak is claimed. Phase115
continues after authoritative tracker transition; overall product is not READY.
