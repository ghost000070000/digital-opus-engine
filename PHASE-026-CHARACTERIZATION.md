# Phase 026 Characterization

Before Phase 026, every true Sprite used one stretched quad. Width/Height changes therefore stretched corners and decorative borders, forcing creators toward pre-sized artwork or manual multi-Sprite construction.

Phase 018 already owns top-left atlas coordinates and safe UV conversion; Phase 015 already owns outer geometry and direct resizing; Phase 025 already resolves final Flip after directional mirroring. Phase 026 extends those seams: source-pixel guides live on Sprite Asset, Render Mode lives on Sprite Renderer, and one centralized resolver produces cell geometry and UVs for editor Play and both export tiers.

The phase deliberately excludes tiled centers/edges, automatic guide detection, per-instance guides, UI Canvas, text/layout, colliders, parallax, orthographic cameras, Tilemaps, and Phase 027 work.
