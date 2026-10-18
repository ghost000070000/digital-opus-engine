# Phase 020 Clean-Room Qualification

## Environment

- Date: 2026-09-14
- Source baseline: `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`
- Clean origin: `http://127.0.0.1:8876/editor/index.html?phase=20-final`
- Profile state: fresh localhost origin, first-run screen visible, no saved projects, no imported assets
- Start path: **Start Blank**, then normal editor UI only
- Project: `phase-020-clean-room`

## Authored proof

The run imported three independent PNG sources through **Import as Sprite**: a transparent 64×64 image, a 16×16 pixel-art image, and a 128×128 atlas. It created 19 Sprite Assets before dependency pruning: three explicitly edited sources plus sixteen 32×32 grid cells from the atlas. Thirteen source-asset placements and five linked prefab placements produced eighteen Sprites; a representative Undo/Redo duplicate raised the saved per-level total to nineteen Sprites. A true world-space Billboard and one solid Cube completed the hybrid scene.

The run exercised:

- full-image and sub-rectangle Sprite Assets;
- Smooth and Pixel / Nearest filtering;
- Pixels Per Unit, natural size, custom and preset pivots;
- repeated Assets-row drag placement with collision-safe names;
- tint, partial opacity, visibility, authored rotation, Width/Height, direct viewport resize, and pivot drag;
- Default plus Background, World, Effects Layer, and Foreground sorting layers;
- rename-safe `sprite-layer-3` assignment across the `Effects Layer` rename and reorder;
- child parenting (`Sprite #18` under `Atlas Cell_001`);
- `Pixel Badge Prefab`, five linked placements, update-prefab-from-instance, and explicit update-instance-from-prefab;
- camera orbit with authored Sprites becoming edge-on while the Billboard remained camera-facing;
- opaque 3D depth alongside the Sprite pass;
- Save Project, full reload, Load Selected, two-level duplication, validation, Undo/Redo, Editable Export, and Playable Export.

## Defect found and repaired

The first clean-room attempts exposed a real state-identity defect. `syncSpriteRenderer()` called `ensureComponent()` after every Inspector input. Normalization replaced the component record, leaving the remaining mounted inputs with a stale reference. A later field or pivot/direct-manipulation operation could therefore restore older values.

The repair preserves an existing canonical live component object and invokes `ensureComponent()` only when the component is missing. Pivot, source-aspect, asset-pivot, and natural-size conveniences reacquire the selected component at click time. The complete sequence was rerun successfully: Width `1.4`, Height `0.65`, Opacity `0.65`, Tint `#88ccff`, Order `4`, preset pivot, `25°` authored rotation, viewport resize to approximately `1.513 × 0.65`, and pivot drag to approximately `0.060, 1.0` remained together.

## Persistence and export evidence

Reloading the browser and choosing **Load Selected** restored both the canonical source level and its duplicate, each with 21 placed objects, stable hierarchy and layer IDs, one linked Sprite prefab, 11 used Sprite Assets, and three required Textures. The original library contained eight additional unused atlas cells; both export tiers pruned `Atlas Cell_009` through `Atlas Cell_016` while retaining all used Sprite Asset → Texture dependencies.

- Editable export: `editable-game (13).html`, 1,512,657 bytes
- Playable export: `playable-game (11).html`, 1,512,695 bytes
- Both: two levels, 21 objects per level, 11 Sprite Assets, three Textures, one prefab, five sorting layers, no external HTTP script or stylesheet dependency
- Editable: no embedded playable-only lock
- Playable: embedded `window.__OPUS_PLAYABLE_ONLY__ = true` and the shared runtime refuses reopening editor chrome

Automated opening of local `file://` downloads was blocked by the browser security policy. The exported files were therefore inspected directly for their embedded project, closure, single-file/offline structure, and tier flag; existing export composition and runtime suites cover the shared boot path. This limitation was not bypassed.

## Validation and compatibility

The intact clean-room project passed Project Validation with **No structured authoring issues found** and produced no browser warnings or errors. The Phase 020 suite separately breaks and repairs missing Sprite Asset, missing source Texture, and missing Sorting Layer references against the same validation plumbing. Guarded UI deletion/reassignment behavior remains covered by the Phase 012/013/016 focused suites; destructive UI deletion was not invoked during this run.

Phase 011 direct-Texture Sprite records, Phase 012 asset records, Phase 013 sorting migration, Phase 017 opacity/filter defaults, Phase 018 atlas metadata, and Phase 019 placement records remain loadable through the shared current schema and focused regression suites.

## Result

The bounded Epoch 02 Sprite foundation is qualified. This is not a claim of a complete 2D engine: orthographic/pixel-perfect cameras, Sprite animation/playback, Tilemaps, and 2D collision/physics remain deferred.
