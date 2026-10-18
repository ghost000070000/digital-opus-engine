# Phase 022 Report

## Outcome

Phase 022 makes a Sprite Animation Clip visually understandable without expanding into states, transitions, events, or directional animation. One dedicated editor now owns frame artwork, order, timing, preview, scrubbing, and Once/Loop authoring. Runtime and preview share one timing model.

Baseline was `main` at `f1dc3516b585ebf5aa868006792c1dc1b9039da9` with an intentionally preserved 336-path dirty worktree: engine 160,854 bytes / 41,445 gzip, integrated 757/757, Phase 011–021 focused 395/395, 28/28 games at 117.3 MB, and a 1,476 KB packaged editor.

## Implementation

- Advanced clips to v2 with `playbackMode: once | loop`; v1 and missing mode migrate to Once.
- Added shared derived duration, frame-range, time-map, playback-time, and seek helpers plus efficient modulo looping.
- Added the dedicated Animation Editor with atlas-aware thumbnails, broken slots, selection/playhead distinction, Add/Remove/Duplicate, native drag reorder, Left/Right fallback, typed Sprite picker, duration editing, and derived summaries.
- Added checkerboard natural-aspect preview with source-rect, transparency, and Pixel/Smooth handling. Play/Pause/Stop/scrub use shared timing state and remain scene-isolated.
- Kept runtime Stop/static fallback, per-instance `playOnStart`, geometry, sorting, materials, persistence, Prefabs, validation, and dependency closure compatible.

## Dogfood and exports

The UI audit created `Once Accent` (4 nonuniform frames), `Loop Cycle` (6 atlas-backed frames), and `One Frame Loop`; used all three across eight Sprites with mixed autoplay; saved and instantiated `Looping Atlas Sprite` three times; saved/reloaded the named project; and deliberately broke, detected, repaired, and cleared a frame reference. Native drag, accessible reorder, duplicate/remove, timing edits, Play/Pause/Stop, frame click, scrubbing control, restart, multi-wrap Loop, and stable one-frame Loop were exercised. A real atlas frame changed to Pixel / Nearest displayed with computed `image-rendering: pixelated`, clean validation, and no browser warnings/errors.

Real UI exports produced final 1,544,356-byte Editable and 1,544,394-byte Playable artifacts. The Editable booted, entered edit mode, reopened `Loop Cycle`, switched Once→Loop, scrubbed to frame 4 at 321 ms, previewed a wrap, and entered Play; an earlier exported pass also reordered and retimed the clip from 550 to 625 ms and wrapped to 70 ms after 770 ms. The Playable booted without editor chrome, visibly changed across 180 ms, and emitted no console errors or warnings.

## Verification and evidence

- Phase 022 focused: 61/61; Phase 011–022 focused: 456/456.
- Integrated: 818/818, including Showcase 15/15 and public-site integration 1/1.
- Engine: 160,854 bytes / 41,445 gzip, 22 sources; demo 178,748 bytes — unchanged from baseline.
- Existing games: 28/28, 118.0 MB total; no game 29.
- Engine-site: 1,501 KB editor, 28/28 examples, 219.2 MB total. The editor grew 25 KB from the 1,476 KB Phase 021 baseline.
- Games-site: 28/28 reviewed games, 139.5 MB total.
- Capability: 57 rows (A 5, B 32, C 18, D 1, N/A 1). Friction: 24 preserved records.

Browser evidence is in `phase-022-dogfood.json`; behavioral boundaries are in the three Phase 022 contracts and characterization. The intermittent Windows `UNKNOWN` bundle write lock seen in the baseline environment recurred twice; immediate clean retries passed and produced the unchanged bundle hash-size result.

Animation remains C and Sprites / 2D remains B. Phase 022 materially reduces form-heavy Sprite-frame authoring and lack of visual preview, but AFR-0009 still includes semantic 3D/skinned clip mapping and AFR-0010 still concerns multi-track Sequence authoring. Neither is closed.

## Remaining scope

Named states and transitions, automatic switching, animation events, directional/flip variants, orthographic/pixel-perfect cameras, Tilemaps, and 2D physics remain for later phases. Phase 023 is ready to begin only when explicitly requested.

## Verdict

`PHASE_022_SPRITE_ANIMATION_EDITOR_READY`
