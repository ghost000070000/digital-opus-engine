# Inspect 2D physics without changing your game

Enable **2D Debug** beside the viewport tools. Orange outlines are modern XY
Colliders; green dashed outlines are Triggers. This is different from legacy
3D **Show Colliders**. An outline is not a promise that every object blocks it:
Body roles and mutual collision masks still apply.

Choose a named physics object in the panel. In Play, inspect its actual ground,
wall, slope and moving-support state. Compare masks with another named object:
the panel explains whether those two displayed shape policies accept or reject
one another. Acceptance still requires the appropriate geometry and Body role.
For objects with multiple shapes, the comparison explicitly names the first
canonical shape on each object; their other shape policies remain listed.

Hide closes diagnostics during Play. Stop clears live support state and restores
authored transforms. Debug choices are session furniture: they do not enter
Undo history, saved projects, duplicated objects or Prefabs. Reopened and exported
projects start with diagnostics off. Editable exports can enable them; Playables
never expose or enable the overlay.

Query/carry totals are cumulative since the editor opened, not per-contact
explanations. Tile counts come from actual sparse runtime queries; diagnostics
do not scan painted cells. Work is capped at128 shapes and1024 objects per refresh,
at most10 refreshes/second. The selected scene object is considered first; the
panel explicitly reports when coverage is truncated. This is a bounded inspection
tool, not a general physics profiler, Dynamic Body system or legacy3D solver.
