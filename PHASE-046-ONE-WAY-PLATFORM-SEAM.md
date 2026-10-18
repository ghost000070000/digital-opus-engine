# Phase 046 one-way platform seam

Phase 045 treats all collision-bearing Tile quads as solid from every direction. A future one-way extension can filter candidate obstacles before Phase 043's per-axis solver based on the platform's top plane, Character prior/final position, and downward requested motion. Drop-through would need a separate future control request. Neither a one-way field nor directional filtering is implemented here.
