# Sprite Animation Editor Contract

## One authoritative surface

Detailed `sprite-animation` editing lives in the dedicated full-screen Sprite Animation Editor. Asset cards expose **Edit Animation** and the compact Asset Inspector exposes identity, summary, and **Open Animation Editor**. Creating a clip selects it and opens the same editor; no second frame editor exists.

The editor displays a horizontal, scrollable strip in canonical array order. Every card retains its slot and shows one-based frame number, atlas-aware Sprite Asset thumbnail, and millisecond duration. Missing references remain visible as broken cards. Selection and current-preview position are distinct transient states: selection has a green border; playback has an orange bar.

## Editing behavior

- **+ Add Frame** creates a repairable slot at the 100 ms Phase 021 default; clicking or dragging a Sprite Asset from the embedded tray creates a stable-ID frame reference.
- The selected-frame panel uses a typed Sprite Asset picker and millisecond duration input. No raw IDs are shown.
- **Duplicate Frame** copies the reference and duration into a new object. **Remove Frame** removes only that frame.
- Native card drag/drop rewrites the frame array once; **Move Left / Move Right** are the accessible fallback. Array position is the only ordering source.
- Frame count and total milliseconds/seconds are derived and never serialized. Cards stay equal width so unusually long holds cannot make the strip unusable.

Asset metadata remains on the established documented non-Undo boundary. Phase 022 does not create a competing asset-history system. Any structural or duration change safely stops and resets the isolated preview to frame 1.

The editor supports one clip only. States, transitions, animation events, directional sets, flipping, and timeline zoom are explicitly outside this contract.
