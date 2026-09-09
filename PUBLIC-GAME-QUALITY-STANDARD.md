# Public Game Quality Standard

This is a pre-release review standard for the existing 28 Digital Opus Engine games. A successful build is required evidence of technical operation, not a visual-quality verdict. All projects remain available internally; public promotion requires inspection of the actual standalone build. No deployment is authorized by this document.

## Roles

| Role | Purpose | Minimum reviewed scores | Screenshot evidence |
|---|---|---|---|
| Featured | A coherent, playable showcase with a distinct identity | Visual 4/5; gameplay clarity 4/5; presentation 4/5; audio 3/5 | Three different standalone frames: opening, gameplay, highlight |
| Sample | A focused, useful demonstration of one capability | Visual 3/5; gameplay clarity 3/5; presentation 3/5 | At least one representative standalone gameplay frame |
| Internal | A useful regression project that still needs visual or gameplay work | Honest scores; no public threshold | Audit screenshots may document its remaining gaps |

Sample audio must provide meaningful interaction feedback where the mechanic benefits from sound. Featured games require ambient and interaction identity. The score alone never permits a visible fixture, broken interaction or misleading presentation.

## Review checklist

- Identity: catalog, project metadata, enabled Start Screens and HTML title agree. Description, objective and controls belong to this game. No inherited Crate Run instructions or engineering/test jargon.
- Visuals: deliberate palette and composition, readable landmarks, appropriate player/enemy models, and no accidental collision blocks or random primitive clutter. Geometric samples may use simple geometry intentionally.
- Helpers: spawn points, triggers, waypoints, path-point members, cameras, spawners, lights and hidden managers stay invisible during Play and level transitions. Hidden mechanics retain their triggers and state.
- Gameplay: clear start and goal; progression and interactions work; Win and Lose are legible where appropriate. A short mechanics sample is not presented as a long adventure.
- UI: authored Start Screen and How To Play, useful HUD, readable pause and end screens. Standalone endings offer Restart and never send the player to an absent editor.
- Camera: inspect the opening frame and normal traversal. First-person collision bodies stay invisible, weapon models sit intentionally below the sightline, and carried items do not cover the center. Check clipping and body scale with actual movement.
- Audio: listen after a real Start gesture; verify ambience, interactions, movement and combat as applicable. Distinct actions should have distinct feedback.
- Export: standalone has no editor chrome, missing scripts/assets or unexpected external dependency. Inspect one representative session of about 20–60 seconds for every game, then verify required progression for any public classification.
- Licensing: every public asset must appear in `SHOWCASE-ASSET-LICENSES.md`, with known provenance, license and required attribution. Unknown-license art cannot ship.

## Catalog schema

`games/catalog.json` remains the source of truth. Public entries carry:

```json
{
  "id": "example-id",
  "title": "Example Title",
  "file": "example-id.json",
  "purpose": "A focused description of the capability or experience",
  "visibility": "public",
  "qualityTier": "sample",
  "featured": false,
  "playable": true,
  "description": "A player-facing description of the game.",
  "genre": "Puzzle",
  "controller": "First-Person",
  "playtime": "3–5 minutes",
  "estimatedMinutes": 4,
  "screenshot": "public-showcase-review/example-id/gameplay.png",
  "screenshots": {
    "gameplay": "public-showcase-review/example-id/gameplay.png"
  },
  "qualityReview": {
    "visual": 3,
    "gameplayClarity": 4,
    "presentation": 3,
    "audio": 3,
    "standaloneVerified": true,
    "licenseVerified": true,
    "noPlaceholders": true,
    "reviewedAt": "2026-09-07",
    "notes": "Describe the actual review, remaining limitations and sample scope."
  }
}
```

Featured adds `screenshots.opening` and `screenshots.highlight` with matching filenames under the same game directory, sets `qualityTier` to `featured`, and sets `featured` to `true`. Internal entries use `visibility: internal`, `qualityTier: internal`, and `featured: false`. Legacy `category` does not determine public placement.

Scores and the verification flags are review assertions supplied only after actual play. They are not generated from object counts, test totals or image statistics. Updating visuals after review requires checking the affected captures and reassessing the assertions.

## Enforced build gates

