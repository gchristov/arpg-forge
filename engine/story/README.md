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
| `rules.ts` | what happens as the story goes: on an event, the lines said, pages shown and the rest |
| `scenes.ts` | the scenes: lists of actions played one after another, such as the opening |
| `lines.ts` | the game's own words around the story, such as the closing card |

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

## Rules: what happens as the story goes

Everything else that happens in the story is a rule in `rules.ts`: **on** an event, **when** a condition holds, **do**
the actions in order. `once: true` does it only the first time.

```typescript
{ on: { reached: 'loaderDown' }, do: [{ think: 'Got it. The turbine’s access code.' }] },
{ on: { enter: 'intake' }, once: true, do: [{ say: 'U-7 DETECTED INSIDE THE FACILITY. ALARM SYSTEMS ACTIVE.', by: 'foundry' }] },
{ on: { near: 'charging-station' }, once: true, do: [{ think: 'My old charging station. …' }] },
{ on: { enter: 'control' }, once: true, when: { until: 'engineDown' }, do: [{ say: 'U-7. You came back. …', by: 'orderEngine' }] },
{ on: { reached: 'orderClosed' }, do: [{ show: GIVING_THE_ORDER, then: [{ talk: 'foreman' }] }] },
```

| `on` | Happens when |
| --- | --- |
| `{ reached: 'step' }` | the quest reaches the step |
| `{ enter: 'level' }` | the hero walks into the level (not getting back up in it) |
| `{ near: 'thing', within: 4 }` | the hero comes within that many tiles of the thing (2.5 if not given), each time they come near |
| `{ read: 'thing' }` | the hero reads or uses the thing |
| `{ lockedDoor: true }` | the hero walks into a door the story keeps locked, once each time |
| `{ alarm: true }` | the alarm sounds |
| `{ fell: true }` | the hero goes down |
| `{ bought: { from: 'trader', service: 0 } }` | the hero buys that service from someone of that kind |
| `{ start: true }` | the game starts from its title (with `when: { at: 'firstStep' }` for a new game only) |

| `do` | Does |
| --- | --- |
| `{ say: 'text', by: 'voice' }` | someone says a line in the message box, by their voice in `voices.ts` |
| `{ think: 'text' }` | the hero thinks a line |
| `{ talk: 'kind' }` | opens what the person of that kind on the hero's level says |
| `{ show: page, then: [...] }` | shows a page (or `{ thing: 'id', button: 'Plug in' }`: what a thing says, with its own button); `afterLines: true` waits for the message box to empty first; `then` runs once it's closed |
| `{ use: 'thing' }` | uses the thing, as if tapped |
| `{ flag: 'name' }` / `{ unflag: 'name' }` | sets or clears a story flag |
| `{ banner: 'title', subtitle, seconds, delay }` | a title across the screen |
| `{ sound: 'name' }` | one of the game's sounds |
| `{ reply: 'name', to: 'kind' }` | sends a reply to that person, as if chosen |
| `{ useSkill: 'id' }` | the hero uses that skill |
| `{ cinematic: true }` / `false` | letterboxes the picture, puts the HUD away and ignores taps on the world, or brings them back |
| `{ cut: { x, y }, closeness }` | the camera jumps there (and that far out) |
| `{ fade: 'out' }` / `'up'` | the picture fades to black, or up from it |
| `{ wait: 1.5 }` | waits that many seconds |
| `{ waitForLines: true }` | waits until every line in the message box has been read |
| `{ waitUntilIn: 'level' }` | waits until the hero has arrived in that level |
| `{ run: 'name' }` | one of the game's own actions, listed in its `EXTENSIONS.md` |

Actions run in order, each waiting for the one before, so a scene is just a list of them in `scenes.ts`, and a rule
plays it with `do: SCENE` (or after a page closes, `then: SCENE`):

```typescript
export const ARRIVAL: Scene = [
  { cinematic: true },
  { say: 'Stop right there. You’re one of them. …', by: 'odell' },
  { say: 'I left the Foundry. I came to warn you.', by: 'u7' },
  { waitForLines: true },
  { cinematic: false },
  { reply: 'proveIt', to: 'foreman' },
];
// rules.ts
{ on: { start: true }, when: { at: 'arrival' }, do: ARRIVAL },
```

What only one game does in a scene (the Assembly lighting a storey at a time) is that game's own action, named in the
`actions` it gives the runner and listed in its `EXTENSIONS.md`.

When a thing is used, it shows what it says, unless a rule on the same event opens a page or a conversation instead:
that's how using the order terminal at the right step plays its scene rather than its screen.

## Story flags

For what the story remembers that isn't a step, such as "has gone down since last patched up": `{ flag: 'wentDown' }` in
a condition, set and cleared by the `flag` and `unflag` actions.

## Changing the story

- **Add a step:** put it in the quest line where it happens, with a new name. Nothing else moves: everything refers
  to steps by name.
- **Rename a step:** rename it everywhere it's used (search for `'oldName'`).
- **Remove a step:** remove it, then anything still naming it is reported by the checks below.
- **Try a step:** start the game there with `?step=<name>`, e.g. `/unrecalled/?step=inIntake&calm#intake`.

## What catches mistakes

Run `./tools/node/run.sh npm test`. Step names in the story files are typed, so a misspelt one is an error in the
editor before anything runs. Then the tests check, and name what's wrong:

- **Story checks** (`engine/story/story-checks.ts`): every step, person, thing, place, skill, reply and game action the
  story names exists; every reply a quest step waits for is offered by someone (or sent by a scene); every person and
  thing in the levels has something to say; and no entry comes after one that always applies, where it could never be
  said.
- **Content checks** (`engine/sim/content-checks.ts`): a step name that no step has on a person, thing, enemy, door or
  skill; two steps with the same name; a step nothing can reach; levels you can't get to.
- **The script** (`games/<name>/story/SCRIPT.md`): the whole story written out, from the quest to every line and scene.
  The tests compare it with the story files, so a change to the story fails them until the script is brought up to date
  with `./tools/node/run.sh npm test -- -u`. Then the change shows up in the script as a diff to read, and the script is
  a quick way to read the story from start to end.
- **Each game's scenario tests** play its whole story headless, so a step that can no longer be reached fails there.
