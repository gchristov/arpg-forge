import type { Rule } from '../../../engine/story/story-runner';
import type { StepId } from './quest';

/** What happens as the story goes: on an event, if the condition holds, the actions in order. See `engine/story/README.md`. */
export const RULES: Rule<StepId>[] = [
  {
    on: { reached: 'bossDefeated' },
    do: [{ sound: 'level' }, { banner: 'The Bone Lord is destroyed', subtitle: 'Ashen Hollow is safe. The wilds still stir.', seconds: 4.5, delay: 0.6 }],
  },
];
