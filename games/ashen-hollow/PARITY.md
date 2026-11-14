# Ashen Hollow: parity with the prototype

The first build of Ashen Hollow on the engine replicates `prototypes/ashen-hollow.html`: the same mechanics, story and levels, drawn in 3D. This list is the spec. Tick an item when the engine version matches it. When every item is ticked, `/ashen-hollow/` switches to the engine version, and the prototype and this file are deleted.

Where this list says "as in the prototype", the prototype's code holds the exact data (function names are given), and the build copies it into the game's content files.

## Intended differences

These differ on purpose and don't count against parity:

- **Visuals:** 3D models, lighting and effects instead of shapes drawn in code. Effects keep their meaning (a hit flashes, the slam circle is visible before it lands), not their look.
- **Random rolls:** a seeded generator replaces `Math.random()`, so individual rolls differ while the odds stay the same.
- **Timing:** rules run at a fixed 60 updates a second, instead of following the frame rate with frame time capped at 0.05 s.
- **Fonts:** bundled with the game instead of loaded from Google Fonts.

## Story and text

- [ ] Title screen: "Ashen Hollow", "The dead are restless beneath the old crypt.", control hints (Walk: tap or hold the ground; Fight: tap an enemy, or the sword; Enter: tap a building or walk into its door; Talk: tap a villager) and "Tap to begin".
- [ ] On start, banner "Ashen Hollow" / "Speak to Elder Maren in the square." for 3 s.
- [ ] Quest line, shown in the HUD:
  - [ ] 0 "Speak to Elder Maren in the square."
  - [ ] 1 "Clear the Old Crypt, east past the graveyard." Reached by talking to Maren.
  - [ ] 2 "Find the Bone Lord in the crypt's north chamber." Reached by entering the crypt.
  - [ ] 3 "The Bone Lord is dead. Hunt what's left in the wilds." Reached by killing the boss.
- [ ] Elder Maren's three lines: the first talk, while the quest is in progress, and after the boss (text as in `talkTo`), each with one option, "I'll go".
- [ ] Brann the Innkeeper: his line, plus "Rest by the fire" (free: full health and mana, "Rested"), "Buy a healing potion" (25 gold, disabled if short) and "Leave".
- [ ] Hilde the Smith: her line, plus "Hone your blade (+3 damage)" (40 gold, then 30 more each time, disabled if short; shows "Blade honed") and "Leave".
- [ ] Entering a map shows a banner with its name and subtitle for 1.8 s:
  - The Sleeping Boar: "Warm ale, cold stew"
  - The Smithy: "Hilde's forge"
  - Maren's Cottage: "Someone left a chest unlocked"
  - The Old Crypt: "The air smells of dust and grave-moss"
- [ ] Boss at half health: banner "The dead answer his call" (2.2 s).
- [ ] Boss killed: banner "The Bone Lord is destroyed" / "Ashen Hollow is safe. The wilds still stir." (4.5 s, after 0.6 s).
- [ ] Level up: banner "Level N" / "Stronger, and fully healed."
- [ ] Death: banner "You have fallen" / "Tap to rise again in the village." until tapped. After respawn, if gold was lost: "Ashen Hollow" / "N gold lost."
- [ ] Floating text: damage numbers, "Not enough mana", "No potions", "Already healthy", "+N" healing, "+N gold", "+1 potion".

## Levels

- [ ] **Village** (54×54, outdoors), as in `genTown`:
  - [ ] Ground: grass; a stone square (12–21, 12–19); dirt roads along the listed waypoints; an oval pond; a dead-grass graveyard.
  - [ ] Graves at x 35, 37, 42, 44 by y 38, 40, 42, 44, plus two dead trees.
  - [ ] Buildings with doors and window lights:
    - The Sleeping Boar (8,5, 7×4, door 11,8)
    - The Smithy (19,6, 5×4, door 21,9)
    - Maren's Cottage (5,14, 4×4, door 6,17)
    - The Old Crypt (38,30, 4×4, door 39,33), lit purple
  - [ ] Props:
    - Four lamps at the square's corners
    - A well at 16,15
    - Two purple braziers by the crypt
    - Three camps with braziers, at 40,13, 15,42 and 45,25
  - [ ] Tree border two tiles deep, then thinning; trees, rocks and bushes scattered by noise, denser in the wilds (x > 26 or y > 24). The layout comes from the same hash and noise functions, so it matches tile for tile.
  - [ ] Spawns:
    - Four skeletons in the graveyard
    - Goblin camps at the first two camps (four goblins each)
    - A skeleton camp at the third (three skeletons)
    - Elder Maren at 14.5, 15.6
  - [ ] The player starts at 16.5, 22.5, facing up and to the right.
