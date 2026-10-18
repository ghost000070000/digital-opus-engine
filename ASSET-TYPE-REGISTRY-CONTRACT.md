# Digital Opus Asset-Type Registry Contract

## Registry entry

The authoring-only `AssetTypeRegistry` declares stable type ID, display name, category, accepted normalized MIME types/extensions, optional source type, metadata defaults/validation, serializer owner, library presentation metadata, compatibility/import adapters, and a dependency callback.

It supports duplicate registration rejection, `get`, ordered/filterable `listTypes`, MIME/extension file matching, metadata validation, compatibility resolution, and `getDependencies`.

The registry describes asset authoring. Browser image/audio decoding, glTF parsing, GPU handles, and current serializers remain owned by the existing pipelines.

## Current adapters

| Type | Existing identity/payload | Adapter result |
|---|---|---|
| `mesh` | stable asset ID; `type` is `mesh` or legacy-compatible `skinnedMesh` | Both resolve to registered Mesh; existing glTF/mesh import and `project.assets` serialization are unchanged. |
| `texture` | stable texture ID plus encoded image data | Registered Texture validates id/name/source bytes; existing image decode and `project.textures` remain unchanged. |
| `audio` | stable audio ID plus encoded source data | Registered Audio validates id/name/source bytes; existing browser decode and `project.audio` remain unchanged. |

Library rows now use registry display metadata, while existing search, tags, folders, placement, preview, rename, delete, and import controls remain intact. `listTypes()` makes future type filtering possible without a library redesign.

## Future derived Sprite asset

Phase 012 should register `sprite` with `sourceType: 'texture'`. A Sprite asset owns a new stable asset ID/name and Sprite metadata, while `sourceTexture` is a typed Texture asset ID. It does not duplicate source bytes.

- Deleting the Texture leaves the Sprite's `sourceTexture` value intact and produces a dangling required-asset error.
- Export dependency collection calls the registered dependency hook, so a used Sprite pulls its source Texture bytes into the existing export.
- Duplicating a Sprite asset gives the derived asset a new ID while retaining the same source Texture ID until changed.
- The library displays the Sprite's own name/type and may include the source Texture label from the option service.
- Metadata validation uses the project collector; import may adapt an already-imported Texture rather than inventing another image decoder.

The current dependency collector now contains one registry-driven transitive closure after its legacy scans. Current adapters declare no new dependencies and therefore produce identical packages. Phase 012 adds the Sprite collection to that one registered collection map and declares `Sprite → Texture`; it does not add a Sprite-specific packaging scanner.

