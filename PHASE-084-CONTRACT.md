# Phase 084 — HUD data bindings UI

IN PROGRESS. Make existing canonical HUD state discoverable through a named source picker, not a new gameplay store or timer loop. Explicit version1 bindings on Text/Counter/Timer/Objective elements observe authored Counters, Timers, validated primitive Game variables, Player Health/Maximum Health and Active Objective Title. Legacy token/name rendering remains unchanged when no binding is authored.

Game variables already use name-shared Game storage with graph-local definition IDs. A typed shared-name binding is valid only when all discovered declarations agree on type and canonical starting value; canonical Graph Variables.read supplies the value. Local invocation/Object variables and object/color values are outside this text presentation scope. Conflicting, missing, malformed or future bindings remain authored and visibly unavailable, never guessed into another source.

New mode preserves false,0 and empty text, offers a separate display template with {value}, and uses bounded authoring/session discovery rather than serializing the whole project every frame. Preview reads typed starting values without initializing gameplay. Source selection/template mutations own history and Save/reopen; native Actions drive values in Source/Editable/Playable. Player Save timer progress is not expanded by this phase. Static discovery cannot infer Custom Script/dynamic names, so legacy free-typed paths remain available.

Qualify native no-code selection, canonical Action writes, pause-safe Timer, missing/conflict recovery, independent history, persistence/export, legacy compatibility and permanent regressions before transition085.
