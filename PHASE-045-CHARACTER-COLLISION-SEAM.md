# Phase 045 character collision seam

A future no-code Character system can submit desired world displacement to `moveKinematicBody2D` and read actual delta, blocked X/Y, and hit IDs. It should reuse that collision path while owning its own input, grounded/wall state, jump policy, and presentation. Phase 043 provides only generic geometric axis sliding.
