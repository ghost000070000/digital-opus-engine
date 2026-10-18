# Phase 048 moving-platform carry seam

Phase 047 supplies a deterministic `groundSupportId`, `groundNormal`, `slopeAngle`, and the Character's actual world-XY displacement. The support ID may name a scene Static object or a Tile cell. Flat and slope one-way surfaces can also provide support after a valid descent. This is enough to identify what carried the Character at the end of a tick, but not enough to carry it safely yet.

Phase 048 must define previous/current support Transform sampling, platform displacement and rotation transfer, support-switch timing, one-way/slope eligibility during carry, ceiling obstruction while carried, and lifecycle cleanup when a support disappears. It must distinguish the Character's requested motion, actual self-motion, and externally imposed support motion. It must not infer carry merely from `grounded` or a matching contact normal. Phase 047 does not move Characters with platforms, does not promote Dynamic Bodies, and does not add a controller.
