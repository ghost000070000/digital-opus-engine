# Phase071 — Formal gameplay component registry

Candidate: `4ddb121ce57f2bf30a2f451f020a76f897569f6ed93e75edbe5084b3c9226638`.
COMPLETED. Fresh023402483Z seven public Playables actually started, accepted input,
moved, restarted natively and moved again; all four controller families,0 page/
console errors. This targeted compatibility run does not replace historical28-game
collision acceptance or claim another full soak. Drive241-row readback changed only
E72 COMPLETED/E73 IN PROGRESS. Continue072; overall product mission is not complete.

The existing OpusAuthoring registry now owns recursively independent frozen plain
metadata, rejects duplicate field keys/cycles, and exposes deterministic portable
`describe(id)` and `catalog()` contracts. Eleven existing definitions are retained;
the Add Component picker reads these same descriptions, ownership and versions.
No competing component execution system or placeholder gameplay components added.

Permanent red/green: caller-owned default mutation previously changed registered
defaults. Duplicate field keys were accepted. Native Source Play also proved Health
damage25→18 leaked into authoring after Stop. Capture/restore of surviving authored
objects' Health and non-mutating authoring serialization now preserve25 while live
runtime and game-world Save retain18. Legacy adapters and modern record consumers
remain authoritative. Missing apply hooks on modern records are not unsupported
runtime claims. Set Position/Move Object and collision semantics were not changed.

Final native `qualification/phase-071/registry-browser-20261010T023003037Z/proof.json`:
14 observations, three real canvas clicks, registry discovery/add, exact Undo/Redo,
independent duplication, Prefab library/link history, Save/reopen and native
Editable/Playable downloads and gameplay. Source/Editable/Playable all live18,
authored legacy/component25; no page/console/external errors. Health picker screenshot
was inspected in the preceding022629224Z run, with the same creator UI.

Prior event game `qualification/phase-070/event-game-browser-20261010T023107755Z/proof.json`
passes on this candidate:60 replay rounds,604 actual clicks,26 memory observations;
no browser errors. Not a new endurance/leak-free claim.

Full `qualification/real-demo-collision/regression-20261010T022949115Z/results.json`:
eight gates PASS,385 JS syntax checks,40 canonical/program JSON, integrated tests,
all28 game builds, engine/game sites and diff check, unchanged final fingerprint.
Permanent regression: `tests/phase-071-component-registry.test.js` executes canonical
registration and actual Health capture/serialization/world-save code. Historical
failed native proof files preserved. Full-suite fixture failures022439123Z and
022524676Z were repaired by checking the whole Stop function and loading the actual
new helper, retaining original assertions; not mislabeled as product failures.

Limits: bounded existing definitions; trusted plain metadata/function hooks, not an
extension security sandbox. Remove/reorder is072, new roles073 onward. Health Stop
restoration here covers surviving authored objects; destroyed-object recovery needs
explicit characterization before broader Health/Damage product claims. No Game29,
public deployment, commit or push. Capability grade remainsB, not an inflatedA.
