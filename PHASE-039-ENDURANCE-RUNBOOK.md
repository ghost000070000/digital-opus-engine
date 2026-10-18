# Phase 039 Endurance Runbook

Run `node tools/audit-phase-039-endurance.js`. The default is one continuous 60-minute active run; `PHASE039_SOAK_MINUTES` exists only for smoke qualification. The harness repeatedly verifies the checked-in dogfood bundle, plans clean and collision-heavy imports, materializes independent state, re-exports, checks byte identity on clean cycles, checks envelope/blob hashes, and injects transaction failures.

It writes a heartbeat at least once per minute to `qualification/phase-039/endurance.json`, tracks heap/RSS observations, and fingerprints the implementation at start/end. A passing closure requires the full duration, zero mismatch/error, and an unchanged fingerprint. Browser qualification is separate in `tools/audit-phase-039-browser.js`.
