# Digital Opus game art direction system

The existing twenty-eight games retain their mechanics and individual purpose. Four visual families give them a reusable material vocabulary without turning every scene into the same level. The target is readable silhouettes, deliberate routes, useful landmarks and clear feedback at the actual gameplay camera distance. Public eligibility is decided from standalone play and screenshots, not the amount of geometry installed.

## Fantasy and adventure

**Material and palette:** cool slate and grey-green stone; muted teal foliage; bark and bronze; warm gold for relics, beacons and safe destinations. Pale cyan is reserved for arcane threats or special machinery. Use broad foliage masses with faceted shade changes, and preserve warm/cool separation against fog.

**Models:** ranger, guardian, three tree species, five rock profiles, bushes and grass, stone ruins, arch, pillar, barred gate, lantern beacon, shrine, relic and bridge. The ranger is a recognizable booted humanoid with a backpack, face visor, articulated limbs and gait. The guardian is a four-legged horned creature with a jaw, eyes, paws, tail and crystal crest. Neither derives from the skeletal bend fixture.

**Composition:** cluster vegetation and rocks at route edges; keep the path, interactables and camera's first view open. A beacon is a tall warm destination, not another unlabelled colored cube. Place arches and pillars to frame gates and transitions, not across required collision paths. Vary tree groups and ruin layouts across games; scale the dressing to each level's travel distance.

**Individual direction:** Foglight uses fog, repeated beacon silhouettes, cool woodland and a sanctuary focal point. Relic Frontier uses more exposed ruins and combat sightlines. Relic Island uses lower foliage and readable warm relics. Forest Range emphasizes tree species and terrain texture transitions. Valley Run uses a visible route with sparse landmark clusters. Temple/dungeon games use masonry rhythm, constrained palettes and clear room exits.

**Sound:** subdued fantasy wind/harmonic bed; distinct pickup, beacon ignition, gate movement, contact and guardian attack. Ambience stays below actionable effects.

## Science fiction and facilities

**Material and palette:** graphite framework, blue-grey metal, pale structural ribs, limited cyan screens, gold hazard inserts, red security lenses/alerts. Most surfaces remain quiet; reserve high-contrast light for interactable equipment and exit routes.

**Models:** wall/floor panel, split door, terminal with screen and keyboard, paired-coil relay, cylindrical generator, bent pipes, reinforced crate, caged light, warning insert and rotor drone. A drone reads through its body, rotors, eye and antenna even at small size. A console reads as equipment through a screen and control surface, not its name alone.

**Composition:** break broad walls with panel rhythm and utility bays; cluster machinery in an intelligible work area. Use crates to support cover and route readability without blocking required interactions. Preserve deliberate combat sightlines and safe spawn space. Light the object the player must operate. A power cell, terminal, generator and extraction marker should have different silhouettes.

**Individual direction:** Signal Relay uses cool relay bays and red patrol threats. Silent Sector uses strong cover edges and local security contrast. Power Grid puts the generator and its supporting consoles at the center of the puzzle. Blacksite uses compact dark service passages. Signal Zero uses consistent extraction/arrival landmarks across its levels. Assembly Line uses repeated industrial stations; Shifting Facility keeps moving collider geometry readable through distinct ribbing and accents.

**Sound:** restrained machinery hum; motor doors; relay acknowledgements; pickup and alert cues. Avoid ambient volume that masks enemy or interaction feedback.

## Arena and action

**Material and palette:** dark floor and steel cover with light silhouette edges. Enemy lenses/threat cues use red; pickups, fire and extraction use limited amber/cyan. Maintain distinction between moving threats and static cover.

**Models:** rifle with stock/receiver/grip/magazine/barrel/sight, humanoid opponents, drones, twin-barrel tripod turret, bolts and impact geometry. These support the existing weapon/equipment and damage systems; they do not introduce a new combat model.

**Composition:** create a readable fighting space with cover intervals, clear lanes and an obvious exit. Keep first-person equipment near the lower screen edge. The weapon points along engine forward **+Z**. The player's physics shape must be hidden by the reusable first-person runtime path; art should not conceal a collision/camera defect.

