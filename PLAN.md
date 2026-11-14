# Plan: one engine, many small games

## Goal

Ashen Hollow showed that a small isometric action RPG (Diablo-style: tap to move, real-time combat, a hub, dungeons, loot, levels, a boss) can be made quickly. The engineering is mostly solved. Whether a game catches on depends on its setting, story, art and effects.

So this repo becomes **one shared engine** plus **a folder per game**. Each game is a pilot: a short, themed game we can put on Steam quickly and cheaply. When one starts to work, we invest in that one. The others stay small.

- **The engine** owns how the game plays: movement, pathfinding, combat, abilities, enemy behaviour, loot, levelling, quests, maps, lighting, the camera, input, saving, and the HUD layout.
- **A game** owns what it is: the setting, story, dialogue, levels, enemy and weapon lists, art (sprite drawing code and palettes), sounds, fonts, HUD skin and names.

The guideline: **share as much as possible, and give the engine extension points for the rest.** Most of a new game should be data and art. Some games will need something the engine doesn't do, which is normal. That code goes in the game's own `extensions/` folder and plugs into the engine through extension points, not into the engine itself. It moves into the engine only when a second game wants it (see "Extension points" below).

Ashen Hollow stays as the first game, in the dark fantasy setting. A second game proves that the split works.

## Repo layout

The repo will be renamed to **`arpg-forge`** (see the end of this file).

```
arpg-forge/
  engine/               shared code, no game-specific names or text
    core/               maths, the angled-view projection, seeded random generator, pathfinding
    world/              maps, tiles, collision, line of sight, portals
    sim/                actors, combat, abilities, enemy behaviour, items, quests, the update step
    render/             drawing loop, lighting, particles, the sprite registry
    ui/ input/ audio/   HUD, touch + mouse + keyboard + gamepad input, sound
    shell/              title screen, pause, settings, save slots
  games/
    ashen-hollow/       game.ts (entry), levels/, content/ (enemies, items, quests, dialogue),
                        art/ (sprite drawing code, palette), audio/, theme.css,
                        extensions/ (mechanics only this game has)
    <next-pilot>/
  tools/                build (one HTML page per game), content checks, desktop wrapper for Steam
  tests/
  prototypes/
    ashen-hollow.html   the original one-file version, kept as a frozen reference
```

One build command per game: `npm run build ashen-hollow` produces a single HTML page that can be shared, and `npm run desktop ashen-hollow` produces a desktop build for Steam.

## What a game provides

A game is one `GameDefinition` object that the engine loads:

| Part | Examples |
| --- | --- |
| `meta` | title, tagline, Steam app id later |
| `theme` | palette, fonts, HUD frame style, ambient light colours |
| `tiles` / `props` | named tile and prop kinds, each with a drawing function and collision flag |
| `actors` | enemy and NPC types: stats, abilities, behaviour, loot table, sprite |
| `abilities` | the player's kit, chosen from engine ability types (melee arc, projectile, area, dash, summon, heal) |
| `items` | weapons, consumables, upgrades, using engine item types |
| `vendors` | NPC services such as heal, sell, upgrade, built from engine service types |
| `levels` | data files holding tiles, props, lights, spawns, NPCs and named portals |
| `quests` | steps, each with a trigger (talk to X, enter Y, kill Z), an arrow target and text |
| `audio` | sound recipes keyed by engine event (hit, death, level up, ...) |

## Extension points

A game can add its own mechanics without touching `engine/`. The engine exposes registries and hooks, and the engine's own built-ins use them the same way a game would:

- **Registries** for new kinds of things: ability types, enemy behaviour states, item and vendor service types, quest triggers, tile and prop kinds, HUD widgets.
- **Systems:** a game can add its own update step that runs in the fixed-rate loop. Examples are a heat meter, a sanity meter, or extraction rules. It reads the state, adds its own fields under a namespaced key, and emits its own events.
- **Event hooks:** a game can listen to any engine event (`Damaged`, `Killed`, `EnteredMap`, ...) and react, for example "on Killed, drop scrap".
- **Overrides:** a game can replace a small number of named rules, such as the damage formula, the XP curve, the death penalty or the loot roll.

When a new mechanic doesn't fit, decide case by case:

