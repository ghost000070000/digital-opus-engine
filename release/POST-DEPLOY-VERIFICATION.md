# Post-Deploy Verification Checklist — Digital Opus Engine

Run through this after uploading, once `https://engine.digitalopusadsolutions.com/` is live. Every item should pass with no fatal console errors.

## Core pages

- [ ] **Engine Home** (`https://engine.digitalopusadsolutions.com/`) — loads, hero section visible, "Open the Editor" / "Play Example Games" buttons present, Featured cards render.
- [ ] **Editor** (`https://engine.digitalopusadsolutions.com/editor/`) — loads, default Crate Run starter game visible and playable, no fatal console errors.
- [ ] **Deep Link** (`https://engine.digitalopusadsolutions.com/editor/?game=foglight`) — loads the editor and opens Foglight (status shows "Loaded Foglight"; note the browser tab title itself does not update on project load — that's expected, not a bug).
- [ ] **Examples Hub** (`https://engine.digitalopusadsolutions.com/games/`) — loads, all 28 example cards render.
- [ ] **Direct Game** (`https://engine.digitalopusadsolutions.com/games/foglight.html`) — loads and plays Foglight directly, no fatal console errors.

## Each of the 7 Featured examples (from the Engine Home page or the Examples Hub)

- [ ] **Foglight** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Signal Relay** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Arsenal Run** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Silent Sector** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Power Grid** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Relic Frontier** — loads, correct title, Start Screen/Play works, no fatal console errors.
- [ ] **Relic Island** — loads, correct title, Start Screen/Play works, no fatal console errors.

## MANDATORY — existing Digital Opus Games preservation check

- [ ] Open `https://games.digitalopusadsolutions.com/` and confirm the existing 43-game portfolio is **still present and unchanged**.

**If it changed unexpectedly in any way: STOP. Do not continue modifying anything. Investigate immediately** — this would mean something touched the wrong site, and must be root-caused before any further action on either site.

## HTTPS

- [ ] `https://engine.digitalopusadsolutions.com/` serves over valid HTTPS (no certificate warning).
