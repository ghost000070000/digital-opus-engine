# Phase093 — Mouse, keyboard, gamepad and touch mapping UI

Qualified locally2026-10-10. Final fingerprint:
`9bc1af8dcc10fd9ecb2c343027f84a7900c8951f43f7d86e3260c3027facae27`.

Creators configure a named canonical Input Action's keyboard-or-mouse primary,
standard gamepad button/directional axis and named touch button. Custom Actions
can be touch/gamepad-only without a dummy keyboard key. Author defaults remain
separate from local player preferences. Device records are independently versioned
and persist through history, Save/reopen and both export tiers; missing, duplicate
or unsupported selected records are retained without aliasing replacement IDs.
Action-set membership remains discoverability, never permission to gate gameplay.

## Reopened shared prerequisites

Actual source RED proved independent device release loss, gamepad shared-code
last-writer loss and stale keys on rebind/disconnect. Canonical Input now retains
source leases, and the existing gamepad poll ORs target codes and releases previous
routes. Fixed/mapped touch buttons retain per-pointer captured code ownership.
Stop/restart and level changes explicitly release touch leases without dropping
physical keyboard/mouse holds. Explicit touch/pen cancellation no longer clears
physical mouse ownership. Permanent actual Input/bridge regressions cover these.

Touch controls use eight named buttons per bank with visible Previous/Next Actions;
actual-source tests reach all128 supported custom Actions and release old-bank
leases. No new joystick layout system, alternate input clock or Custom Script.

## Reality over paper qualification

Frozen ac3bd70c browser16, prior09112/09220/core14 and normal command8 passed.
They remain diagnostic evidence, NOT the final candidate: actual-source scale
review subsequently measured ~271ms no-pad polling for128 mappings. The equivalent
permanent RED measured293ms and140 identity rescans. Repeated library validation
in a frame was a material performance defect despite green browser/synthetic gates.
See qualification/phase-093/PERFORMANCE-REVIEW.md for exact Node VM conditions;
these measurements are not browser frame rates or physical gamepad acceptance.

The repair compiles bounded validated transient device routes and logical identity
metadata once per Play session. Existing polls reread player/default target codes
without rebuilding metadata; disconnected/no-pad paths release owned leases and
return without catalog scans. Runtime caches are not serialized. New sessions and
project loads rebuild them, while authoring mutations invalidate them.
Fresh actual-source scale, native128-Action input/browser observations, exact
exports, prior browser gates and normal full command qualification passed.

## Final frozen evidence

- `qualification/phase-093/device-mappings-browser-20261010T114355064Z/proof.json`:
  19 native gates,11:43:55.068–11:44:10.958Z. Source/exact Editable/Playable real
  right-mouse authored input, device-only touchscreen Pressed/Held/end/cancel,
  history/reset/Save/reopen, pagination, held-touch Stop/restart and missing-ID
  inertness.128 valid custom Actions; ten explicit device records in this fixture.
  No connected pad; physical gamepad not claimed. Start/final fingerprint match.
- Prior09112: `qualification/phase-091/input-actions-browser-20261010T114417204Z/proof.json`.
- Prior09220: `qualification/phase-092/input-action-sets-browser-20261010T114435886Z/proof.json`.
- Prior core14: `qualification/phase-073/core-browser-20261010T114451191Z/proof.json`.
  Core records matching start only; unchanged root/final command fingerprint
  brackets its completed run. All four browser proofs have empty page/console/
  external-request arrays. All browsers closed. Root reviewed final device form
  and Playable touch bank/prompt screenshots; no inherited fixture overlap remains.
- `qualification/real-demo-collision/regression-20261010T114506305Z/results.json`:
  8 normal gates PASS,11:45:06.307–11:46:38.094Z, start/final match: integrated,
  engine, all28 catalog, both sites,467 JS syntax,40 JSON and git diff check.
  This is current packaging/regression evidence, not a fresh all28-gameplay soak.
- Permanent actual Input ownership11, pure mapping/compile/lifecycle11, actual
  bridge/host validation/history/serialization/mounted UI and actual cache
  lifecycle regressions registered and green. No-pad source fixture measured
  0.2155ms with zero catalog/identity scans; connected128-route100-poll fixture
  measured69.71ms total in a focused run. Timing is diagnostic, not a speed promise.
  Permanent count oracles prevent per-frame authoring rescans and prove live
  player rebinds, old-code release, deletion/reset and new-session invalidation.

Browser frame observations:60 intervals per tier with128 custom Actions/no pad.
Source mean33.37ms/p95 33.5/max33.8; Editable33.372/33.5/33.6; Playable16.685/
16.8/16.8. Chromium used/total heap estimates respectively36,748,456/45,645,656;
8,254,471/12,705,215;8,463,839/12,902,163 bytes. Short machine-specific samples,
not hardware guarantees, leak-stability proof or forced-GC claims. Actual inputs
remained functional during these observations. Historical collision acceptance
is retained; no overall product readiness is asserted.

Limits: primary input is keyboard OR mouse, not multiple physical keyboard/mouse
chords; standard-index gamepad sources, first connected pad, existing deadzone/look
defaults. Start/Menu remains reserved Pause; paused screens use visible Resume/Close.
No connected physical gamepad available: deterministic actual poll fixtures are
not hardware acceptance. Touch input is injected through Chromium's real input
protocol, not physical touch hardware. Contexts, tuning, auto device prompts,
joystick layout and generalized player rebind generator remain their roadmap.
Project-local references,128 mapping records and128 custom Actions; unrelated
future records are preserved. No Game29, deployment, commit/push or overall product
readiness verdict.