**Individual direction:** Arsenal Run prioritizes sightlines, cover, equipment switching and enemy readability. Iron Arena remains the skeletal combat sample. Opus Arena prioritizes legible aerial/arena spacing. Survival samples use progressively denser threat arrangements while retaining their compact scope.

**Sound:** short weapon reports, distinct damage/impact, enemy alerts, clear win/lose stingers and a quiet arena bed. Avoid using a pickup chime for every event.

## Abstract, mechanics and traversal

**Material and palette:** intentional geometric structures may remain geometric. Use a small family of colors and repeated structural language; flat cubes are acceptable as designed platforms or collision demonstrations when their scale and placement communicate the mechanic. They are unsuitable substitutes for a character, enemy or named piece of equipment.

**Composition:** frame the one capability being taught. Moving Temple emphasizes moving platforms and an attainable next landing; Skyway Trial emphasizes the route and fall risk; Sentinel Maze uses consistent wall heights, a visible sentinel and exit; Painted Wilds emphasizes painted terrain transitions. Remove decorative clutter that obscures moving collider or terrain behavior.

**Sound:** interaction, pickup and completion feedback when those events exist. Continuous ambience is optional for small mechanics samples.

## Asset contract

`tools/showcase-assets.js` exports:

```js
const kit = require('./tools/showcase-assets');
kit.install(project, {
  meshes: ['ranger', 'tree-oak', 'beacon'],
  textures: ['ground-moss', 'stone'],
  audio: ['ambient-fantasy', 'beacon', 'pickup'],
});
const mesh = kit.getMesh('beacon');
// record.mesh = 'asset'; record.assetId = mesh.id;
// record.textureAssetId = mesh.textureAssetId; record.color = [1, 1, 1];
```

Lookups return independent copies. Stable IDs use `showcase-` followed by the key. `install` is idempotent and automatically installs the palette with any mesh selection. It preserves unrelated existing assets. `meshKeys`, `textureKeys`, `audioKeys` list valid keys. `generate()` reproduces the on-disk kit.

The complete machine-readable inventory is `assets/showcase/manifest.json`. Every mesh carries `bounds.min` and `bounds.max` arrays. Coordinates are metres, **Y up, +Z forward**. Most props have their base at Y=0; drone, rifle and projectile use centered origins. Refer to bounds when fitting a model to an existing object. Entity scale is a model multiplier, not the original object's collision dimensions: preserve or separately author a collider when changing visible geometry.

The ranger stands approximately 1.855 m tall, feet at Y=0. Its clips are Idle 0, Walk 1, Run 2, Jump 3, Fall 4, Attack 5 and Death 6. Its named RightHand socket uses the right forearm. The guardian stands approximately 2.465 m at the horns; clips are Idle 0, Walk 1, Run 2, Attack 3 and Death 4. Player visuals use the existing skinned-body authoring path with the appropriate feet offset. Static objects use the same native imported-mesh path as other project assets.

The renderer's regular mesh path does not use terrain vertex colors. Models therefore use **flat face UVs into an original palette PNG**, making wood, foliage, armor, stone and signal details survive the standard importer/exporter. Always preserve UVs and `textureAssetId`, and set model tint to white unless a deliberate tint is intended. Additional ground and structure textures use the existing texture/tile controls; avoid assigning a stone texture over a palette-mapped character.

## Review and budget

The kit contains 36 meshes, six textures and sixteen sounds. Its total geometry is 10,760 triangles; the largest model is the guardian at 1,388 triangles. Sound files total approximately 1.50 MB before project embedding; games install the subset they use. Terrain, layout and light choices should do the compositional work rather than adding hundreds of repeated meshes.

`tools/showcase-asset-preview.html` and `tools/verify-showcase-assets.js --render` produce actual engine asset views for inspecting mesh silhouettes, rig deformation and palette handling. They are not public gameplay screenshot evidence. Public screenshots must come from the game standalone build and satisfy `PUBLIC-GAME-QUALITY-STANDARD.md`.

Review opening camera, route, interaction state and representative combat/traversal in each game. Keep honest internal classifications where the scene still reads as a fixture. Asset installation alone never earns Featured or Sample status.
