# Phase 083 — Anchors, responsive constraints and safe areas

IN PROGRESS. Exact authoritative title retained. Extend the existing canonical level HUD, shared preview/runtime markup and stable gameplay nodes; do not create a competing screen/logic runtime.

Preserve historical layout by default. Existing nine anchors and fixed dimensions remain unchanged unless an explicit additive policy is authored. Offer level Safe Area (device insets plus creator padding), per-element Keep Inside View, and Image/Panel fixed/percent width with bounded optional limits. Unknown data survives unchanged; invalid editing must not consume history or silently migrate gameplay.

One reusable pure layout resolver computes opted-in boxes against the actual HUD container, not assumptions about whole-window size. The preview uses the same resolver with desktop/tablet/phone view-only presets. Preview size changes are not project mutations; authoring policy changes own independent Undo/Redo and persistence.

Native qualification must prove actual container-relative placement, signed offsets, percentage sizing, overflow constraints, safe creator padding, resize/level changes, hidden authoring elements, stable button input, Save/reopen and Source/Editable/Playable parity. Chromium may expose zero device insets; do not claim physical-notch observation. Positive-inset algebra needs permanent resolver tests alongside actual browser padding evidence.

Phase084 retains richer HUD data-binding UI. No public Game29, dependency, cloud service or automatic historical layout conversion.
