# Unrecalled's extensions

What only Unrecalled does, plugged into the engine's extension points. Each moves into the engine when a second game
wants it.

| Extension | What it is | Plugged in through |
| --- | --- | --- |
| `assemblyWakes` (`extensions/assembly-wakes.ts`) | The Assembly upriver lighting a storey at a time and coming awake, in the last scene | a story action the game names, `{ run: 'assemblyWakes' }` |
| `withholdEmp`, `showEmp` (`main.ts`) | Keeping the EMP's button hidden until it has burst out after the override, so it's seen before it's explained | story actions the game names |
| `endCard` (`main.ts`) | The closing card | a story action the game names |
| `calm` (`extensions/calm-machines.ts`) | The machines take U-7 for one of their own, looking it over once, until one is hit; that sounds the floor's alarm, on every floor of its building, and from then on they come for U-7 on sight. Fighting the raider at the crates sounds no alarm. In the practice arena the machines come for U-7 from the start. | an enemy ability (`idle`, `hurt`, `afterEnemies`), listed on the machines' kinds as `abilities: { calm: {} }`; the alarm is a mark in each floor's memory |
| `alarmEverything`, `calmEverything` (`extensions/calm-machines.ts`) | Sounding the alarm on every floor, and calming every machine everywhere | step actions, named in a quest step's `does` |
| `alarm`, `recognised` signals (`extensions/calm-machines.ts`) | An alarm sounding, and a machine first looking U-7 over, for the story, sounds and labels | signals, heard by the story as `on: { signal: 'alarm' }` |
| Scanning beams (`extensions/machine-scans.ts`, `scan-beams.ts`) | The beam from a machine's eye looking U-7 over | the game's `draw` hook; which machines have an eye, and its height, are `SCANNER_EYES` in `art/look.ts` |
| `cut` (`extensions/cutting.ts`) | Pell's chainsaw cutting for as long as it's held against a machine, a tick of damage at a time, reported a few times a second, holding the machine where it is (the engine's `rootedFor`) | a weapon attack, named in the chainsaw's `attack` in `content/hero.ts` |
| Mesh lines (`extensions/mesh-lines.ts`) | The fine mesh of lines over U-7's steel shell, drawn over a copy of the shell the model build raises off it (`raisedCopy`, in the model's Mesh material) | the hero look's `dress`; not used while U-7 is the plain base body |
| Glass shine (`extensions/glass-shine.ts`) | U-7's see-through glass (its body's own material, `MI_Superhero_Male`) shining like glass: a fixed reflection image (a matcap) drawn over it, dark where the glass faces the camera so it stays clear, with a thin bright rim where it turns edge on, following its outline as U-7 moves: one extra draw, no lights | the hero look's `dress`, in the world and in its portrait |
| Core glow (`extensions/core-glow.ts`) | U-7's core and the nodes of its brain glowing bright through the glass over them: a twin of each glowing part adds its colour on top, drawn after the glass, untouched by tone mapping, still hidden by anything solid in front; it fades out when U-7 dies and back when it gets up, and U-7's light (the engine's hero light) fades with it | the hero look's `dress`, in the world and in its portrait; the game's `draw` hook, with `SceneRenderer.dimHeroLight` |
| `blast` (`extensions/blaster.ts`) | U-7's hand blaster and fists, the weapon it starts with: from out of a machine's reach it shoots every so often for a little charge, and steps in to punch a machine that gets close back out to shooting distance (a boss is only shot). It dashes to a machine that's down (the engine's `stunnedFor`, from the repel or the EMP, which send U-7 after one with `chaseStunned`) and keeps tearing at its core with powered strikes until it dies or gets up, then moves on to the next one that's down. It sends `blast`, `punch` and `poweredStrike` signals for the look and sounds | a weapon attack, named in the blaster's `attack` in `content/hero.ts`; the hero's `startingWeapon` |
| Blast effects (`extensions/blast-effects.ts`) | The strokes from U-7's hand to what it shoots, the flash of a powered strike, the repel's strokes fanning out ahead, and sparks off machines that are down | the game's `react` and `draw` hooks |
| Cut spray (`extensions/cut-spray.ts`) | The screen rumbling and oil spurting off what U-7 cuts | the game's `draw` hook; the lean and buzz while cutting are the hero look's `channelPose` |
| Alarm lights (`levels/foundry.ts`) | The Foundry's beacons, dark until the floor's alarm, then pulsing; not drawn while the base look gives lamps no light | level lights with `onlyWhen` and `pulse`, on the alarm's mark |

A game adds its own story action by naming it in `extensions/actions.ts` (so the story checks know it), doing it in the
`actions` it gives `StoryRunner` in `main.ts`, and using it from its rules or scenes as `{ run: 'name' }`; a scene
waits for it if it returns a promise.

A new enemy ability goes in `content/world.ts`'s `abilities`, a new step action in its `stepActions` and a new weapon
attack in its `weaponAttacks`, by the name the enemy kinds, quest steps or weapons use; a new signal goes in its
extension's `SIGNALS`, so the story checks know it.
