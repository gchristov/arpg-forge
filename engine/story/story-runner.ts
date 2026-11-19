import type { Watch } from '../sim/content';
import { currentLevel, type Command, type GameState, type SimEvent } from '../sim/state';
import { holds, type When } from '../sim/story-steps';
import type { Speaker } from '../ui/message-feed';
import { until, wait } from './beats';
import type { ConversationView } from './conversation-view';
import { read, talkTo, type Person, type Talk, type Thing } from './talk';

/** How near, in tiles, counts as coming near something when a rule doesn't say. */
export const NEAR = 2.5;

/** What a story rule listens for. */
export type Trigger<Step extends string = string> =
  /** The quest reached this step. */
  | { reached: Step }
  /** The hero walked into this level (not getting back up in it). */
  | { enter: string }
  /** The hero came within `within` tiles (`NEAR` if not given) of this thing to read or use. */
  | { near: string; within?: number }
  /** The hero read or used this thing. */
  | { read: string }
  /** The hero walked into a door the story keeps locked. */
  | { lockedDoor: true }
  /** The game's extensions signalled this, such as an alarm sounding (see the game's `EXTENSIONS.md`). */
  | { signal: string }
  /** The hero went down. */
  | { fell: true }
  /** The hero bought this service, by its index, from someone of this kind. */
  | { bought: { from: string; service: number } }
  /** The game started, from its title. */
  | { start: true };

/**
 * What a story rule does, in order, each waiting for the one before: a scene is a list of these. `Voice` and `Reply`
 * narrow the speakers and replies to a game's own.
 */
export type Action<Step extends string = string, Voice extends string = string, Reply extends string = string> =
  /** Someone says a line in the message box. */
  | { say: string; by: Voice }
  /** The hero thinks a line in the message box. */
  | { think: string }
  | { flag: string }
  | { unflag: string }
  /** Opens what the person of this kind on the hero's level says. */
  | { talk: string }
  /**
   * Shows a page, or what a thing to read says, closed by `button`; `afterLines` waits until every line in the message
   * box has been read; `then` runs once it's closed.
   */
  | { show: Talk | { thing: string; button?: string }; afterLines?: boolean; then?: Action<Step, Voice, Reply>[] }
  /** Uses this thing to read or use on the hero's level, as if tapped. */
  | { use: string }
  | { banner: string; subtitle?: string; seconds?: number; delay?: number }
  | { sound: string }
  /** Sends a reply to the person of this kind on the hero's level, as if chosen. */
  | { reply: Reply; to: string }
  /** The hero uses this skill, by its id, whether or not its button is shown. */
  | { useSkill: string }
  /** The picture goes cinematic (letterboxed, no HUD, taps ignored), or comes back. */
  | { cinematic: boolean }
  /** The camera jumps to this point, and as far out as `closeness` if given. */
  | { cut: { x: number; y: number }; closeness?: number }
  /** The picture fades to black, or up from black. */
  | { fade: 'out' | 'up' }
  | { wait: number }
  /** Waits until every line in the message box has been read. */
  | { waitForLines: true }
  /** Waits until the hero is in this level, having arrived. */
  | { waitUntilIn: string }
  /** One of the game's own actions, by name, from its extensions; the scene waits for it if it returns a promise. */
  | { run: string };

/** On an event, if `when` holds, do the actions; `once` does them only the first time. */
export interface Rule<Step extends string = string, Voice extends string = string, Reply extends string = string> {
  on: Trigger<Step>;
  when?: When<Step>;
  once?: boolean;
  do: readonly Action<Step, Voice, Reply>[];
}

/** What running a story needs from the game. */
export interface StoryParts<Voice extends string> {
  state: GameState;
  send(command: Command): void;
  conversation: ConversationView;
  people: Record<string, Person>;
  things: Record<string, Thing>;
  voices: Record<Voice, Speaker>;
  say(text: string, from?: Speaker): void;
  /** Every line in the message box has been read. */
  quiet(): boolean;
  banner(title: string, subtitle: string, seconds: number): void;
  sound(name: string): void;
  /** Letterboxes the picture and puts the HUD away, or brings them back; for games with scenes. */
  cinematic?(on: boolean): void;
  cut?(point: { x: number; y: number }, closeness?: number): void;
  fade?(how: 'out' | 'up'): void;
  /** The game's own actions, by name. */
  actions: Record<string, () => void | Promise<void>>;
}

/** The things to read or use the rules listen for coming near, for the rules to watch. */
export const watchFor = (rules: readonly Rule[]): Watch[] =>
  rules.flatMap((r) => ('near' in r.on ? [{ id: r.on.near, within: r.on.within ?? NEAR }] : []));

/**
 * Runs a game's story: shows what people say when talked to and what things show when used, and does what the rules
 * say on the rules' events. Things it shows that change the game go back as commands.
 */
export class StoryRunner<Voice extends string> {
  private readonly done = new Set<Rule<string, Voice>>();
  /** Whether a scene has the picture, so taps on the world are ignored. */
  inScene = false;

  constructor(
    private readonly rules: readonly Rule<string, Voice>[],
    private readonly parts: StoryParts<Voice>,
  ) {}

  /** The game has started: runs the rules waiting for it, such as an opening scene. */
  start(): void {
    this.fire([], { start: true });
  }

  /** Opens what the person with this id says, as things stood at `quest`. */
  talk(npcId: number, quest = this.parts.state.quest): void {
    const { state, people, conversation } = this.parts;
    const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
    const person = npc && people[npc.kind];
    const talk = person && talkTo(person, state, quest);
    if (talk) conversation.show(talk, npcId);
  }

