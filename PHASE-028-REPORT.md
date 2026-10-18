# Phase 028 Report — 2D Camera Mode and Orthographic Scene Authoring

Status: qualified. Phase 028 adds orthographic authoring to the existing Camera without starting Phase 029.

## Baseline, preservation, and build

- Baseline HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; the pre-existing dirty worktree was preserved.
- Baseline: engine 161,942 bytes / 41,634 gzip, full suite 1,163/1,163, Phase 011–027 801/801, 28/28 games, editor package 1,455,983 bytes.
- Final: engine 163,664 bytes / 42,050 gzip (+1,722/+416), full suite 1,218/1,218, Phase 011–028 856/856, Phase 028 55/55, and 28/28 games.
- Final engine-site editor package is 1,599 KB; complete engine-site package is 222.0 MB. Game catalog, site path-safety, broken-link, and public-site gates passed with 28 public games and four Featured examples.
- No reset, clean, discard, commit, push, deployment, DNS change, or game 29 occurred.

## Runtime and authoring result

- `Camera` schema v2 supports `perspective|orthographic`; missing historical values remain perspective. Orthographic Height is the full vertical span, defaults to 10, validates finite positive values, and derives width from the actual viewport aspect with a safe aspect fallback.
- Orthographic screen rays are parallel with plane-shifted origins. Camera Z does not change projection scale. Perspective rays and distance scaling remain unchanged. Near/Far retain the existing clip convention.
- `2D Camera` creates the ordinary Camera kind in fixed mode near Z 10, facing canonical XY with forward -Z. Arbitrary three-axis rotation uses forward and up vectors; Align to 2D Plane restores the canonical orientation.
- The mode-aware Inspector shows FOV or Orthographic Height while preserving the inactive value. It also exposes Projection, Near/Far, Position, Rotation, View Through Camera, Return to Scene View, and Make Active Camera.
- The selected orthographic camera has an editor-only, aspect- and rotation-aware frame. Numeric height is intentionally used instead of a direct resize handle.
- Active camera is unique, persists, is not copied onto duplicates, applies before fresh-Play and level-transition parallax capture, and switches the real projection/height/matrices.

## Persistence, validation, composition, and export

- Projection, FOV, height, clip range, rotation, position, active state, and stable identity survive save/load, level storage, duplication, and both standalone export tiers. Historical and malformed data have safe runtime defaults while structured validation keeps invalid authored values visible for repair.
- Phase 027 parallax remains the same stable-eye, world-axis render-offset service. Projection and orthographic height are not formula inputs; active-camera identity changes recapture the reference.
- Sprite, Pixel sampling, Nine-Slice, Flip X, initial direction, sorting, parallax, Billboard, and Mesh were exercised through visible controls. The full Phase 011–027 regression chain covers animation clips/states/events/directional variants and all existing Sprite contracts under the shared renderer.
- The independent export audit clean-booted real Editable (1,659,939 bytes) and Playable (1,659,999 bytes) HTML files. Both restored two camera modes, active schema v2 height 12, two Sprites, Billboard and Mesh, proved exact Z-invariant scale and parallel rays, switched back to perspective, made zero external requests, and raised zero page errors. Editable reopened with the projection-aware Inspector; Playable exposed no editor control.

## Visible browser dogfood

- At `http://127.0.0.1:8843/editor/`, a blank project received a 2D Camera, perspective Camera, Sprite, Billboard, and Cube through palette drag controls.
- View Through Camera exercised height 12, 6, and 18; camera Z moved 10 to 30 without changing object size; Return to Scene View restored authoring navigation.
- Save, fresh navigation, and Load Selected restored `Phase 028 2D Camera` with orthographic projection, fixed mode, active state, Z 30, and height 18.
- A local 64×64 Sprite fixture was imported visibly, configured with pixel sampling and 8/8/8/8 guides, placed, changed to Nine-Slice, flipped X, set to Right direction, and assigned a named 0.25/0.25 parallax layer. The Inspector reported effective factors 0.25/0.25.
- Final validation reported `No structured authoring issues found.` Both export commands completed and the browser recorded no warnings or errors.

Structured evidence is in `phase-028-dogfood.json`; standalone proof is in `phase-028-export-proof.json`.

## Capability and scope boundary

- Sprites / 2D remains B and Animation remains C. Orthographic authoring removes a major 2D framing gap but does not close the broader 2D product surface.
- Deferred: automatic pixel-perfect scaling, reference resolution/crop policy, follow camera, bounds camera, UI Canvas, 2D collision/physics/controllers, and Phase 029 hybrid-scene redesign.

PHASE_028_2D_CAMERA_READY
