# Phase075 — Interactable component

COMPLETED. Final source e6d236f46b748a19e81c59d4499011a64c65328d9abce4f9fd7b66bd530e809a.
Final native041043986Z15 PASS, full041123647Z8/393syntax/40JSON/all28build/sites/
diff equal start/final fingerprints; extended041136099Zseven actual gameplay/
native restart/postmovement PASS across four families, zero page/console/external
errors. Prior074041345412Z17/12 lethal replays PASS on the same final fingerprint.
Tracker full241 readback changes only075/076 status cells;75COMP/1active/164planned.
Original protected snapshot unchanged; API verification is not rendered Sheet QA.

The opt-in Cube/Sprite component owns enabled state, world-space reach and a
plain-text hint. It composes the existing nearest-target Player Interact input,
remapping and touch button with ordinary On Interact Actions. Historical Cube
behavior-only targets keep their 2.5 reach. Nearest eligible target wins, held or
hidden targets are excluded; future/disabled/invalid policies are inert. Input
rechecks current target/proximity, paused/stopped/ended paths cannot execute.
No new input/controller/collision runtime or public-game content migration.

Sprite and Cube now use one mechanically extracted canonical Behavior template
and binding function, existing Action/typed-reference fields and saved records.
Actual lifecycle dispatch now includes authored Sprite Start/Update subscribers;
snapshot/removal/ended invariants and non-Behavior-kind exclusions remain intact.
Legacy Cube trigger areas remain XZ; Sprite Trigger2D events use their established
modern dispatch. No forced migration of 3D gameplay into XY physics.

Permanent actual-source regression reproduced missing Sprite/configured-reach
interaction before repair. It covers legacy defaults, nearest/range policy,
future/disabled/invalid, renderer-hidden/held objects, stale removed/moved targets,
paused/stopped/ended guards, portable independent data and Sprite lifecycle
snapshot safety. Earlier lifecycle/showcase tests retain their original Cube
invariants while sourcing the newly shared functions and real surrounding state.

Native interactable-browser040842301Z:15 observations PASS on8a4d5a97, including
Add/edit/Undo/Redo, independent duplicate, Cube/Sprite Prefab, Sprite Remove/Undo,
real keyboard and touch Actions, native Player configuration, actual movement
out of reach, paused physical tap/Resume, Stop prompt cleanup, Save/reopen and
exact downloaded Editable/Playable. Screenshots retained and authoring reviewed.
Actual prior074 death-browser040913868Z17 passes with12 lethal-click/Stop replays.
Full040620319Z8/393syntax/40JSON/all28build/bothsites/diff has equal start/final8a4d.
Extended public040745836Zseven real gameplay/native restart/postmovement PASS,
mandatory five plus Dungeon/Survival cover all four families, zero browser errors.

Failed evidence preserved:040005233Z/040115410Z incorrect directional fixture
predicate while the real player moved +Z out of range;040231905Z reload left
chrome closed;040608708Z legitimate pause overlay intercepted locator tap. These
are harness/coverage failures, not collision verdicts. Native Player choice,
distance predicate, visible chrome reopen and physical overlay tap fixed coverage.
Screenshot review found stale Stop prompt: product exit path now clears it.
Command040243646Z old Sprite-exclusion expectation and040407475Z isolated VM
missing actual lifecycle/policy globals repaired without relaxing Cube invariants.
041034182Z evidence-link gate found this report had not yet been created; retained.

Limits: interaction is center-distance eligibility, not facing/raycast/occlusion
or physics contact. The existing Player/input system supplies the actor; no new
2D Player Builder is promised. Adding a component alone runs no Action. Legacy
Cube-specific Actions retain their own target eligibility; this is not a blanket
promise to support every 3D Action on Sprites. Counter names remain legacy text.
No public deployment, Game29, feature-count/grade inflation or compatibility rewrite.
