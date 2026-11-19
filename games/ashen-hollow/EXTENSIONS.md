# Ashen Hollow's extensions

What only Ashen Hollow does, plugged into the engine's extension points. Each moves into the engine when a second
game wants it.

| Extension | What it is | Plugged in through |
| --- | --- | --- |
| `slam` (`extensions/slam.ts`) | The Bone Lord now and then marks a circle under the hero that lands after a moment | an enemy ability: listed in `ABILITIES` and used as `abilities: { slam: {…} }` on an enemy kind |
| `summon` (`extensions/summon.ts`) | The Bone Lord calls skeletons to its side once, when badly hurt | an enemy ability, the same way |

A game adds an enemy ability by writing an `EnemyAbility` (`engine/sim/abilities.ts`), handing it over in its
content's `abilities`, and listing it by name, with its settings, in the `abilities` of the enemy kinds that have it.
The engine runs it each step those enemies fight, without knowing what it does.
