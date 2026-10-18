# Universal Transparent Interleaving Future Seam

Phase 029 intentionally offers only two transparent bands around one contiguous Sprite pass. A future universal system would need a unified sortable render-item model, explicit depth keys for every transparent primitive, policies for intersecting geometry, and likely weighted blended OIT or per-pixel linked lists. It would also need to define how nine-slice cells and Sprite batches preserve atomicity.

That work is not silently approximated here. The current enum and classifier are a clean seam: a future migration can map `behind-sprites` and `in-front-of-sprites` onto broader render queues without changing existing authored meaning.
