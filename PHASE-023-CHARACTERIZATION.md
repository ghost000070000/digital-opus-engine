# Phase 023 Characterization

Phase 023 replaces Sprite Renderer's single animation-clip slot with a bounded, renderer-local named-state collection and explicit no-code switching.

## Before

A Sprite instance could reference one clip and optionally play it at start. Changing between Idle, Walk, and Attack required a custom convention or code. The one clip field was persisted and validated, but there was no stable local semantic identity for gameplay Actions.

## After

A Sprite Renderer owns stable local state IDs mapped to shared Sprite Animation Clips, a typed initial-state selection, and Play On Start. The Inspector supports add, rename, clip assignment/clear, remove, and dependency warning. One shared Action switches states from Behavior, Node Graph, or Sequence with explicit same-state restart semantics. Runtime state is transient, deterministic, and per instance. Dependency collection retains every referenced clip, including noninitial states, while unrelated clips remain prunable.

## Preserved behavior

Static Sprite fallback, frame timing, Once final-frame hold, Loop modulo behavior, atlas regions, filtering, geometry, material, sorting, Transform, Prefabs, save/load, and both export tiers remain intact. Sprite Renderer v5 records migrate deterministically and canonical saves no longer emit `animationClipRef`.

## Honest boundary

This is explicit state selection, not an animation controller graph. No conditions, transitions, blends, parameters, events, directions, or automatic locomotion switching were introduced. Animation remains C; Sprites / 2D remains B. AFR-0009 and AFR-0010 remain open because generic/skinned semantic clip control and Sequence timeline authoring are broader than this Sprite-local state layer.
