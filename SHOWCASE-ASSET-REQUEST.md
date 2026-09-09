# Showcase Asset Request — Foglight Flagship

**Verdict this asset request supports: `PUBLIC_SHOWCASE_BLOCKED_ASSETS_REQUIRED`.**

This repository/workspace does not currently contain a coherent art/audio asset set for a public Foglight showcase. Building visible characters, environment, or props out of primitive cubes/procedural placeholders and calling it "rebuilt" is explicitly out of scope for this pass. This document lists exactly what is needed instead.

## What was found in the workspace (asset inventory)

- `dogfood-assets/mist-guardian.gltf` — 1 mesh, 3 nodes, 1 skin, 1 animation ("Lurch"). This is a minimal two/three-joint test rig, not a finished creature (structurally identical to the "two-joint skeletal bend/ribbon fixture" this recovery pass explicitly protects against presenting as a character — see `PUBLIC-SHOWCASE-RECOVERY-REPORT.md` Section 6D).
- `dogfood-assets/relay-console.gltf` — 1 static mesh, 0 animations. A legitimate simple prop, but only one, and not part of a coherent Foglight-appropriate kit (vale/beacon/ruin/sanctuary).
- `dogfood-assets/beacon-ignite.wav` — one sound effect. Usable for beacon activation, but the audio kit needs far more than one clip (see below).
- `dogfood-assets/moss-stone.png` — one texture. Not a coherent material set.
- `tests/fixtures/skinned-bend.gltf` — an engineering regression fixture (2-joint bend rig), explicitly not for public use.
- No proper rigged Player character model with Idle/Walk/Run clips was found anywhere in the workspace.
- No proper Guardian/creature model was found (only the minimal test rig above).
- No tree, rock, ruin/wall/arch, gate, sanctuary-architecture, or dressing-prop models were found.
- No coherent ground/grass/rock/ruin-stone/wood/metal/emissive material or texture set was found.
- No ambient loop, footstep set, gate/interaction/damage/win/lose sound set was found (one `.wav` exists).
- No sky/panorama asset was found (the engine's existing procedural sky gradient is available and acceptable per Section 11's art direction, so this slot can be satisfied procedurally — see note below).
- A separate, unrelated marketing/branding asset pack was found at `Downloads/digital-opus-assets/` (logos, favicons, banners) — not applicable to in-game 3D/audio assets.

## Exact asset slots required

### Characters

| Slot | Format | Animations needed | Style notes |
|---|---|---|---|
| Player character | glTF/GLB, skinned mesh | Idle, Walk, Run, + one reaction/interact clip | Stylized low-poly, human or humanoid silhouette, readable in third-person at typical camera distance |
| Guardian creature | glTF/GLB, skinned mesh | Idle/Lurk, Move/Chase, Attack or Detect reaction | Stylized low-poly, silhouette clearly distinct from Player and from environment props, imposing but not photorealistic |

### Environment

- Trees and groundcover (at least 2-3 distinct tree/plant meshes for scatter variety)
- Rocks (2-3 sizes/shapes)
- Ruin/wall/arch pieces (a small kit: wall segment, arch, broken column or similar)
- One gate (with an obvious open/closed silhouette difference, or a simple animatable hinge/rise)
- Three visually distinct beacon props (they should read as "the same kind of object" as a set, but be placeable as 3 separate world landmarks)
- Sanctuary architecture (one small distinct structure/landmark different from the ruin kit, signaling "this is the goal")
- A handful of small dressing props (rubble, roots, lantern, statue fragment — whatever fits the low-poly fantasy direction)

### Materials/Textures

- Ground/grass texture (tileable)
- Rock texture (tileable)
- Ruin/stone texture (tileable)
- Wood or metal texture, wherever the gate/props need it
- An emissive/beacon material treatment (a texture or material config that reads as "lit" vs "unlit" for the beacon on/off states)

### Audio

- One ambient loop (vale atmosphere)
- Footstep sound(s)
- Beacon activation sound (have: `dogfood-assets/beacon-ignite.wav` — reusable if its licensing is confirmed, see below)
- A general interaction sound (distinct from beacon activation)
- Gate movement/open sound
- Guardian cue (detection/proximity sound)
- Damage sound
- Win sound/stinger
- Lose sound/stinger

### Presentation

- A sky/panorama treatment — **this slot can be satisfied procedurally** using the engine's existing gradient sky + fog system (already used across the current 28-game catalog), consistent with Section 11's "stylized low-poly atmospheric fantasy, do not chase photorealism" direction. No external asset strictly required here.
- Particle treatments for fog and beacon glow — also achievable with the engine's existing particle emitter system once the emissive beacon material above exists.
- UI typography/color treatment — a design decision, not an asset dependency; can be authored directly once the rest of the kit exists (so the palette has something to match).

## Licensing requirement

Every asset supplied to satisfy the slots above — whether authored, commissioned, or sourced from an asset store/marketplace — must come with its license terms and any required attribution recorded alongside it (a simple `LICENSES.md` or per-asset metadata is sufficient) before it is used in the Foglight rebuild. This pass will not download or use unattributed/unlicensed third-party assets to fill these slots.

## What happens once these are available

With a coherent set matching the above, the three-pass build described in the recovery report's own governing spec (Gameplay Greybox → Art Replacement → Presentation Polish) can proceed: the existing Foglight project may be used only as a mechanics reference (beacon-lighting loop, Guardian encounter, gate/sanctuary progression), not as a visual starting point. A new, clean flagship project should be built from the asset kit once it exists, targeting 5–8 paced minutes, with real screenshots captured from the standalone Playable build before any human review of the visual direction.

Until then, per the recovery report: **PUBLIC SHOWCASE COUNT: 0.**
