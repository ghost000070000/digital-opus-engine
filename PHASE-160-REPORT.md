# Phase160 — Adventure template dogfood

COMPLETED — bounded internal creator-workflow qualification, 2026-10-11. Not overall product readiness or a public genre-kit release.

Final source fingerprint: `cfeaf90acb6de4f8c38fba971547bc22596d629cee960600c88dbbde463b4a11`.

The native-authored internal Adventure combines named Objectives, conditional Guide dialogue, a real key Pickup, an explicitly persistent collected object, checkpoint Autosave, camera, Prefab, and ordinary opening/New Game/Continue/Win/Lose flow. No Custom Script or competing quest runtime was added. Geometry and prior named definitions were imported as a foundation; gameplay composition was performed through normal editor controls.

Final real browser run `native-adventure-20261011T172019715Z`: 37 observed passing steps, browser errors empty, source fingerprint stable, resources closed. Source, exact Editable and exact Playable were actually driven with keyboard/interact input: premature exit blocked; key acquired; conditional return completed the first Objective and activated the next; checkpoint saved; New Game reset inventory/world; Continue restored inventory, Objective/checkpoint and removed key; exit won; fresh replay reached Lose. Native authoring covered Undo/Redo, independent Prefab tuning, project Save/reload/Load and missing Item/Objective references with refused invalid Save and Undo restoration. Root reviewed final pickup, missing references, Win and Lose screenshots.

Dogfood found a shared Item reference picker defect: deleting the last definition hid the retained saved reference. The narrow editor repair removes the empty-catalog early return and retains the existing disabled unavailable option. Actual-source RED and native RED are preserved in qualification/phase-160/item-picker-red.json and the failed171837 run. Five permanent production-code regressions are registered, including empty-catalog picker and persistent/nonpersistent pickup Autosave/Load policy. Focused155 (8) and142 (13) also passed.

Final regression `regression-20261011T172039107Z` passed all eight gates: integrated suite, engine build, 28-game build, both sites, syntax735, JSON43 and diff check. Start/final fingerprints match. Build is not substituted for gameplay acceptance.

Earlier failed attempts are retained: flat Top-down solid floor was a content-role mismatch under existing XZ guidance; persistent removed-key recovery requires explicit World State opt-in; one dialogue assertion was a harness frame-timing miss. These were not misrepresented as shared solver defects. Historical teleport/default persistence semantics remain unchanged.

Internal reusable project: qualification/phase-160/native-adventure-20261011T172019715Z/native-adventure-saved.json. Matching exports, raw proof and screenshots are alongside it. Epoch16 integrated review is recorded separately. Remaining intentional limits: primitive internal presentation, legacy Top-down ground semantics, shared same-origin save namespace, explicit effect repetition, no physical gamepad/offline/forced-GC claim. No public game identity changed or Game29 created.
