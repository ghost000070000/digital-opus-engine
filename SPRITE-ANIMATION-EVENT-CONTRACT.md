# Sprite Animation Event Contract

Phase 024 advances `sprite-animation` assets to version 3. Every frame owns an ordered `events` array of `{ id, name }` records. Versions 1 and 2 migrate by adding empty arrays.

- IDs are stable and unique within a Clip. Names are creator-facing and collision-safe within a Clip.
- A frame may contain multiple events; array order is dispatch order.
- Reordering or editing a frame carries its events unchanged.
- Duplicating a frame copies names but creates new IDs and collision-safe names.
- Duplicating a whole Clip creates a new Clip ID and preserves its clip-local event IDs.
- Events contain no action, payload, signal, condition, or transition data.

The Animation Editor exposes events only for the selected frame, including add, rename, remove, strip badges, name tooltips, and last-preview-event feedback. Preview and scrub never execute gameplay reactions.