- [ ] **Interiors** from the text grids in `LAYOUTS`, with the legend: `#` wall, `L` wall torch, `D` exit, `t` table, `b` barrel, `x` crate, `a` anvil, `k` bed, `C` chest, `p` pillar, `f` brazier, `g` bones (walkable), `s` skeleton, `r` archer, `B` boss, `n` the room's NPC.
  - [ ] Tavern (wood floor, Brann), Smithy (stone floor, Hilde), Cottage (wood floor, chest), Crypt (crypt floor, purple braziers, the boss in the north chamber).
  - [ ] Entering an interior puts the player just inside the exit. Leaving puts them one tile in front of the building's door.
- [ ] **Light and mood** per map: dark night outdoors; warm and dim in the tavern and smithy; darker in the cottage; very dark in the crypt, with purple braziers.

## Hero

- [ ] Starts with 100 health, 50 mana, level 1, 0 of 60 XP, 0 gold, 3 potions, damage 8–13, speed 3.7 tiles a second, radius 0.28.
- [ ] Mana regenerates 2.2 a second. Health regenerates 2 a second after 5 s without being hurt. Neither regenerates while dead.
- [ ] Level up: the XP needed grows ×1.5 (rounded), +12 max health, +6 max mana, damage +2/+3, then full health and mana. Several level-ups can happen at once.
- [ ] Death: input stops. A tap respawns the hero in the village with full health and mana, minus half their gold (rounded down). Enemies on the map they died on go back home at full health.

## Controls

- [ ] Tap or hold the ground: walk there by pathfinding to the nearest free tile, with a marker. Holding re-targets every 0.14 s.
- [ ] Tap an enemy (within 34 px of its body, scaled with zoom and enemy size): target it, chase it and attack, with a red marker.
- [ ] Tap an NPC: walk up and talk when within 1.45 tiles.
- [ ] Tap a building: walk to its door, with a marker.
- [ ] Tap an unopened chest: walk to it and open it when within 1.45 tiles.
- [ ] Tap a doorway: walk into it.
- [ ] Attack button, `2` or space: target the nearest visible enemy within 7 tiles, or swing at nothing if there's none.
- [ ] Fireball button or `3`. Potion button or `1`.
- [ ] Mute button toggles all sound.
- [ ] Tapping anywhere closes an open dialogue. Input is ignored during a map transition.

## Combat

- [ ] Melee swing: 0.55 s cooldown. The swing lasts 0.3 s and hits at its midpoint if the target is within 1.05 tiles plus its radius plus 0.3.
  - [ ] Damage is a roll in the damage range plus the smith bonus. A 12% crit chance deals ×1.8, rounded.
  - [ ] Knockback 0.18 tiles, except for the boss.
- [ ] The hero attacks when within 1.0 tiles plus the target's radius. Otherwise they chase it: straight if there's line of sight, else along a path re-planned every 0.3 s.
- [ ] Fireball: costs 12 mana, 0.6 s cooldown. It flies at 9 tiles a second for up to 1.1 s, aimed at the target or the nearest visible enemy within 9 tiles, or straight ahead.
  - [ ] It explodes on a wall, an enemy (within 0.45 plus its radius) or timing out.
  - [ ] The explosion hits every enemy within 1.5 plus its radius for 22–32 plus 3 per level. A 10% crit chance deals ×1.6. Hits are knocked back away from the centre.
