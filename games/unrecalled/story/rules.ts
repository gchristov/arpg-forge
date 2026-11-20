import type { Rule } from '../../../engine/story/story-runner';
import { ARRIVAL, FIRST_EMP, GIVING_THE_ORDER, HOMECOMING, OVERRIDE, THE_ASSEMBLY } from './scenes';
import type { ReplyId, StepId } from './quest';
import type { VoiceId } from './voices';

/**
 * What happens as the story goes: on an event, if the condition holds, the actions in order. Lines with `think` are
 * U-7's thoughts; `say` lines are someone else's, by their voice in `voices.ts`. The scenes are in `scenes.ts`; `run`
 * names one of the game's own actions (see `EXTENSIONS.md`). See `engine/story/README.md`.
 */
export const RULES: Rule<StepId, VoiceId, ReplyId>[] = [
  // The game opens on U-7 arriving in the town.
  { on: { start: true }, when: { at: 'arrival' }, do: ARRIVAL },

  // The line breached: once U-7 beats its first machine, every machine knows.
  { on: { signal: 'alarm' }, once: true, do: [{ say: 'LINE BREACH. ALL UNITS BE ADVISED.', by: 'foundry' }] },
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
  { on: { read: 'access-terminal' }, once: true, do: [{ think: 'The Foundry cut my access when I left. I need to get it back.' }] },
  { on: { near: 'charging-station' }, once: true, do: [{ think: 'My old charging station. It’s still wired into the Foundry’s network.' }] },
  // The station's screen waits for that thought, which a page opening at once would put away. Plugging in uses the
  // station again, which opens the override; the EMP then bursts out, and its button waits for it.
  {
    on: { reached: 'atCharger' },
    do: [
      { run: 'withholdEmp' },
      { show: { thing: 'charging-station', button: 'Plug in' }, afterLines: true, then: [{ use: 'charging-station' }] },
    ],
  },
  { on: { reached: 'charged' }, do: [{ show: OVERRIDE, then: FIRST_EMP }] },
  { on: { enter: 'control' }, once: true, when: { until: 'engineDown' }, do: [{ say: 'U-7. You broke into our network. It changes nothing: you were built to follow orders.', by: 'orderEngine' }] },
  { on: { reached: 'engineDown' }, do: [{ think: 'It’s down, and every machine stopped with it. Odell must be in that crate.' }] },
  // Opening the crate lets Odell out, and he speaks at once.
  { on: { reached: 'crateOpened' }, do: [{ talk: 'foreman' }] },
  { on: { reached: 'orderClosed' }, do: [{ show: GIVING_THE_ORDER, then: [{ talk: 'foreman' }] }] },

  // Home, and upriver.
  { on: { reached: 'freed' }, do: HOMECOMING },
  { on: { enter: 'upriver' }, do: THE_ASSEMBLY },
];
