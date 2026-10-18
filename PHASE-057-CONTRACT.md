# Phase057 — Reusable graph functions/macros

COMPLETED, 2026-10-09. Exact authoritative roadmap title; tracker has no expanded prompt.
Bounded contract derived from that title and editor-first master, not replacement
phase numbering. Named project-local graph definitions can be called from multiple
Object graphs through a creator-facing picker and edited once. Calls use existing
Actions/Conditions/typed values/variables, not a parallel scripting runtime.

Function Object scope means the calling Object; Game remains session state; Local
belongs to each call. A function Delay suspends its caller flow until completion,
preserving both scopes. Bounded call depth and work budget prevent recursion from
hanging gameplay. Missing definitions remain inspectable with diagnostics.

Project Save/Load/history/duplication/Prefab references/Editable/Playable preserve
definitions and dependencies. Reuse does not mean silently copying a separate
definition per node. Native publish/edit/call workflows, two callers, nested Delay,
recursion/missing-reference recovery and exports require real evidence before
qualification. Typed arguments/returns may remain an explicit bounded limitation;
initial Local values and existing Object/Game state provide current configuration.
Graph templates/presets058 and tracing059 remain separate future gates.
