# Moving-platform safe-carry contract

Rider safety sweeps the Character's ordinary Collider 2D shapes along the platform's Static-limited base vector against non-support Static bodies and sparse Tilemap candidates. The support platform itself and other moving platforms are excluded. The existing bounded conservative separation sweep supplies a fraction in `[0,1]`; ambiguous or singular-parent cases fail closed.

Wall, ceiling, corner, and Tile obstruction reduce the entire platform vector by one scalar. Carry never independently axis-slides a rider, so all riders retain the same relative support translation. One blocked rider constrains all riders. This prevents ordinary penetration without inventing crush damage, health, impulses, mass, friction, or simultaneous platform constraints.
