# Phase 030 Report — Sprite Starters and Epoch 03 Dogfood

Status: qualified. Phase 030 adds a bounded three-entry Sprite starting workflow and qualifies one internal visible-control dogfood project without creating public game 29 or implementing Phase 031.

## Baseline and preservation

- Baseline HEAD `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`; the heavily dirty pre-existing worktree was preserved.
- Phase 029 baseline: engine 164,608 bytes / 42,346 gzip; 1,268/1,268 integrated; 906/906 Phase 011–029 focused; 28/28 public games; about 1,604 KB editor package.
- No reset, clean, discard, commit, push, deploy, DNS change, public catalog addition, or game 29 occurred.

## Architecture and starters

`editor/src/00-sprite-starters.js` is a small UMD/CommonJS data-and-creator module with stable IDs `sprite-2d-scene`, `sprite-animated-character`, and `sprite-parallax-hybrid`. Each call builds then deep-clones a current-format project and gives it a fresh ordinary name. The first-run cards call the existing full project loader; the starter ID is never serialized and starter source is not mutable through an instance. Start Blank remains first.

2D Sprite Scene supplies an Orthographic XY Camera, Background/World/Foreground layers, Far Background parallax, and one removable local placeholder. Animated Character supplies deterministic local atlas art, Idle/Walk/Attack, Loop/Once and nonuniform timings, explicit right direction, Mirror X and a distinct left Walk Clip, plus Footstep and Attack Hit events. Parallax Hybrid Scene supplies Far/Mid layers, Smooth/Pixel Sprite Assets, background/world Sprites, a Nine-Slice sign, one opaque Cube, and a transparent Billboard explicitly Behind Sprites.

All three clean-origin visible browser runs instantiated from the welcome cards, validated with zero structured issues, saved normally, and produced ordinary Editable and Playable exports. Repeated instances are deep-independent, removal/customization retains validity, dependencies are local/self-contained, and normal export pruning is retained.

## Internal dogfood and browser/export evidence

`Phase 030 Sprite Dogfood` began from the visible Animated Character card. Visible controls added Far/Mid parallax, Background/World/Foreground artwork, Nine-Slice, an opaque Cube Prefab with multiple instances, a transparent Billboard In Front of Sprites, Pixel and Smooth filtering, Walk/direction/Attack control behaviors, and a Footstep Event → Show Message listener. Idle/Walk/Attack, Loop/Once, nonuniform timing, Mirror X, a distinct directional Clip, and semantic events came from the ordinary starter records and remained fully editable.

The break/repair pass cleared Walk's Clip and produced two structured errors: the missing State Clip and the event listener's now-unassigned Clip. Restoring Walk returned validation to zero. Save/reload restored the project. Play visibly emitted `Footstep event received`.

The isolated audit produced a 1,664,625-byte Editable export and a 1,664,663-byte Playable export. Editable booted, reopened editor chrome, changed initial State to Walk and Direction to Right through real Inspector controls, entered Play, and observed the Footstep reaction. Playable booted with no visible editor chrome and observed the same reaction. Both made zero external requests and raised zero page or console errors. Chromium emitted its standard AudioContext-without-user-gesture warning once per isolated file boot; it was reviewed, is unrelated to Sprite starters, and no unexplained warning remained.

The captured project is `qualification/phase-030/phase-030-sprite-dogfood.json`; structured evidence is `phase-030-dogfood.json`. Neither is under public game build paths. `games/catalog.json` remains 28 entries and neither public navigation source contains the dogfood name.

## Creator outcome, friction, and boundary

The end-to-end common path used no code, JSON editing, raw IDs, developer console, or hidden import. Dense Inspector action selection remains real friction. AFR-0001 is narrowed but stays CONFIRMED for Tilemaps, 2D collision/physics, dedicated controllers/input, and genuine pixel-perfect Camera authoring. Sprites / 2D remains B; Animation remains C; Tilemaps remains D.

Phase 031 prerequisites are present and qualified, so the recommended next phase is Phase 031 — Tile Palette and Tileset Foundation. Phase 031 itself was not started. Generalized templates remain owned by Phases 201–210.

## Final qualification

- Engine: 164,608 bytes / 42,346 gzip, unchanged from Phase 029 (0 / 0 delta); 22 engine source files.
- Phase 030 focused: 67/67.
- Phase 011–030 focused: 973/973; Phase 011–029 remained 906/906.
- Integrated: 1,335/1,335, including Showcase 15/15 and public-site integration 1/1.
- Public games: 28/28; catalog 28; no dogfood route.
- Engine-site: path safety passed, 28/28 examples and all links resolved; editor package 1,617 KB (+13 KB from Phase 029), total 222.5 MB.
- Games-site: path safety passed, 28/28 games and all links resolved; total 142.7 MB.
- Browser/export audit: three starters plus Editable and Playable dogfood exports passed; zero external requests, page errors, console errors, or unexplained warnings.

From the Phase 020 Epoch 03 entry boundary to Phase 030, engine size grew from 160,854 / 41,445 gzip to 164,608 / 42,346 (+3,754 / +901), editor package from 1,455 KB to 1,617 KB (+162 KB), integrated coverage from 711 to 1,335 (+624), and the focused Phase 021–030 chain added 624 checks. Public games remained 28.

PHASE_030_SPRITE_STARTERS_QUALIFIED

EPOCH_03_SPRITE_ANIMATION_2D_SCENE_QUALIFIED
