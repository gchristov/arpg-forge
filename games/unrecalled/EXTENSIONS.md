# Unrecalled's extensions

What only Unrecalled does, plugged into the engine's extension points. Each moves into the engine when a second game
wants it.

| Extension | What it is | Plugged in through |
| --- | --- | --- |
| `assemblyWakes` (`extensions/assembly-wakes.ts`) | The Assembly upriver lighting a storey at a time and coming awake, in the last scene | a story action the game names, `{ run: 'assemblyWakes' }` |
| `withholdEmp`, `showEmp` (`main.ts`) | Keeping the EMP's button hidden while the overcharge plays, so it's seen before it's explained | story actions the game names |
| `endCard` (`main.ts`) | The closing card | a story action the game names |

A game adds its own story action by naming it in `extensions/actions.ts` (so the story checks know it), doing it in the
`actions` it gives `StoryRunner` in `main.ts`, and using it from its rules or scenes as `{ run: 'name' }`; a scene
waits for it if it returns a promise.
