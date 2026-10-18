# Phase 029 Report — 2D / 3D Hybrid Scene Rules and Layering

Status: qualified. Phase 029 defines explicit Sprite / opaque / transparent / Billboard ordering without starting Phase 030.

## Baseline, preservation, and build

- Baseline HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; the heavily dirty pre-existing worktree was preserved.
- Phase 028 baseline: engine 163,664 bytes / 42,050 gzip, full suite 1,218/1,218, Phase 011–028 856/856, and 28/28 games.
- Final: engine 164,608 bytes / 42,346 gzip (+944/+296), full suite 1,268/1,268, Phase 011–029 906/906, and Phase 029 50/50.
- All 28 playable games rebuilt. Engine-site path safety and 36 broken-link checks passed; the package contains 28 public examples, four Featured, a 1,604 KB editor, and 222.1 MB total. Games-site path safety and 28 broken-link checks passed at 142.3 MB.
- A narrow Windows served-artifact lock was reproduced during qualification. The build now retries only transient `UNKNOWN`/`EBUSY`/`EPERM` writes for up to five seconds; persistent and unrelated failures still surface.
- No reset, clean, discard, commit, push, deployment, DNS change, or game 29 occurred.

## Runtime and authoring result

- The canonical order is opaque 3D, transparent Meshes/Billboards Behind Sprites, the complete Sprite pass, then transparent Meshes/Billboards In Front of Sprites.
- `spritePassRelation` accepts only `behind-sprites` and `in-front-of-sprites`. Missing or malformed runtime values fail safely to the historical Behind Sprites behavior.
- Opaque objects ignore and hide the relation while retaining it for a lossless alpha round trip. Sprites never own it and retain Sorting Layer → Order in Layer → stable Object ID ordering.
- Both transparent bands keep depth testing on and depth writes off, so In Front of Sprites is not an x-ray. Each band sorts farthest-first from the active camera and uses stable Object ID for exact-depth ties.
- The same classifier and comparator serve perspective and orthographic cameras. Active-camera switching changes the eye used for sorting without changing authored relationships.
- Billboard camera-facing behavior, Phase 027 parallax, nine-slice contiguity, animation clips/states/events, direction, Flip X/Y, tint, and opacity remain independent.
- The Inspector exposes Hybrid Layering / Relative to Sprites only for transparent Meshes and Billboards. Opaque objects get an inactive explanation; Sprites get a read-only hybrid summary. Project help states the complete pass order and depth policy.
- Structured validation reports `hybrid-sprite-pass-relation-invalid` while preserving the repairable value. Runtime still falls back Behind Sprites.

## Persistence, export, stress, and browser evidence

- Save/load, duplicate, prefab/update, level records, Editable export, and Playable export share the ordinary cube record path. No asset dependency was added.
- The independent audit clean-booted Editable (1,665,410 bytes) and Playable (1,665,470 bytes) exports. Both restored Behind and In Front relationships, a camera-facing Billboard, and a Sprite with no relation field; they made zero external requests and raised zero page errors. Editable reopened with the relation Inspector, and Playable exposed no editor chrome.
- The stress audit rendered 1,000 Sprites, 251 Behind objects, 252 In Front objects, and 285 opaque objects (meeting or exceeding the requested 1,000 + 250 + 250 + 250 matrix) and completed its two-frame setup measurement in 93.2 ms on this machine.
- Visible browser dogfood created a real World-Space Billboard, set Transparency to 0.45, selected In Front of Sprites, and displayed the depth/no-x-ray explanation. Project help showed the canonical pass order and Project Validation reported `No structured authoring issues found.`
- Perspective and orthographic camera switches retained the relationship while Billboard facing updated. A duplicate preserved both the authored and runtime relation.

Structured evidence is in `phase-029-dogfood.json`. Contracts and the future seam are in the four hybrid/depth contract files and `UNIVERSAL-TRANSPARENT-INTERLEAVING-FUTURE-SEAM.md`.

## Capability and scope boundary

- Sprites / 2D remains B and Animation remains C.
- This is a bounded two-band alpha solution, not universal order-independent transparency. Arbitrary per-object interleaving, weighted blended OIT, per-pixel linked lists, UI Canvas, Tilemaps, 2D physics/controllers, and Phase 030 remain out of scope.

PHASE_029_HYBRID_SCENE_RULES_READY
