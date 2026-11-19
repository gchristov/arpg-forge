# Unrecalled's extensions

What only Unrecalled does, plugged into the engine's extension points. Each moves into the engine when a second game
wants it.

| Extension | What it is | Plugged in through |
| --- | --- | --- |
| `assemblyWakes` (`extensions/assembly-wakes.ts`) | The Assembly upriver lighting a storey at a time and coming awake, in the last scene | a story action the game names, `{ run: 'assemblyWakes' }` |
| `withholdEmp`, `showEmp` (`main.ts`) | Keeping the EMP's button hidden while the overcharge plays, so it's seen before it's explained | story actions the game names |
| `endCard` (`main.ts`) | The closing card | a story action the game names |
| `calm` (`extensions/calm-machines.ts`) | The machines take U-7 for one of their own, looking it over once, until one is hit; that sounds the floor's alarm, on every floor of its building, and from then on they come for U-7 on sight. Fighting the raider at the crates sounds no alarm. | an enemy ability (`idle`, `hurt`, `afterEnemies`), listed on the machines' kinds as `abilities: { calm: {} }`; the alarm is a mark in each floor's memory |
| `alarmEverything`, `calmEverything` (`extensions/calm-machines.ts`) | Sounding the alarm on every floor, and calming every machine everywhere | step actions, named in a quest step's `does` |
| `alarm`, `recognised` signals (`extensions/calm-machines.ts`) | An alarm sounding, and a machine first looking U-7 over, for the story, sounds and labels | signals, heard by the story as `on: { signal: 'alarm' }` |
| Scanning beams (`extensions/machine-scans.ts`, `scan-beams.ts`) | The beam from a machine's eye looking U-7 over | the game's `draw` hook; which machines have an eye, and its height, are `SCANNER_EYES` in `art/look.ts` |
| `cut` (`extensions/cutting.ts`) | Pell's chainsaw cutting for as long as it's held against a machine, a tick of damage at a time, reported a few times a second | a weapon attack, named in the chainsaw's `attack` in `content/hero.ts` |
| Cut spray (`extensions/cut-spray.ts`) | The screen rumbling and oil spurting off what U-7 cuts | the game's `draw` hook; the lean and buzz while cutting are the hero look's `channelPose` |
| Alarm lights and air (`levels/foundry.ts`, `art/look.ts`) | The Foundry's beacons, dark until the floor's alarm, then pulsing, and its air turning red | level lights with `onlyWhen` and `pulse`, and the mood's `ambientWhen`, on the alarm's mark |

A game adds its own story action by naming it in `extensions/actions.ts` (so the story checks know it), doing it in the
`actions` it gives `StoryRunner` in `main.ts`, and using it from its rules or scenes as `{ run: 'name' }`; a scene
waits for it if it returns a promise.

A new enemy ability goes in `content/world.ts`'s `abilities`, a new step action in its `stepActions` and a new weapon
attack in its `weaponAttacks`, by the name the enemy kinds, quest steps or weapons use; a new signal goes in its
extension's `SIGNALS`, so the story checks know it.