1. **Express it as data** through an existing registry if possible.
2. **Otherwise build it as an extension** in the game's `extensions/` folder.
3. **Move it into the engine** when a second game wants the same thing. Promote it then, not before.
4. **Add a new extension point** if an extension needs to reach into engine internals. Keep the mechanic in the game.

Keep a short `EXTENSIONS.md` in each game listing what it adds, so it's easy to spot when two games are solving the same problem.

## Neutral words

The engine uses **neutral words** throughout: "melee skill" not "sword", "resource" not "mana", "healing item" not "potion", "vendor" not "smith". A game names them: the robot game's sword can be a shock baton and its mana can be battery charge.

## Step 0: set up the repo (small)

1. Rename the repo and move `index.html` to `prototypes/ashen-hollow.html`, unchanged.
2. Set up TypeScript, Vite, Vitest and the folders above.
3. Add a `CLAUDE.md` describing the engine/game rule, the layout and the commands.

## Step 1: pull the engine out, keeping Ashen Hollow playing the same

Steps 1 to 3 of the original plan, done as one refactor. When it's done, Ashen Hollow should play exactly as the prototype does.

- **Modules:** split the file into the `engine/` folders. Give the player, enemies and NPCs proper types. Today they are loosely shaped objects whose fields sometimes exist and sometimes don't.
- **Rules apart from presentation:** the game rules become one update step, `step(state, input, dt)`, which returns events (`Damaged`, `Killed`, `EnteredMap`, `LevelUp`, `QuestAdvanced`). The renderer, audio and HUD listen to those events and never change the game state. Today, for example, `hurtPlayer` flashes a DOM element and plays a sound, `bossSpecial` shows the boss bar, and `drawActor` decides whether to show health bars.
- **Deterministic:** use a seeded random generator instead of `Math.random()`, and run the rules at a fixed 60 updates a second. Drawing still follows the real frame rate.
- **Remove the fantasy from the engine:** everything named after Ashen Hollow moves into `games/ashen-hollow/`. Today that includes the `G_GRASS`…`G_DEAD` and `O_TREE`…`O_DOORWAY` constants, `PAL`, `ETYPES`, `WALLS`, the `switch` in `talkTo` that checks NPC kinds, the quest text in `updateHud`, the banner in `bossDefeated`, the Cinzel font and the colours in `:root`.
- **Platform layer:** the engine reaches saves, achievements, full screen, quitting and store features only through a small `Platform` interface (see "Shipping"). Step 1 builds the web version. Game and engine code never call browser storage or a store's API directly.
- **Everything bundled:** fonts and any other assets ship with the build instead of loading from the internet, so the game works offline and inside a desktop wrapper. Today the prototype loads Cinzel and Alegreya Sans from Google Fonts.
- **Tests alongside it:** unit tests for pathfinding, line of sight and the screen-to-map conversion, plus the content checks from step 4.

## Step 2: make content data

This is what makes each new game cheap.

- **Levels:** each level is a data file holding tiles, props, lights, spawns, NPCs and named portals (`{from: 'town.crypt_door', to: 'crypt.entrance'}`). Today `genTown` hardcodes every coordinate, `questTarget` hardcodes the crypt door at `[39.5, 34]`, `usePortal` special-cases the crypt by name, and the HUD reads `G.maps.crypt` directly. The text grids for rooms can stay, but the character legend should be a lookup table defined by the game.
- **Generated maps:** keep a small engine generator for scattering trees and rocks, and for camps. It should take the game's prop kinds as parameters, so the robot game gets scrap heaps instead of trees.
- **Editor, later:** use Tiled (a free map editor that supports this angled view) and load its JSON once levels outgrow text grids.
- **Quests:** data steps with triggers, instead of the numbers 0 to 3 used today.
- **One actor model:** one actor with optional parts (stats, a controller that is either player input or an AI behaviour, dialogue, a loot table). A full entity-component system would be overkill at this size.
- **Enemy behaviour:** small reusable states (`Idle`, `Chase`, `Attack`, `Kite`, `Return`) instead of the if/else chain in `updateEnemy`. The boss's slam and summon become abilities listed on an enemy type (`abilities: ['slam', 'summon']`). A new boss is a new mix of abilities and numbers.
- **Sprite registry:** each game registers drawing functions by actor or prop kind, instead of the palette and `switch` blocks in `drawActor` and `drawProp`.

