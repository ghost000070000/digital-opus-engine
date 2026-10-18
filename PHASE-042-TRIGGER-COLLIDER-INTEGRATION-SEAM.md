# Phase 042 Trigger Integration Seam

Trigger semantics may consume Phase 041 world shapes and overlap results, but must own pair lifecycle, enter/stay/exit state, filtering, dispatch order, deletion/disable behavior, and event authoring separately. Shape Components must stay usable without Trigger. Adding a trigger must not imply physical response.

