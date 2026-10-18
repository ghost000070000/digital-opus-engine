# Phase093 — Mouse, keyboard, gamepad and touch mapping UI

IN PROGRESS. Exact authoritative title; dependency092 qualified. Existing
canonical Input Actions and player preferences remain owners of logical identity
and primary keyboard/mouse defaults. Add discoverable named-Action device mapping
controls, not another polling system or a Script requirement.

## Proven prerequisite and repair

Actual-source RED demonstrated last-writer gamepad alias loss, stuck codes after
rebind/disconnect and device releases clearing another device's held input. Input
now owns per-source leases, physical keyboard/mouse owners stay independent, and
the existing poll ORs desired codes and releases previous codes. Touch retains
per-pointer captured codes. Integrated tests pass; rebuilt1474 native transport
passed five actual keyboard/mouse/browser-injected-touch overlap/cancel gates.
Stale generated-runtime failure is preserved separately, not a source verdict.

## Creator contract

Project Input Actions shows a typed named-Action picker, keyboard capture and
explicit Left/Middle/Right mouse choices, standard gamepad button/directional-axis
choices, and an on-screen touch-button option. Primary keyboard-or-mouse bindings
stay in inputActionMap; versioned project inputDeviceMappings contains per-Action
gamepad sources and touch visibility. Absent records retain historical mappings;
explicit empty sources disable that device for the Action. Shared inputs are
allowed with visible warnings and aggregate OR semantics. Set membership remains
discovery, never gameplay gating. Reset restores historical device defaults with
one Undo entry. Unknown/future/duplicate records remain preserved and unavailable
for mutation rather than silently overwritten.

Custom Actions may be gamepad/touch-only without a dummy keyboard key. A validated
available custom Action with no physical default uses a stable internal logical
code in the SAME Input transport; no second scheduler or hidden Script. Missing
or deleted identities never execute or alias a replacement. HUD help must show
device-readable guidance rather than exposing the internal code.

Reuse existing gamepad poll and touch controls; authored touch Actions use the
same canonical pressed/held transport and named buttons. Preserve historical
direct touch gameplay helpers for unconfigured projects. Do not add095 sensitivity,
096 contexts,097 dynamic prompt switching, or098 joystick layout authoring early.
Stop/blur/cancel/disconnect/rebind cleanup must remain ownership-safe.

## Gates

Bounded finite plain JSON, strict IDs/version/device sources; history/no-op and
invalid-write safety; independent Save/reopen and Editable/Playable transport;
retained missing references and high-water identity reservation; creator keyboard
and mouse authoring; actual browser touchscreen input; actual-source gamepad
fixture through the real poll path. No connected physical pad is available: never
describe its deterministic fixture as physical hardware acceptance. Native
browser evidence must identify that limitation, real input, errors and exact
exports. Prior091/092/core browser and normal integrated/build/sites/catalog
gates after the final candidate freezes. No093 completion before authoring and
export evidence qualify.