`build/public-game-quality.js` is shared by the standalone catalog build and the public site generator. Public entries fail qualification for missing metadata, scores below the tier, missing play verification, title mismatch, missing Start Screen/How To Play, engineering copy, known diagnostic mesh identifiers, or suspicious skinned meshes below 24 vertices. Licensing also requires `qualityReview.licenseVerified: true`; every embedded mesh/texture/audio must match the original kit native data exactly or carry explicit `provenance` source, license and a real repository documentation file. Prefixing an altered asset ID with `showcase-` cannot bypass this check. The fixture heuristic is deliberately narrow and does not replace visual inspection.

Screenshot paths must point to real PNG files under `public-showcase-review/<id>/`, use the prescribed role filenames, have at least 640×360 pixels, contain readable PNG image data, and stay inside the review directory. Featured files must differ; repeated copies of one frame do not satisfy the trio. These checks prove file integrity and presence; the reviewer must still establish that they show actual standalone gameplay without editor chrome. Generated title cards never satisfy screenshot evidence.

`build/build-engine-site.js` selects only `visibility: public`. Its Featured and Samples sections follow `qualityTier`, copy the actual PNGs into the package, and publish purpose, visibility, tier, screenshot paths, description, genre, controller, playtime and featured status. Any public game build failure exits nonzero, including a Sample failure. The internal `dist/games/` launcher preserves all 28 games and identifies itself as an internal review surface.

## Shared authoring fixes in this pass

- First-person visual cleanup keeps the collision body hidden and preserves equipment visuals. Equipment `firstPersonOffset` uses camera-right/up/forward coordinates; optional `firstPersonRotation` uses radians. A weapon model's forward axis is +Z. Set its existing `scale` to match its authored dimensions.
- Static mesh UVs and `asset.textureAssetId` survive loading, saving and export. Mesh-owned palettes apply to placed objects, player visuals and equipment, and are included in dependency collection.
- `playerSettings.initialYaw` and `initialPitch` store radians. The Player Settings panel edits them in degrees. First-person gets its camera immediately at spawn; third-person gets the corresponding body heading and opening chase pitch.
- Path-point membership and explicit `isPathPoint` flags hide authoring markers in Play. New saves retain path-point ownership.
- `ui.winAudioAssetId` and `ui.loseAudioAssetId` allow authored ending feedback. Footstep, weapon fire/impact and end-screen sounds survive Save/Export dependency collection.

## Validation commands

```text
node build/build.js
node tests/run-tests.js
node build/build-games.js
node build/build-engine-site.js
```

`tests/showcase-quality.test.js` runs with the standard suite and exercises first-person visibility, equipment preservation, marker hiding, mesh UV/palette round-trip, blank controls, standalone restart presentation, and rejection/acceptance at public gates. Real browser play and screenshot review remain separate required evidence. This pass ends with human screenshot review, not upload, DNS changes, a release claim, game #29 or Wave 10.

## Additional verified rehabilitation repairs

- First-person ranged shots now use the camera ray. The held model and muzzle flash remain below the sightline; third-person sockets remain supported.
- Tagged combat targets use an authored sphere collider's offset and radius for hitscan, melee and projectiles. Invisible helpers cannot intercept shots. Legacy unconfigured targets keep their existing proxy.
- A carried object no longer steals interaction focus from the generator or socket receiving it.
- End screens release pointer lock, and a delayed lock request cannot capture the pointer behind a paused or ended game. Real browser regression covers both ending types and ordinary Restart clicks; its synthetic endings are explicitly not gameplay-completion evidence.
- The authored player visual is synchronized before the Start Screen pauses updates, removing the primitive body from menu backgrounds.
- Optional per-level playerSettings.playBounds: {minX, maxX, minZ, maxZ} keeps compact examples inside their authored world. All controllers share the same adapter; radius is respected, vertical motion is preserved, and unconfigured projects retain the original radial boundary.
- Menu/HUD presentation now has readable titles and descriptions, the actual scene behind a left-side menu card, larger objective/interaction text, numeric health and a correctly layered ending overlay.

The standard Node suite now includes 12 targeted shared-quality regressions, alongside the existing public API tests. Running tests/standalone-modal.test.js is a separate local-browser UI fixture and writes only internal test evidence. Running tools/inventory-rehabilitation.js refreshes mechanical before/after statistics and exact asset provenance; it never assigns a visual score.