- [ ] Potion: heals up to 60, but not above max. Refused when there are none or health is full.
- [ ] Taking damage: a minimum of 1, rounded. A red screen flash, screen shake and a hurt sound.
- [ ] Bodies push each other apart. NPCs don't move, and the hero moves less (weight 0.4 against 1).

## Enemies

- [ ] Types, as in `ETYPES`:

  | | Health | Damage | Speed | Range | Attack cooldown | Wind-up | Aggro | XP | Gold | Size |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Goblin | 30 | 4–7 | 2.4 | 0.85 | 1.0 | 0.32 | 6 | 12 | 3–9 | 0.82 |
  | Skeleton | 44 | 6–10 | 1.9 | 0.9 | 1.2 | 0.4 | 7 | 18 | 5–12 | 1 |
  | Skeleton Archer (ranged) | 32 | 5–9 | 1.7 | 6.5 | 2.1 | 0.55 | 8 | 22 | 6–14 | 1 |
  | The Bone Lord (boss) | 420 | 12–19 | 1.75 | 1.15 | 1.4 | 0.5 | 8 | 250 | 120–160 | 1.55 |

- [ ] **Idle:** wander within 2.5 tiles of home every 2.5–6 s at 35% speed. Seeing the hero (within aggro range, with line of sight) switches to chase, with an alert sound. For the boss, the boss bar appears.
- [ ] **Chase:** go straight with line of sight, otherwise along a path re-planned every 0.6 s. Give up and return when the hero is dead, beyond 2.4× aggro range, or (except the boss) more than 16 tiles from home.
- [ ] **Attack:** in range (archers also need line of sight) with the cooldown ready, wind up, then strike.
  - [ ] Melee hits if the hero is still within range plus both radii plus 0.35; otherwise it's a swish.
  - [ ] Archers fire an arrow at 8 tiles a second, lasting up to 1.2 s and hitting within 0.45 tiles. Archers back away when the hero is within 2.4.
  - [ ] Cooldown afterwards: the type's value × 0.85–1.15.
- [ ] **Return:** heal 25% of max health a second while walking home along a path. If they see the hero within 70% of aggro range, they chase again.
- [ ] Being hit while idle or returning switches to chase.
- [ ] **Boss slam:** every 5–7 s, when within 6 tiles and not attacking, a "!" and a 1.7-tile circle at the hero's position, which lands after 1.0 s for 16–24 damage if they're still inside. Screen shake and a crack decal.
- [ ] **Boss summon:** once, below half health, three skeletons appear around him and chase at once.
- [ ] **Death:** XP, a gold drop (the type's range) and a 20% potion chance. The boss always drops two potions, and sets the quest to 3. A decal: blood for goblins, bones for the others. The body fades over 1 s.
- [ ] **Village respawns:** every 30 s, if fewer than 12 enemies are alive, a random camp more than 12 tiles from the hero gets a new goblin or skeleton group (50/50).

## Items and the world

- [ ] Drops scatter 0.2–0.6 tiles, bounce, and are picked up within 0.75 tiles once landed. Gold has no cap. Potions cap at 9; a potion drop stays on the ground when full.
- [ ] Cottage chest: opens once, dropping 45 gold and 2 potions.
- [ ] Portals: building doors in the village, and the `D` tile inside. There's a 0.7 s cooldown after arriving. Transitions fade out and in over 0.3 s, with a door sound.
- [ ] Entering the crypt before the quest reaches 2 sets it to 2, unless the boss is already dead.
- [ ] Chimney smoke in the village every 1.6 s.

## HUD

- [ ] Health and mana orbs with numbers. A gold count. The level. An XP bar. The location name. The quest line.
- [ ] Potion button with a count badge, greyed at 0. Fireball button with a cooldown sweep, greyed below 12 mana.
- [ ] Boss bar with "The Bone Lord" while he's chasing, hidden otherwise.
- [ ] Health bars over damaged enemies.

## Sound

- [ ] A sound for each of: swing, hit (flesh), hit (bone), hurt, fireball cast, explosion, coin, potion, level up, door, death, arrow, alert, slam, chest and refused action (recipes in `SFX`).
