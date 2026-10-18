# Phase 030 Characterization

## Existing seam reused

The first-run overlay already owned Start Blank, Guided First Game, Examples, normal project loading, local Save/Load, and the project export controls. Phase 030 adds one `Sprite Starters` group to that screen. Selection calls `createSpriteStarterProject`, which obtains a fresh record from `OpusSpriteStarters` and delegates to the existing `loadProjectFull` path. No parallel project manager, serializer, storage namespace, or exporter was introduced.

## Product feature

The product feature is a bounded three-entry Sprite starter catalog. Definitions are deterministic local creator functions because the current project format is already the correct package. The API returns deep clones and fresh project names. Stable starter IDs are discovery identifiers only; they are absent from instantiated runtime data.

## Qualification artifact

The internal dogfood was substantially authored through visible editor controls from Animated Character. The path covered project rename; Far/Mid parallax; foreground Nine-Slice; Background/World/Foreground sorting; an opaque Cube saved as a Prefab and instantiated multiple times; a transparent Billboard; Sprite animation event listener; Walk/direction/Attack control behaviors; validation break/repair; Save/reload; Play; and all three export buttons.

The deliberate break cleared the Walk state's base Clip. Validation surfaced both the required-reference failure and the dependent event-listener mismatch. Selecting the issue, restoring Walk, and validating returned the project to `No structured authoring issues found.`

## Creator-journey audit and genuine friction

The common path required no code, JSON, raw IDs, developer console, or hidden fixture import. Starter choices were prominent and keyboard-focusable. Sprite Asset → Clip → State was understandable once in Assets/Inspector. Directional variants and Animation Event source pickers were discoverable but remain dense in the long Inspector. Camera/parallax concepts were adequately explained in Project and Inspector help. Hybrid layering was explicit.

Genuine friction observed:

- long Inspector action menus make State/Direction/Event wiring slower than the underlying model warrants;
- individual-Sprite level construction exposes the need for the next Tilemap workflow;
- state-based interaction lacks a dedicated 2D controller/input common path;
- pixel sampling is not a pixel-perfect Camera workflow;
- world-space test controls are serviceable but not a UI Canvas.

These are recorded boundaries, not repaired by pulling later systems into Phase 030. AFR-0001 remains CONFIRMED with a narrower description.

## Not implemented

No Tile Palette, tileset, grid, paint/erase tool, Tilemap renderer/cells, 2D collider/physics body, dedicated 2D controller, new input-map system, UI Canvas, generalized template platform, public game, deployment, or Phase 031 implementation was added.

