# Sprite versus Billboard Contract

## Decision rule

Use a **Sprite** when the creator authors the plane orientation and needs reusable Sprite Assets, pivot/size semantics, and named Sprite Sorting Layers. Use a **Billboard** when a world-space image must face the camera and behave like ordinary 3D imagery.

These are intentionally separate concepts. Neither is a compatibility alias for the other.

## Sprite

- Object identity: explicit serialized kind sprite.
- Rendering identity: dedicated spriteMesh plus Sprite Renderer component.
- Source: Sprite Asset, with the Phase 011 direct-Texture field retained only as legacy compatibility.
- Transform: position, full authored rotation, and scale remain authoritative.
- Facing: never camera-facing.
- Appearance: source image, Width, Height, Pivot, Tint, and Visible.
- Ordering: project-owned named Sprite Sorting Layer, integer Order in Layer, then stable Object ID.
- Lighting: unlit alpha surface.
- Hierarchy: normal parent/child transform composition; Sprite-to-Sprite and Sprite-to-3D parenting are supported.
- Persistence: ordinary Save/Load, Duplicate, Prefab, Level duplication, Editable export, and Playable export paths.

## Billboard

- Object identity: the established legacy record remains kind cube with mesh billboard and isBillboard true.
- Rendering identity: vertical world-space billboardMesh with no Sprite Renderer component.
- Source: generic Texture Asset directly on the placed object.
- Transform: position and scale are authored. The chosen facing mode owns world orientation each frame.
- Facing modes:
  - Full follows camera yaw and pitch.
  - Cylindrical follows yaw while remaining upright.
- Appearance: generic Texture, Color tint, UV scale/offset, Alpha, Emissive, and Unlit controls.
- Ordering: ordinary opaque or transparent 3D rendering. It has no Sprite Sorting Layer or Order in Layer.
- Lighting: lit by default; generic Unlit is an explicit opt-out.
- Hierarchy: parent position and scale resolve before camera-facing orientation. The camera-facing result is authoritative for the Billboard's world rotation.
- Persistence: established generic Save/Load, Duplicate, Prefab, hierarchy, Editable export, and Playable export paths.

## Creator surfaces

- Objects exposes separate Sprite and Billboard (World-Space) entries and concise hover help.
- Scene names Billboard objects as Billboard rather than Model.
- The Sprite Inspector states that authored orientation and Sprite sorting apply.
- The Billboard Inspector states that camera-facing, generic Material, and ordinary 3D depth apply.
- Help includes the short Sprite or Billboard? decision guide.

## Legacy compatibility

Existing Billboard records are loaded without migration or conversion. The default facing mode remains Full when billboardMode is absent. Existing mesh, Texture, Material, hierarchy, Prefab, Duplicate, Save/Load, and export fields remain intact.

The shipped 28-game corpus has no Billboard records, so Phase 014 freezes the known pre-Phase-014 record shape as a regression fixture and verifies it independently.

## Conversion policy

No automatic Sprite-to-Billboard or Billboard-to-Sprite conversion is provided. A conversion cannot faithfully preserve camera-facing behavior, lighting, Sprite Asset ownership, pivot/size semantics, or sorting-layer behavior without asking the creator to make semantic choices. Manual recreation is the honest bounded workflow.

## Explicit non-goals

This phase does not add orthographic or pixel-perfect cameras, Sprite animation, sprite-sheet slicing, Tilemaps, 2D collision/physics, Y sorting, render queues, universal order-independent transparency, or new public renderer APIs.

