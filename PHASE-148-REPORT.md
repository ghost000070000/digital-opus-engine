# Phase 148 — Loot tables and deterministic drops

COMPLETED. PHASE_148_LOOT_TABLES_DETERMINISTIC_DROPS_READY

Qualified 2026-10-11T12:26:18Z on cddbe4489630bde2b779bfaf74c68e6fbd399824228c3420f626aa5518c86ace.

Project-local named, versioned tables provide ordered integer-weighted Pickup Prefab or explicit no-drop outcomes. Seed0 is supported. The ordinary Drop Loot Action, named pickers and deterministic preview need no Custom Script. Preview never consumes runtime progress. Whole Pickup Prefab allocation and canonical collection/capacity remain shared; dropping does not award inventory.

Definitions participate in changed-only history, duplication/removal, Project Save/Load and dependency closure across every potential outcome. Fresh Play resets independent counters; GameSave restores validated progress. Invalid references/assemblies refuse before drawing. Both exports validate and include the same public module.

## Qualification

53 permanent regressions pass: pure18, actual runtime14, persistence6, authoring9 and packaging6. Final integrated suite, editor build, 28/28 catalog build, both sites, syntax693, JSON43 and diff checks all pass with matching start/final fingerprint.

81 fresh native observations pass on this fingerprint: primary59, library8 and capacity14. Actual Q/F/R/V input proved deterministic Red/Blue/Blue/no-drop replay, visible drops followed by canonical collection, GameSave resume, independent library history and full-capacity refusal retaining the visible drop without another draw. Source, Editable and Playable agree. Browser/console errors and external requests are empty. Root reviewed raw proofs and visible drop/panel PNGs.

Evidence: qualification/phase-148/final-qualification.json; native-loot-20261011T121843048Z/proof.json; native-library-20261011T122032870Z/proof.json; native-capacity-20261011T122205998Z/proof.json. Full command evidence: qualification/real-demo-collision/regression-20261011T121904042Z/results.json. Physical-packaging-final.json verifies 56 catalog/site artifacts include exact module bytes once before core, and the engine-site copy matches (57 checks). Packaging is not fresh gameplay acceptance of all28.

## Repairs and preserved evidence

Observed reds led to descriptor-safe portable data copying, detached Apply drafts, pre-allocation malformed assembly/finite-position checks, and safe native captured Prefab copying that permits canonical optional undefined object fields without weakening table validation. Getter lookup no longer executes before preflight. Catalog/site builders now include the module. Historical thin VM fixtures load real dependencies; assertions were not waived. Failed product and harness attempts remain preserved separately; candidate passing evidence was not transferred to this final run.

## Intentional limits

This bounded contract chooses existing interactable whole Pickup Prefabs. No automatic death hook, nested loot, rarity taxonomy, new inventory, shop, external Trigger collector picker or legacy Spawner rewrite. Counter persistence does not promise restoration of uncollected runtime entities. Cross-level reset semantics have source regressions, not a new native cross-level claim. No forced-GC, physical-gamepad, file-protocol offline or new all28 gameplay claim.

Dirty work preserved. No commit, push, deployment or new public game. Continue exact Phase149 Shop/vendor utility gate.

