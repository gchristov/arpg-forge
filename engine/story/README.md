# How a game's story works

A game's story is a **quest line**: an ordered list of named steps. The game is always at exactly one step. It moves
forward when the next step's trigger happens, and never moves back. Everything else in the story hangs off those step
names: who is where, which doors are open, which enemies have turned up, which skills the hero has.

The engine runs the story; each game writes its own, in `games/<name>/story/`:

| File | Holds |
| --- | --- |
| `quest.ts` | the quest line, the replies the story waits for, the tags of the enemies it needs beaten |
| `people.ts` | what each person says, and the services they offer |
| `things.ts` | what each thing to read or use shows |
| `voices.ts` | who speaks in the message box |
| `lines.ts` | the lines said as the story goes: thoughts, announcements, scenes |

Where people, things and enemies are placed is in the game's `levels/`.

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
hold, and a step name that doesn't exist is a type error in the game's story files:

```typescript
{ from: 'sawAsked' }                    // at or after sawAsked
{ until: 'powerOn' }                    // before powerOn
{ at: 'sawFound' }                      // exactly at sawFound
{ holding: 'chainsaw' }                 // with the chainsaw in hand (null: bare hands)
{ flag: 'wentDown' }                    // a story flag is set
{ from: 'sawAsked', not: { holding: 'chainsaw' } }
```

## People

What each person says is a list, in `people.ts`, by the kind of person (`foreman`, `trader`, …). When the hero talks to
them, the **first entry whose condition holds** is said, so put the specific ones first and the one with no condition,
said otherwise, last:

```typescript
tinker: {
  title: 'Pell the Tinker',
  services: [
    { label: 'Toughen your hands (+3 damage)', service: 0, tag: '{price} scrap', when: { holding: null } },
    { label: 'Sharpen the chain (+3 damage)', service: 0, tag: '{price} scrap', when: { not: { holding: null } } },
  ],
  says: [
    {
      at: 'sentToPell',
      pages: [
        { text: 'A Foundry robot in my workshop. …' },
        { text: 'Get it back and it’s yours. …', options: [{ label: '“I’ll get it back.”', reply: REPLY.getSaw }] },
      ],
    },
    { until: 'sentToPell', text: 'A Foundry robot in my workshop? Talk to Odell by the fire first.' },
    { text: 'It went east into the woods. Your hands will do for it.', services: true },
  ],
},
```

- An entry is one page (`text`, with `options`) or several (`pages`). Any button on a page but the last moves on to
  the next page.
- A button with a `reply` sends it: that's how the story waits for the hero's answer (a quest step `reachedBy` that
  reply). Its name comes from `REPLY` in `quest.ts`.
- `services: true` adds the person's service buttons. A service is bought by its index in `NPCS`, and `{price}` in its
  `tag` shows what it costs.
- A button's `when` offers it only while that holds.
- When a page has nothing that closes it, a leave button is added: "Leave", or the person's own `leave`.
- A conversation that the story moves on (talking to someone to reach a step) is worded as things stood before it.

## Things to read or use

What each thing shows is a list in `things.ts`, by the thing's id in the levels, chosen the same way, first match first:

```typescript
switch: {
  title: 'Turbine',
  screen: true,
  says: [
    { from: 'powerOn', text: 'STATUS: ACTIVE.' },
    { at: 'loaderDown', text: 'ACCESS GRANTED. STATUS: ACTIVE.' },
    { text: 'ACCESS DENIED.' },
  ],
},
```

`screen: true` prints it like a terminal; without it, it's something written and shows at once. Using something that
moves the story on shows what it said just before.

## Story flags

For what the story remembers that isn't a step, such as "has gone down since last patched up": `{ flag: 'wentDown' }` in
a condition. The game sets and clears a flag with the `setFlag` command.

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
