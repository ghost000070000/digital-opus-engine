# Phase 038 Overnight Runbook

1. Confirm the Phase 037 ready verdict, record HEAD/branch/dirty state, and run engine, integrated, and 28-game baselines.
2. Run `node tests/phase-038-tilemap-chunks.test.js`.
3. Run `node tools/audit-phase-038-chunk-fuzz.js` and `node tools/audit-phase-038-serialization.js`.
4. Run `node tools/audit-phase-038-browser.js` for 30 isolated browser cycles and 10 Editable plus 10 Playable compositions.
5. Run a smoke endurance with `PHASE038_SMOKE=1 node tools/audit-phase-038-endurance.js 20`.
6. Freeze the Phase 038 source fingerprint, then run `node tools/audit-phase-038-endurance.js 10830`. Do not edit qualified sources while it is active.
7. After the continuous run, repeat focused tests, Phase 011–038, the integrated suite, engine/games/site builds, syntax, capability, friction, JSON, and diff checks.
8. Record exact evidence and use the ready verdict only if the fresh run exceeds 10,800 active seconds with no semantic mismatch.
