# Filter ownership

The filter belongs to each geometry: ordinary Box, ordinary Circle, independent Trigger, or Tilemap Layer. A mixed Box/Circle object can accept a target through one shape while its other shape rejects it. Trigger geometry does not inherit the object's ordinary Box filter. Each Tile Layer can reject a Character independently of sibling layers.

Body 2D, Character Collision 2D, One-Way Platform 2D, and Moving Platform 2D keep their existing responsibilities. None adds competing Layer or Mask fields. Scene rendering/sprite sorting, gameplay tags, Tilemap visibility/lock, and Chunk stamping metadata do not substitute for collision policy. Tile `collisionEnabled` remains an additional gate; disabled layers never provide collision even when masks accept.

Box/Circle/Trigger v1 → v2 and Tilemap v1–v5 → v6 introduce Default / All explicitly. Historical behavior remains unchanged. Current v2/v6 malformed policy is preserved for validation and repair rather than migrated as if historical.
