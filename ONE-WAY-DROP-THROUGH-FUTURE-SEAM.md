# Future one-way drop-through seam

Phase 046 has no input, jump, or drop-through state. A later controller/input phase may request a bounded temporary ignore of one-way support for a particular Character and platform, with clear expiry and re-landing rules. That should be an explicit controller-to-Character request, not a hidden Tile flag or mutation of the platform's authored collision. No `dropThrough`, `ignoreOneWayUntil`, or Down+Jump behavior is implemented here.
