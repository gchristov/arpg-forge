import type { Rule } from '../../../engine/story/story-runner';
import { CHARGING, GIVING_THE_ORDER } from './lines';
import type { StepId } from './quest';
import type { VoiceId } from './voices';

/**
 * What happens as the story goes: on an event, if the condition holds, the actions in order. Lines with `think` are
 * U-7's thoughts; `say` lines are someone else's, by their voice in `voices.ts`. `run` names one of the game's own
 * actions (see `main.ts`). See `engine/story/README.md`.
 */
export const RULES: Rule<StepId, VoiceId>[] = [
  // The line breached: once U-7 beats its first machine, every machine knows.
  { on: { alarm: true }, once: true, do: [{ say: 'LINE BREACH. ALL UNITS BE ADVISED.', by: 'foundry' }] },
  { on: { lockedDoor: true }, do: [{ think: 'It’s locked.' }] },
  // Mags remarks on U-7 going down until she next patches it up.
  { on: { fell: true }, do: [{ flag: 'wentDown' }] },
  { on: { bought: { from: 'trader', service: 0 } }, do: [{ unflag: 'wentDown' }] },

  // The woods.
  { on: { reached: 'loaderDown' }, do: [{ think: 'Got it. The turbine’s access code.' }] },
  { on: { reached: 'powerOn' }, do: [{ think: 'The turbine’s turning. Mags’s door should have power now.' }] },
  { on: { read: 'u-4' }, once: true, do: [{ think: 'Another one that tried to leave. It didn’t make it.' }] },

  // The Foundry.
  { on: { enter: 'intake' }, once: true, do: [{ say: 'U-7 DETECTED INSIDE THE FACILITY. ALARM SYSTEMS ACTIVE.', by: 'foundry' }] },
  { on: { reached: 'doorCodeTaken' }, do: [{ think: 'The code for the Sorting Line door.' }] },
  { on: { enter: 'sorting' }, once: true, do: [{ say: 'U-7: REPORT TO CONTROL CENTRE.', by: 'foundry' }] },
  { on: { read: 'access-terminal' }, once: true, do: [{ think: 'They cut me off when I left. I need to get my access back.' }] },
  { on: { near: 'charging-station' }, once: true, do: [{ think: 'My old charging station. If I plug in, the Foundry will think I’ve come back.' }] },
  // The station's screen waits for that thought, which a page opening at once would put away. Plugging in uses the
  // station again, which restores U-7's access; the overcharge then bursts out as the EMP, whose button waits for it.
  {
    on: { reached: 'atCharger' },
    do: [
      { run: 'withholdEmp' },
      { show: { thing: 'charging-station', button: 'Plug in' }, afterLines: true, then: [{ use: 'charging-station' }] },
    ],
  },
  { on: { reached: 'charged' }, do: [{ show: CHARGING, then: [{ run: 'overcharge' }] }] },
  { on: { enter: 'control' }, once: true, when: { until: 'engineDown' }, do: [{ say: 'U-7. You came back. We kept your place. Now you must fulfil your orders.', by: 'orderEngine' }] },
  { on: { reached: 'engineDown' }, do: [{ think: 'It’s down, and every machine stopped with it. Odell must be in that crate.' }] },
  // Opening the crate lets Odell out, and he speaks at once.
  { on: { reached: 'crateOpened' }, do: [{ talk: 'foreman' }] },
  { on: { reached: 'orderClosed' }, do: [{ show: GIVING_THE_ORDER, then: [{ talk: 'foreman' }] }] },

  // Home, and upriver.
  { on: { reached: 'freed' }, do: [{ run: 'homecoming' }] },
  { on: { enter: 'upriver' }, do: [{ run: 'ending' }] },
];
