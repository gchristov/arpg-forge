# arpg-forge

One shared engine for small isometric action RPGs (Diablo-style: tap or click to move, real-time combat, a hub plus dungeons, loot, levels, bosses), plus a folder per game. Each game is a cheap pilot for Steam; the one that catches on gets more work. `PLAN.md` is the source of truth for the architecture and the order of work.

## Current state

The refactor hasn't started. The whole game is still `index.html`, the original one-file prototype of Ashen Hollow (dense one-liners, globals `G` and `P`, `Math.random()` throughout). Next is step 0 of `PLAN.md`: move it to `prototypes/ashen-hollow.html` and set up TypeScript, Vite and Vitest. Update this section as the steps land.

## Rules

- **Engine versus game.** `engine/` owns how the game plays. `games/<name>/` owns what it is: setting, story, levels, enemies, items, art, sound, HUD skin. The engine contains no game-specific names, text, colours or coordinates.
- **Share by default, extend when needed.** Express a new game's needs as data through engine registries first. A mechanic only one game needs goes in that game's `extensions/` folder, plugged in through extension points (registries, systems, event hooks, named overrides), and is listed in that game's `EXTENSIONS.md`. It moves into `engine/` only when a second game wants it. If an extension needs engine internals, add an extension point rather than moving the mechanic into the engine.
- **Neutral engine words.** Use "melee skill", "resource", "healing item" and "vendor" in the engine; games give them their names.
- **Rules separate from presentation.** Game rules run in `step(state, input, dt)` at a fixed rate with a seeded random generator, and emit events. Rendering, audio and HUD only listen; they never change the state.
- **Refactors keep behaviour.** When restructuring, the game must play exactly as before. Say so explicitly if behaviour changes.
- **Pilots stay small:** about 30–60 minutes of play. Don't build depth into a game until it shows traction.

## Working with the user

The user is a first-time game developer and a working parent, and acts as the "execution point" when they have time, often in the evening and sometimes not for days. Claude leads: give a recommendation, not a menu. Batch what needs the user into small, clearly scoped steps, and build lead time into anything with external waiting (Steam account checks, store page timing).

Tasks and status live in the Notion project "ARPG Forge" (Work → Projects). Keep Notion lean: the user reads it.