  react(events: SimEvent[]): void {
    const { state } = this.parts;
    const reached = events.flatMap((e) => (e.type === 'QuestAdvanced' ? [e.step] : []));
    // Something used is worded as it was when it was used, before using it moved the story on.
    const before = Math.min(state.quest, ...reached.map((step) => step - 1));
    const getsUp = events.some((e) => e.type === 'HeroRespawned') || state.hero.dead;
    const fired: Rule<string, Voice>[] = [];
    for (const e of events) {
      if (e.type === 'Talked') this.talk(e.npcId, e.questBefore);
      const trigger = this.triggerOf(e, getsUp);
      if (trigger) fired.push(...this.rules.filter((r) => this.matches(r, trigger)));
    }
    // The box shows one thing: a page a rule opens wins over what the thing used shows.
    const opensBox = fired.some((r) => r.do.some((a) => 'talk' in a || 'show' in a));
    for (const e of events) {
      if (e.type !== 'Read' || opensBox) continue;
      const thing = this.parts.things[e.id];
      const reading = thing && read(thing, state, before);
      if (reading) this.parts.conversation.show(reading);
    }
    this.fire(fired, null, before);
  }

  private fire(fired: Rule<string, Voice>[], trigger: Trigger | null, before = this.parts.state.quest): void {
    if (trigger) fired.push(...this.rules.filter((r) => this.matches(r, trigger)));
    for (const rule of fired) {
      if (rule.once) this.done.add(rule);
      void this.perform(rule.do, before);
    }
  }

  private triggerOf(e: SimEvent, getsUp: boolean): Trigger | null {
    switch (e.type) {
      case 'QuestAdvanced': {
        const id = this.parts.state.rules.quest[e.step]?.id;
        return id ? { reached: id } : null;
      }
      case 'EnteredLevel':
        return getsUp ? null : { enter: e.levelId };
      case 'Approached':
        return { near: e.id, within: e.within };
      case 'Read':
        return { read: e.id };
      case 'PortalLocked':
        return { lockedDoor: true };
      case 'Signal':
        return { signal: e.name };
      case 'HeroDied':
        return { fell: true };
      case 'ServiceUsed': {
        const kind = currentLevel(this.parts.state).npcs.find((n) => n.id === e.npcId)?.kind;
        return kind ? { bought: { from: kind, service: e.service } } : null;
      }
      default:
        return null;
    }
  }

  private matches(rule: Rule<string, Voice>, t: Trigger): boolean {
    if (rule.once && this.done.has(rule)) return false;
    if (rule.when && !holds(this.parts.state, rule.when)) return false;
    const on = rule.on;
    if ('reached' in on) return 'reached' in t && t.reached === on.reached;
    if ('enter' in on) return 'enter' in t && t.enter === on.enter;
    if ('near' in on) return 'near' in t && t.near === on.near && t.within === (on.within ?? NEAR);
    if ('read' in on) return 'read' in t && t.read === on.read;
    if ('signal' in on) return 'signal' in t && t.signal === on.signal;
    if ('bought' in on) return 'bought' in t && t.bought.from === on.bought.from && t.bought.service === on.bought.service;
    return Object.keys(on)[0] === Object.keys(t)[0];
  }

  private async perform(actions: readonly Action<string, Voice, string>[], before: number): Promise<void> {
    const { parts } = this;
    const { state } = parts;
    for (const a of actions) {
      if ('say' in a) parts.say(a.say, parts.voices[a.by]);
      else if ('think' in a) parts.say(a.think);
      else if ('flag' in a) parts.send({ type: 'setFlag', flag: a.flag, on: true });
      else if ('unflag' in a) parts.send({ type: 'setFlag', flag: a.unflag, on: false });
      else if ('talk' in a) {
        const npc = currentLevel(state).npcs.find((n) => n.kind === a.talk);
        if (npc) this.talk(npc.id);
      } else if ('show' in a) {
        const talk = 'thing' in a.show ? this.readThing(a.show.thing, a.show.button, before) : a.show;
        if (a.afterLines) await until(parts.quiet);
        if (talk) parts.conversation.show(talk, null, () => void this.perform(a.then ?? [], state.quest));
      } else if ('use' in a) {
        const index = currentLevel(state).readables.findIndex((r) => r.id === a.use);
        if (index >= 0) parts.send({ type: 'read', index });
      } else if ('banner' in a) {
        const show = () => parts.banner(a.banner, a.subtitle ?? '', a.seconds ?? 3);
        if (a.delay) setTimeout(show, a.delay * 1000);
        else show();
      } else if ('sound' in a) parts.sound(a.sound);
      else if ('reply' in a) {
        const npc = currentLevel(state).npcs.find((n) => n.kind === a.to);
        if (npc) parts.send({ type: 'reply', npcId: npc.id, id: a.reply });
      } else if ('useSkill' in a) {
        const slot = state.rules.hero.skills.findIndex((skill) => skill.id === a.useSkill);
        if (slot >= 0) parts.send({ type: 'useSkill', slot });
      } else if ('cinematic' in a) {
        this.inScene = a.cinematic;
        parts.cinematic?.(a.cinematic);
      } else if ('cut' in a) parts.cut?.(a.cut, a.closeness);
      else if ('fade' in a) parts.fade?.(a.fade);
      else if ('wait' in a) await wait(a.wait);
      else if ('waitForLines' in a) await until(parts.quiet);
      else if ('waitUntilIn' in a) await until(() => state.levelId === a.waitUntilIn && !state.transition);
      else await parts.actions[a.run]?.();
    }
  }

  private readThing(id: string, button: string | undefined, quest: number): Talk | null {
    const thing = this.parts.things[id];
    return thing ? read(thing, this.parts.state, quest, button) : null;
  }
}
