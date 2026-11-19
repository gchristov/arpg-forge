import type { GameContent } from '../sim/content';
import type { Action, Rule, Trigger } from './story-runner';
import type { Person, Thing } from './talk';

/** A game's story, as the checks see it. */
export interface Story {
  people: Record<string, Person>;
  things: Record<string, Thing>;
  rules: readonly Rule[];
  /** The names of the game's own actions, for `run`. */
  actions: readonly string[];
  /** Things to read or use that show nothing of their own, because a rule does something else with them. */
  showsNothing?: readonly string[];
}

/**
 * Finds mistakes in a game's story that would only show in play, each named so it can be found: names of steps,
 * people, things, places, skills, replies and actions that don't exist, replies the quest waits for that nobody
 * offers, and entries that can never be said because one before them always is.
 */
export function checkStory(content: GameContent, story: Story): string[] {
  const problems: string[] = [];
  const steps = new Set(content.quest.flatMap((s) => (s.id ? [s.id] : [])));
  const levels = new Set(content.levels.map((l) => l.level.id));
  const kinds = new Set(content.levels.flatMap((l) => l.npcs.map((n) => n.kind)));
  const readables = new Set(content.levels.flatMap((l) => (l.readables ?? []).map((r) => r.id)));
  const skills = new Set(content.hero.skills.map((s) => s.id));
  const actions = new Set(story.actions);
  const step = (where: string, id: string | undefined) => {
    if (id !== undefined && !steps.has(id)) problems.push(`${where}: no quest step is named "${id}"`);
  };
  const when = (where: string, w: { from?: string; until?: string; at?: string; not?: unknown } | undefined) => {
    if (!w) return;
    step(where, w.from);
    step(where, w.until);
    step(where, w.at);
    when(where, w.not as typeof w);
  };

  const offered = new Set<string>();
  for (const [kind, person] of Object.entries(story.people)) {
    if (!kinds.has(kind)) problems.push(`people: "${kind}" says things but isn't in any level`);
    const where = `${person.title}`;
    let always = false;
    person.says.forEach((said, i) => {
      if (always) problems.push(`${where}: entry ${i + 1} is never said, since one before it always is`);
      when(where, said);
      if (!said.from && !said.until && !said.at && !said.flag && said.holding === undefined && !said.not) always = true;
      const pages = 'pages' in said ? said.pages : [{ text: said.text, options: said.options }];
      for (const o of [...pages.flatMap((p) => p.options ?? []), ...(person.services ?? [])]) {
        if (o.reply) offered.add(`${kind}:${o.reply}`);
        when(where, o.when);
      }
    });
  }
  for (const kind of kinds) if (!story.people[kind]) problems.push(`people: "${kind}" is in a level but says nothing`);

  for (const [id, thing] of Object.entries(story.things)) {
    if (!readables.has(id)) problems.push(`things: "${id}" shows something but isn't in any level`);
    let always = false;
    thing.says.forEach((shown, i) => {
      if (always) problems.push(`${thing.title}: entry ${i + 1} is never shown, since one before it always is`);
      when(thing.title, shown);
      if (!shown.from && !shown.until && !shown.at && !shown.flag && shown.holding === undefined && !shown.not) always = true;
    });
  }
  for (const id of readables) {
    if (!story.things[id] && !story.showsNothing?.includes(id)) problems.push(`things: "${id}" is in a level but shows nothing`);
  }

  const trigger = (where: string, on: Trigger) => {
    if ('reached' in on) step(where, on.reached);
    if ('enter' in on && !levels.has(on.enter)) problems.push(`${where}: no level is named "${on.enter}"`);
    if ('near' in on && !readables.has(on.near)) problems.push(`${where}: "${on.near}" isn't in any level`);
    if ('read' in on && !readables.has(on.read)) problems.push(`${where}: "${on.read}" isn't in any level`);
    if ('bought' in on && !kinds.has(on.bought.from)) problems.push(`${where}: nobody of kind "${on.bought.from}" is in any level`);
  };
  const act = (where: string, a: Action) => {
    if ('talk' in a && !kinds.has(a.talk)) problems.push(`${where}: nobody of kind "${a.talk}" is in any level`);
    if ('reply' in a) {
      if (!kinds.has(a.to)) problems.push(`${where}: nobody of kind "${a.to}" is in any level`);
      offered.add(`${a.to}:${a.reply}`);
    }
    if ('use' in a && !readables.has(a.use)) problems.push(`${where}: "${a.use}" isn't in any level`);
    if ('show' in a && 'thing' in a.show && !story.things[a.show.thing]) problems.push(`${where}: "${a.show.thing}" shows nothing`);
    if ('show' in a) for (const next of a.then ?? []) act(where, next);
    if ('useSkill' in a && !skills.has(a.useSkill)) problems.push(`${where}: the hero has no skill "${a.useSkill}"`);
    if ('waitUntilIn' in a && !levels.has(a.waitUntilIn)) problems.push(`${where}: no level is named "${a.waitUntilIn}"`);
    if ('run' in a && !actions.has(a.run)) problems.push(`${where}: the game has no action "${a.run}"`);
  };
  story.rules.forEach((rule, i) => {
    const where = `rule ${i + 1} (on ${JSON.stringify(rule.on)})`;
    trigger(where, rule.on);
    when(where, rule.when);
    for (const a of rule.do) act(where, a);
  });

  content.quest.forEach((s, i) => {
    const t = s.reachedBy;
    if (t?.type === 'reply' && !offered.has(`${t.npcKind}:${t.id}`)) {
      problems.push(`quest step "${s.id ?? i}" waits for the reply "${t.id}" to "${t.npcKind}", which nothing offers`);
    }
  });
  return problems;
}
