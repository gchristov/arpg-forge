# How a game's story works

A game's story is a **quest line**: an ordered list of named steps. The game is always at exactly one step. It moves
forward when the next step's trigger happens, and never moves back. Everything else in the story hangs off those step
names: who is where, which doors are open, which enemies have turned up, which skills the hero has.

The engine runs the story; each game writes its own. For Unrecalled the story is in `games/unrecalled/content/story.ts`
and the places in `games/unrecalled/levels/`.

## The quest line

Each step has a name (`id`), the objective shown on screen (`text`, left empty for steps played as a scene) and what
reaches it (`reachedBy`):

```typescript
{ id: 'sawAsked', text: 'Get Pell’s chainsaw back from the machine in the woods.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.getSaw } },
{ id: 'sawFound', text: 'Take the chainsaw back to Pell.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
```

What can reach a step:

| `reachedBy` | Reached when |
| --- | --- |
| `{ type: 'talk', npcKind }` | the hero talks to someone of that kind |
| `{ type: 'reply', npcKind, id }` | the hero chooses the reply with that `id` in a conversation with them |
| `{ type: 'enter', levelId }` | the hero walks into that level |
| `{ type: 'kill', enemyKind }` | an enemy of that kind dies |
| `{ type: 'defeat', tag }` | the one enemy with that tag dies |
| `{ type: 'use', id }` | the hero reads or uses the thing with that id |
| `{ type: 'arm', weapon }` | the hero gets that weapon in hand |

A step can also:

- `inOrder: true`: only be reached from the step just before it, for a trigger the hero can meet early (using a
  terminal that's there all along).
- `calmsEverything: true` / `alarmsEverything: true`: calm every enemy, or set every enemy on the hero.
- `takesHeroTo: { levelId, x, y }`: move the hero there, for example home after a rescue.

Steps can be skipped (killing the boss before reaching the step that asks for it still counts), except replies and
`inOrder` steps, which only move on one step at a time.

## Things that wait for a step

Anything placed in a level can name the step it waits for:

| Field | On | Means |
| --- | --- | --- |
| `fromStep: 'name'` | people, things to read, enemies, skills | there from that step on |
| `untilStep: 'name'` | people, things to read | gone from that step on |
| `lockedUntilStep: 'name'` | doors | locked until that step |

For example, Mags behind her counter until Odell is home, then by the fire:

```typescript
'2': { npc: { kind: 'trader', name: 'Mags', untilStep: 'freed' } },               // levels/interiors.ts
room.npcs.push({ kind: 'trader', name: 'Mags', x: 19.5, y: 15.5, fromStep: 'freed' }); // levels/rustbelt.ts
```

## Conditions

Anything that depends on the story uses one condition, `When` (`engine/sim/story-steps.ts`). Every part given must
hold:

```typescript
{ from: 'sawAsked' }                    // at or after sawAsked
{ until: 'powerOn' }                    // before powerOn
{ at: 'sawFound' }                      // exactly at sawFound
{ holding: 'chainsaw' }                 // with the chainsaw in hand (null: bare hands)
{ from: 'sawAsked', not: { holding: 'chainsaw' } }
```

## Changing the story

- **Add a step:** put it in the quest line where it happens, with a new name. Nothing else moves: everything refers
  to steps by name.
- **Rename a step:** rename it everywhere it's used (search for `'oldName'`).
- **Remove a step:** remove it, then anything still naming it is reported by the checks below.
- **Try a step:** start the game there with `?step=<name>`, e.g. `/unrecalled/?step=inIntake&calm#intake`.

## What catches mistakes

Run `./tools/node/run.sh npm test`. The game's content checks (`engine/sim/content-checks.ts`) report, by name:

- a step name that no step has, on a person, thing, enemy, door or skill;
- two steps with the same name;
- a step nothing can reach: someone to talk to, a thing to use, an enemy to beat or a place to enter that isn't in
  any level, or a weapon nothing gives;
- levels you can't get to.

Each game's scenario tests then play its whole story headless, so a step that can no longer be reached fails there.
