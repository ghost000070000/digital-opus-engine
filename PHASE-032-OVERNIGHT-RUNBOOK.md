# Phase 032 Overnight Qualification Runbook

Run from the repository root with the bundled/current Node runtime:

1. `node tools/audit-phase-032.js`
2. `node tools/audit-phase-032-fuzz.js 100000`
3. `node tools/audit-phase-032-endurance.js 7200` (two hours; use 14400 for four)
4. `node tests/run-tests.js`
5. Run Phase 011–031 tests, build the engine/editor/catalog, then dogfood editor plus Editable and Playable exports in a real browser.

Record actual start/end times and duration. A short endurance invocation is useful evidence but must not be described as the preferred two-to-four-hour soak. Record any server/browser process PID in `qualification/phase-032/overnight-state.json` and terminate only campaign-owned processes.
