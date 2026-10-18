# Phase 109 — Camera shake/impulse presets

Status: COMPLETED. Epoch11. Qualified2026-10-10T20:12:31Z; native tracker
109→110 verified20:12:54Z. Finalcanonicalfingerprint:
b3f9d89b896fb5ae88e917168aef68a5407f1b8433ce111443c9e6ec084442c7.

## Real baseline

On the qualified108 source fingerprint
6a1497c1a68d912851cf6ed3efa1fb510d44ddf3e82402986c90069e69d4b6bd,
the actual Shake Camera Action exposed only numeric Intensity and Duration.
Native campaign195035328 preserved six observations and the ordinary Inspector
screenshot. Explicit authored intensity0 produced intensity0.3 and nonzero
rendered shake. Pause froze the effect and Resume continued it; preserve that
working behavior. Restart retained the ongoing effect, while Stop cleared it.

Actual-source tests at19:50:19.7389845Z preserved1PASS/5FAIL before source repair:
omitted Custom defaults0.3/0.3 work; explicit zero input, nonfinite Action input,
invalid tick delta and Restart cleanup need bounded correction. The109 contract
adopts immediate no-effect/cancel for explicit zero and lifecycle cleanup; it
does not pretend these were documented historical Restart semantics.

Evidence: qualification/phase-109/actual-camera-shake-red.json,
camera-shake-browser-20261010T195035328Z/proof.json, root-baseline-review.json.
Root independently reviewed the native authoring screenshot and reran the actual
host defects while authorized public-kernel implementation was beginning; that
rerun is not falsely attributed to a frozen baseline fingerprint.

## Implementation and qualification

Implemented: extend the existing Action with discoverable opt-in presets
and world-axis directional impulse, public pure sampling and one existing effect
owner. Preserve historical Custom positive values, damage/weapon callers and
replacement semantics. No competing Camera runtime or component.

Root actual-source16 PASS. Fresh integrated195555771 passed all8 gates with
521 syntax files,40 canonical/program JSON files,28-game build and both sites;
start/final fingerprint9218f918e04e6ede69dbbaee83f6d66866e6331c0f630b4f680f243e764df2ec.
Earlier writer-reported candidate used the legacy Phase049 fingerprint file set,
not the canonical product-program file set. A same-process read-only comparison
proved that method difference; those hashes are not substituted for canonical
qualification. Exact proof boundaries are in command-candidate-review.json.

Further audit found a genuine creator mismatch on this candidate: the actual HUD
field renderer displays omitted Custom values as0 although the Action defaults
to0.3. Executed actual renderer regression19:58:54.7756922Z preserved17PASS/1FAIL
before repair, evidence hud-default-authoring-red.json. The added public Custom
sampler rejection regression passes. Integrated success does not close this gap.

Native195942411 then reproduced the mismatch through ordinary HUD input on9218,
with matching start/final fingerprint and empty browser logs. Scoped fallback
repair preserves omitted fields as blank with0.3 placeholders, explicit0 as0 and
other Action numeric defaults unchanged. Root actual18 now pass. Fresh full
200040442 passes all8 gates with521syntax/40JSON/28build/bothsites/diff on frozen
b3f9d89b896fb5ae88e917168aef68a5407f1b8433ce111443c9e6ec084442c7.
That checkpoint remained unqualified until the final native campaign below.

## Final native acceptance and independent review

Finalcampaign200748001 closed50PASS on matchingb3f9start/final, all browser,
console and observedexternalrequest arrays empty. Actual controls/input prove
named preset and signedworld-axis authoring, invalid/no-op feedback, oneUndo/Redo,
duplicate/placedPrefab parameters, omittedCustom blank/.3 defaults, Save/reopen,
exactEditable/Playable and built-site behavior. Four named presets in each of
Source/Editable/Playable/BuiltSite use intendedFixedCameraobj44; root recomputed
16 same-frame renderedEye−publicbaseEye−effectOffset residuals≤1.61e-15. All
expiry offsetsnull and eyeequalsbase exactly. Pause freezes/Resume advances,
Restart clears; nativeStop clears Source/Editable/BuiltSite (Playable has no
editorStop affordance). Author options remain unchanged.

Root reviewed readable preset/help/defaultfields and actualPlayableWorld−X
screenshots; root-native-review.json records arithmetic/lifecycle independent
review. Prior108 nativeframing39/rollback14 repeated on sameb3f9 pass. No fresh
all28 gameplay/soak claim. Final full200040442 all8 plus actual18 qualify.

Failed qualifier attempts retained: redundantPlay after EditThisGame already
stoppedPlay; built-site autostarterChase imported before nativeStop; private
minified _baseEye observer absent. These are automation/setup failures, not
product collision/effect defects. Earlier root stationary-base oracle failure
is preserved, not silently countedPASS. Final qualifier opensauthoring/stops
starter before importingfixture and samples publicFixedbase in sameframe.

Limits: Custom retains historical per-frame randomness; new named effects sample
simulationtime. Oneowner replacement, no additive stack. Directions are world
axes, not screenaxes. Presentation displacement is not collision-aware or a
full-frustum containment guarantee. Internalportable fixture, not blank-world
authorship; no physicalhardware/forcedGC/offlineprotocol or publicdeployment claim.
See qualification.json, native-summary-20261010T200809Z.json and rawproofpaths.
