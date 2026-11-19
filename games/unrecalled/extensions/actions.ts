/** Unrecalled's own story actions, by name: used from its rules and scenes as `{ run: name }`, done in `main.ts`. */
export const GAME_ACTIONS = ['withholdEmp', 'showEmp', 'assemblyWakes', 'endCard'] as const;

export type GameAction = (typeof GAME_ACTIONS)[number];
