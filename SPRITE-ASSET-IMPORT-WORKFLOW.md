# Sprite Asset Import Workflow

## Primary workflow

1. Open **Assets**.
2. Use **Import Texture (image)**, or choose **Import as Sprite (image)** for the composed convenience path.
3. On a Texture card choose **Create Sprite**.
4. The editor creates and opens a Sprite Asset with a stable ID, the Texture reference, centered pivot, and PPU `100`.
5. Edit Name, Source Texture, Pivot X/Y, or Pixels Per Unit in the Sprite Asset Inspector. Source dimensions and natural world size are read-only.
6. Choose **Place**. A new Sprite instance receives the asset reference, asset pivot, and current natural size.
7. Existing instances retain their own Width/Height. Use **Use Asset Pivot** or **Apply Natural Size** explicitly when desired.

`Import as Sprite` calls the same image file reader and Texture decode path, then creates the Sprite metadata record. It does not contain a second importer.

## Phase 011 conversion

A Sprite with only **Legacy Texture (compatibility)** shows **Convert Legacy Texture to Sprite Asset**. Conversion creates one Sprite Asset for that Texture, assigns its stable ID, and preserves the instance's current appearance and dimensions. There is no automatic mass migration.

## Reuse, search, and repair

- The existing Assets panel offers registry-derived Mesh, Texture, Sprite, and Audio filtering.
- Sprite cards use existing name/tag/folder search metadata.
- Inspect, Place, Duplicate, and Delete are available on Sprite cards.
- Preview uses the local source Texture. A missing source has an explicit placeholder.
- Clearing or losing a source leaves the Sprite Asset present. Choose a replacement in **Source Texture**, then rerun Project Validation.

## Current Undo boundary

Sprite Renderer assignment and instance operations participate in the existing scene snapshot Undo/Redo. The Asset Library has no global asset-history system, so create, rename, metadata edit, duplicate, and delete follow the same non-Undo boundary as existing Texture/Audio asset operations. Phase 012 does not invent an isolated Sprite-only history stack.
