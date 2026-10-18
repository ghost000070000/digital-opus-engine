# Phase 047 slopes and steps seam

Phase 045's Character probes classify contacts only on world X/Y axes, and Tile collision remains rectangle/quads. A future slope/step pass would need authored slope geometry, surface-normal classification, step-height policy, and grounded continuity across adjacent cells. It should extend the shared Character movement service rather than create another mover. No slope, step-up, or ground snap exists in Phase 045.

Phase 046 deliberately accepts one-way support only from transformed local-horizontal Box edges whose rise/run is at most 0.01. A rotated edge beyond that tolerance falls back to solid rather than masquerading as slope support. Phase 047 may add normal-aware support and step traversal, but must define the authored geometry, support continuity, and interaction with one-way crossing explicitly.
