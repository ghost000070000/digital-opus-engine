# Sprite Parallax Layer Contract

Phase 027 adds an optional project-level `parallaxLayers` registry. Each entry is `{ id, name, factorX, factorY }`: `id` is stable identity, `name` is a unique creator-facing label, and both factors must be finite numbers. Names may change without changing references. Negative and above-one factors are supported.

A Sprite Renderer stores only `parallaxLayerRef`, a nullable typed reference to a layer ID. `null` means normal world behavior with effective factors `1,1`; historical Sprites migrate to `null`. A missing ID remains stored, produces a Project Validation error, and resolves at runtime to safe `1,1` behavior.

Sorting Layers and Parallax Layers are independent. Sorting controls draw order; parallax controls response to camera translation. No layer is created implicitly, and no instance-level factor override exists.

Deletion of a referenced layer requires confirmation, identifies the affected Sprite count, preserves the stable references for repair, and never silently remaps by name. The manager supports add, rename, factor editing, duplicate, and delete. New layers default to `0.5,0.5`.

