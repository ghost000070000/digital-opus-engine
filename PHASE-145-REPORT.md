# Phase145 — Equipment visuals/socket binding UI

COMPLETED2026-10-11T10:59:23Z. PHASE_145_EQUIPMENT_VISUALS_SOCKET_BINDING_UI_READY.
Exact authoritative title; detailed tracker specification blank.
Bounded contract and actual traces are under qualification/phase-145/.
Frozen final candidatea30ba6ffb370105f8e67be06a93d1af6dd647806310bf85e1bc5468846201f24.

Baseline104651965 CLOSED6 demonstrated working canonical animated attachment:
actual F/I Equip and W movement in Source/Editable/Playable, 45 samples per tier,
visible character/relic and current socket transform alignment. The authoring
gap was native free-text body socket despite two named Player Visual sockets.
No runtime transform rewrite, second inventory or attachment store was justified.

Separate native104756892 CLOSED3 reproduced shared socket rename/offset writes
with zero Undo entries and a disabled Undo button. Actual-source RED1/6 independently
proved missing history, joint no-op history, Play mutation, malformed socket
defaulting and ordinary history snapshot omission. Preserved evidence separates
first failing assertions from unexecuted desired assertions.

The named equipment chooser derives available unique sockets and joints from
the current Player Visual, not equipment mesh. Selection and clearing are explicit
changed-only history operations; missing/ambiguous saved names remain visible.
Player Visual changes refresh choices. Legacy free text remains compatible.
First-person guidance preserves its camera-local placement path.

Shared socket edits now validate before mutation/history, coalesce valid gestures,
refuse Play/stale ownership, preserve unknown data and reject nonfinite/partial
numbers and nonpositive new scale. Add/remove use current socket-array ownership.
Ordinary history captures/restores detached shared socket metadata only, preserving
mesh/skin handles and older snapshots. Rendering does not create missing arrays.
Source review additionally corrected missing-joint dropdown misrepresentation;
retained unavailable/ambiguous joint values remain honest rather than auto-rebound.

Actual-source14, historical11329 and14411 =54 PASS/0 FAIL. Tests are registered;
source review cleareda30b. Fresh native acceptance and integrated105656500 are
not final. Integrated105305563 CLOSED8 on9188, but native105346388 reproduced
mesh selection cloning a row without refreshing its named socket picker. Its stale
owner guard then refused a legitimate RightHand selection. Root reviewed the
failure PNG/source path; permanent regression and repair pending. That candidate
cannot qualify despite command gates. Actual mounted rebind RED13/1 preserved.
Finala30b refreshes cloned-row owners after discrete mesh/slot/weapon edits and
after continuous gesture blur, without per-keystroke rerender or weaker stale-row
refusal. All three generic-edit-to-named-socket cases pass. Shared-history attempt105257839 passed three history/SaveLoad observations
then failed an automation oracle expecting disabled socket fields during Play;
native Play clears Inspector selection instead. Root reviewed its failure PNG.
This is preserved harness failure, not product failure; fresh corrected acceptance
must close before qualification.

Imported Moving Temple Ranger, authored LeftGrip and prior Grant caller are labeled
internal foundations, not claimed native character construction. No socket scale
inheritance, universal controller/2D bones, automatic rename migration, Game29,
consumable phase146, physical gamepad, file-protocol offline or forced-GC claim.
Fresh finala30b native proof:105622730 CLOSED11 named RightHand/LeftGrip choices,
exact history/no-ops/SaveLoad and actual animated F/I/W movement45 samples per
binding per tier in Source/Editable/Playable.105654946 CLOSED5 shared socket
rename/offset changed-only Undo/exact Redo/no-op/SaveLoad and Play lifecycle.
105756668 CLOSED6 retained missing/duplicate bindings and explicit clear history;
distinct imported asset IDs prevent previous fixture merge ambiguity.105815694
CLOSED2 Source first-person camera-local placement compatibility. All start/final
fingerprints match a30b; page/console errors and external requests are empty.
Root reviewed raw observations and named LeftGrip, Playable attached relic,
shared socket history and Source first-person PNGs.24 final observations total.

Final integrated105656500 CLOSED8: normal suite, engine/catalog28/bothsites,
syntax678/JSON43/diff; start/final/independent closing a30b match. Earlier9188 full
and native passes are preserved, not transferred. Play-Inspector oracle failure,
real mesh→socket failure and repeated-asset fixture failure are distinctly labeled.
Equipment definitions belong to level Player settings, not placed Prefabs;
shared character socket assets survived exact exports, but this final campaign
does not claim separately exercised placed-character Prefab capture/reuse.

Shared socket renames may deliberately leave old name bindings unavailable; they
are retained for explicit repair, never silently retargeted.