## Step 3: prove it with a second game

Start the first new pilot (see the pilot research) as `games/<name>/` with one hub, one dungeon, three enemy types and a boss, using as little new engine code as possible. Sort every change it needs into one of two groups:

- **The engine is still specific to Ashen Hollow.** Generalise the engine.
- **The new game really is different.** Build it as an extension, and add an extension point if one is missing.

Write down which group each change fell into. This step decides whether the split and the extension points are working.

## Step 4: make a pilot shippable

What a game needs before it goes on Steam, built once in the engine:

- **Desktop controls:** mouse (click to move, click to attack, hold to keep moving), keyboard hotkeys and a gamepad. Today the game is touch-first. Keep touch for the web version and the Steam Deck.
- **Shell:** title screen, pause, settings (volume, screen shake, resolution), save and load (which falls out of step 1 almost for free), and credits.
- **Desktop wrapper:** the Steam wrapper from "Shipping", plus full screen and window size. Steam achievements come later.
- **Any screen and input:** any aspect ratio, pausing when the window loses focus, and full gamepad play (Steam Deck's "Verified" badge needs it).
- **Versioned saves,** so updates and Steam Cloud don't break older saves.
- **A small amount of juice:** hit pause, screen shake, damage numbers, death effects and a music layer. This is where the "feel" lives, and it should be shared.
- **Scope for each pilot:** about 30–60 minutes of play. One hub, two or three dungeons, four to six enemy types, two bosses, a few weapon upgrades. A Steam page and a short trailer can go up before the game is finished.

## Shipping

The game stays a web game. The web build is the one artifact, and each store gets a thin wrapper around it:

| Where | Wrapper | Cost to list |
| --- | --- | --- |
| Web: GitHub Pages, itch.io, web portals (CrazyGames, Poki) | none | free |
| Steam: Windows, Mac, Linux, Steam Deck | Electron plus steamworks.js | $100 per game, recouped after $1,000 in sales |
| iOS and Android | Capacitor | Apple $99 a year, Google $25 once |
| Consoles | a port, only for a game that already sells | developer programmes and porting work |

- **Electron rather than Tauri or NW.js:** it bundles its own Chromium, so rendering, audio and performance are the same on every machine. Tauri uses each system's webview, which differs between Windows, Mac and Linux, and the Steam overlay is reported not to work with it. Electron adds about 100 MB, which doesn't matter on Steam.
- **Web technology rather than Godot or Unity:** consoles only matter once a game sells, and a port can happen then. Until then, the web keeps pilots cheap: instant playtest links and a phone build for free.
- **One `Platform` interface** per target (web, Steam, mobile) covers saves, achievements, full screen, quitting and store features. Each wrapper supplies its own implementation, so nothing else changes between targets.
- **Order:** every pilot goes on the web first, to see what catches on. The one that does gets the Steam wrapper and a store page. Mobile comes only if a game earns it, because of Apple's yearly fee and store reviews.

## Tests at three levels

- **Unit tests (Vitest):** pathfinding, line of sight, collision sliding, the screen-to-map conversion round trip, damage and XP curves, enemy state changes, quest progress.
- **Content checks, run for every game:** every room layout is rectangular, every portal leads somewhere, every spawn and quest target can be reached from the start, no door is blocked, and every actor kind has a sprite and every event has a sound. The crypt grid was counted by hand and a crate still ended up in front of the tavern exit; a test would have caught that.
- **Scenario tests:** run the game headless with scripted input, for example "walk to the tavern door, check the map changed" or "stand in the slam circle, check the damage". A few Playwright screenshots per game would catch drawing problems.

## Smaller wins

- A debug overlay showing paths, collision boxes, light radii and FPS.
- A URL anchor such as `#crypt` to jump straight to a map.
- A `?game=` switch in development to load any game from one dev server.

## Order

Step 0, then step 1 (the big one, behaviour unchanged), then step 2, then step 3 with the first pilot. Step 4 comes when a pilot is close to having a Steam page. Ashen Hollow itself only gets polished if it's chosen as a pilot.

## Name

**`arpg-forge`**: an agnostic name that says what the repo is (a place where small action RPGs get made) without tying it to one setting. No public GitHub repo has exactly this name today. Other options: `pocket-arpg` (stresses small and mobile-friendly) and `slashforge`.
