# Plan: making the code maintainable, extensible and testable

The prototype is one long file of dense one-liners where everything can reach everything else. That was quick to write, but every new feature will get more expensive. These are the changes, in the order they should happen.

## 1. Split the file into modules and bundle them back into one page

Write it as TypeScript modules, built with Vite or esbuild into a single HTML file, so it can still be shared as one page:

- `core`: maths, the angled-view projection, a seeded random generator, pathfinding.
- `world`: maps, tiles, collision, line of sight.
- `sim`: characters, combat, enemy behaviour, items.
- `content`: data only (enemies, levels, dialogue, quests).
- `render`: drawing, lighting, sprites.
- `ui`, `input` and `audio`.

Types would catch the kind of mistakes this code invites. Right now the player, enemies and villagers are each loosely shaped objects with fields that sometimes exist and sometimes don't.

## 2. Keep game rules separate from drawing, sound and the on-screen controls

Right now `hurtPlayer` flashes a DOM element and plays a sound, `bossSpecial` shows the boss bar, and `drawActor` decides whether to show health bars. Instead:

- The game rules become one update step: `step(state, input, dt)`.
- Each step returns events, like `Damaged`, `Killed`, `EnteredMap` or `LevelUp`.
- The renderer, audio and HUD listen for those events and never change the game state.

That one change makes most of the game testable without a browser.

## 3. Make the game deterministic

Two things stop the same inputs from always giving the same result today. It calls `Math.random()` all over the place, and it runs on a frame time that varies. Pass in a seeded random generator, run the rules at a fixed rate (say 60 updates a second) and only let drawing follow the real frame rate. Then a test can replay "tap here, wait 2 seconds" and get the same outcome every time.

## 4. Make levels and content data instead of code

This is the main thing blocking more levels:

- **Map layout:** `genTown` hardcodes every coordinate. `questTarget` hardcodes the crypt door at `[39.5, 34]`. `usePortal` special-cases the crypt by name, and the HUD reads `G.maps.crypt` directly.
- **Proposed level format:** each level is one data file holding its tiles, objects, lights, spawns, NPCs and named portals (`{from: 'town.crypt_door', to: 'crypt.entrance'}`).
- **Hand-drawn layouts:** the text grids for rooms are fine, but the character legend should be a lookup table rather than a `switch`.
- **Editor:** for real levels, use Tiled, a free map editor that supports this angled view, and load its JSON.
- **Quests:** at the moment they're the numbers 0 to 3 with text and targets scattered across the code. They should be data instead: steps with a trigger (talk to X, enter Y, kill Z), a goal for the arrow, and the text.
- **Enemy behaviour:** the boss's slam and summon become reusable abilities listed on an enemy type (`abilities: ['slam', 'summon']`), not one-off code.

## 5. Use one model for all characters

The player, enemies and NPCs share position, health, facing and animation, but each is built differently. Use one actor with optional parts (stats, a controller that is either player input or an AI behaviour, dialogue, loot table). A full entity-component system would be overkill at this size.

Enemy behaviour is currently one big if/else chain. Turn it into small state objects (`Idle`, `Chase`, `Attack`, `Return`), each with its own enter and update, so a new enemy reuses them rather than adding more branches.

## 6. Add tests at three levels

- **Unit tests (Vitest)** for the pure parts: pathfinding, line of sight, collision sliding, the screen-to-map conversion round trip, damage and XP curves, enemy state changes, quest progress.
- **Content checks:** every room layout is rectangular, every portal leads somewhere, every spawn and quest target can be reached from the start, no door is blocked. The crypt grid was counted by hand and a crate still ended up in front of the tavern exit. A test would have caught that.
- **Scenario tests:** run the game headless with scripted input, e.g. "walk to the tavern door, check the map changed" or "stand in the slam circle, check damage". A few Playwright screenshots would catch drawing problems.

## 7. Smaller wins

- A debug overlay (paths, collision boxes, light radii, FPS).
- A URL anchor such as `#crypt` to jump straight to a map.
- A game state that can be saved and loaded, which falls out of point 2 almost for free.
- A sprite registry keyed by character kind instead of the palette and `switch` blocks.

## Where to start

Do 1 to 3 first as one refactor that keeps the game playing the same, with tests for pathfinding and the content checks alongside it. Then 4, moving the village into a data file and adding a second small level to prove the format. The rest can come as features need it.
