import type { QuestStep } from '../sim/content';
import type { When } from '../sim/story-steps';
import type { Story } from './story-checks';
import type { Action, Trigger } from './story-runner';
import type { Option } from './talk';

/**
 * A game's whole story as one readable script: the quest, what each person says and each thing shows, and what
 * happens as the story goes, scenes and all. Each game's tests keep it in a file next to the story, so any change to
 * the story shows up there as a diff to read.
 */
export function storyScript(title: string, quest: readonly (QuestStep & { text?: string })[], story: Story): string {
  const out: string[] = [`# ${title}: the story`, '', 'Written out from the story files by the tests; don\'t edit it by hand.', ''];
  out.push('## Quest', '');
  quest.forEach((step, i) => {
    const by = step.reachedBy ? ` (${triggerText(step.reachedBy)})` : '';
    out.push(`${i}. \`${step.id ?? i}\`${by}: ${step.text ? step.text : '*no objective*'}`);
  });
  out.push('', '## People', '');
  for (const [kind, person] of Object.entries(story.people)) {
    out.push(`### ${person.title} (\`${kind}\`)`, '');
    for (const said of person.says) {
      out.push(`- ${condition(said)}:`);
      const pages = 'pages' in said ? said.pages : [{ text: said.text, options: said.options }];
      for (const page of pages) {
        out.push(`  > ${page.text}`);
        const options = [...(page === pages[pages.length - 1] && said.services ? person.services ?? [] : []), ...(page.options ?? [])];
        if (options.length) out.push(`  > ${options.map(button).join(' ')}`);
      }
    }
    out.push('');
  }
  out.push('## Things to read or use', '');
  for (const [id, thing] of Object.entries(story.things)) {
    out.push(`### ${thing.title} (\`${id}\`${thing.screen ? ', a screen' : ''})`, '');
    for (const shown of thing.says) out.push(`- ${condition(shown)}: ${shown.text}`);
    out.push('');
  }
  out.push('## What happens', '');
  for (const rule of story.rules) {
    const when = rule.when ? `, ${condition(rule.when)}` : '';
    out.push(`- On ${onText(rule.on)}${when}${rule.once ? ', the first time' : ''}:`);
    for (const line of actions(rule.do, '  ')) out.push(line);
  }
  return `${out.join('\n')}\n`;
}

function condition(w: When): string {
  const parts: string[] = [];
  if (w.at) parts.push(`at \`${w.at}\``);
  if (w.from) parts.push(`from \`${w.from}\``);
  if (w.until) parts.push(`until \`${w.until}\``);
  if (w.flag) parts.push(`with \`${w.flag}\` set`);
  if (w.holding !== undefined) parts.push(w.holding === null ? 'bare-handed' : `holding the ${w.holding}`);
  if (w.not) parts.push(`not ${condition(w.not)}`);
  return parts.length ? parts.join(', ') : 'otherwise';
}

function button(o: Option): string {
  const extra = [o.reply && `→ \`${o.reply}\``, o.tag, o.when && condition(o.when)].filter(Boolean).join(', ');
  return `[${o.label}${extra ? ` (${extra})` : ''}]`;
}

function triggerText(t: NonNullable<QuestStep['reachedBy']>): string {
  switch (t.type) {
    case 'talk': return `talk to \`${t.npcKind}\``;
    case 'reply': return `reply \`${t.id}\` to \`${t.npcKind}\``;
    case 'enter': return `enter \`${t.levelId}\``;
    case 'kill': return `kill a \`${t.enemyKind}\``;
    case 'defeat': return `defeat \`${t.tag}\``;
    case 'use': return `use \`${t.id}\``;
    case 'arm': return `get the \`${t.weapon}\` in hand`;
  }
}

function onText(on: Trigger): string {
  if ('reached' in on) return `reaching \`${on.reached}\``;
  if ('enter' in on) return `entering \`${on.enter}\``;
  if ('near' in on) return `coming near \`${on.near}\`${on.within ? ` (within ${on.within})` : ''}`;
  if ('read' in on) return `using \`${on.read}\``;
  if ('bought' in on) return `buying service ${on.bought.service} from \`${on.bought.from}\``;
  if ('lockedDoor' in on) return 'walking into a locked door';
  if ('alarm' in on) return 'the alarm';
  if ('fell' in on) return 'going down';
  return 'starting the game';
}

function actions(list: readonly Action[], indent: string): string[] {
  return list.flatMap((a): string[] => {
    if ('say' in a) return [`${indent}- **${a.by}:** ${a.say}`];
    if ('think' in a) return [`${indent}- *${a.think}*`];
    if ('show' in a) {
      const shown = 'thing' in a.show
        ? [`${indent}- shows \`${a.show.thing}\`${a.show.button ? ` [${a.show.button}]` : ''}`]
        : [`${indent}- shows **${a.show.title}**:`, ...a.show.pages.map((p) => `${indent}  > ${p.text} ${p.options.map(button).join(' ')}`)];
      return [...shown, ...(a.then?.length ? [`${indent}  then:`, ...actions(a.then, `${indent}  `)] : [])];
    }
    return [`${indent}- ${actionText(a)}`];
  });
}

function actionText(a: Action): string {
  if ('flag' in a) return `sets \`${a.flag}\``;
  if ('unflag' in a) return `clears \`${a.unflag}\``;
  if ('talk' in a) return `opens what \`${a.talk}\` says`;
  if ('use' in a) return `uses \`${a.use}\``;
  if ('banner' in a) return `banner: ${a.banner}${a.subtitle ? ` / ${a.subtitle}` : ''}${a.delay ? ` (after ${a.delay} s)` : ''}`;
  if ('sound' in a) return `sound \`${a.sound}\``;
  if ('reply' in a) return `replies \`${a.reply}\` to \`${a.to}\``;
  if ('useSkill' in a) return `uses the skill \`${a.useSkill}\``;
  if ('cinematic' in a) return a.cinematic ? 'the picture goes cinematic' : 'the picture comes back';
  if ('cut' in a) return `the camera cuts to ${a.cut.x}, ${a.cut.y}${a.closeness ? `, ${a.closeness} close` : ''}`;
  if ('fade' in a) return a.fade === 'out' ? 'fades to black' : 'fades up from black';
  if ('wait' in a) return `waits ${a.wait} s`;
  if ('waitForLines' in a) return 'waits until the lines are read';
  if ('waitUntilIn' in a) return `waits until the hero is in \`${a.waitUntilIn}\``;
  if ('run' in a) return `the game's own \`${a.run}\``;
  return JSON.stringify(a);
}
