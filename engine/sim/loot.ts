import { dist } from '../core/math';
import { chance, int, range } from '../core/rng';
import { isSolidAt } from '../world/tile-map';
import { currentLevel, type GameState, type GroundItem, type LevelState, type SimEvent } from './state';
import { arm } from './weapons';

/** Dropped items pop up and fall back down; heights and speeds are in tiles. */
const DROP_HEIGHT = 10 / 39.2;
const DROP_LAUNCH = 60 / 39.2;
const GRAVITY = 260 / 39.2;
const PICKUP_RADIUS = 0.75;

/** Puts an item on the ground near a point, scattered 0.2 to 0.6 tiles, or on the point itself if that's a wall. */
export function dropItem(state: GameState, ls: LevelState, x: number, y: number, kind: GroundItem['kind'], amount: number, weapon?: string): void {
  const a = range(state.rng, 0, Math.PI * 2);
  const r = range(state.rng, 0.2, 0.6);
  let ix = x + Math.cos(a) * r;
  let iy = y + Math.sin(a) * r;
  if (isSolidAt(ls.level.map, ix, iy)) {
    ix = x;
    iy = y;
  }
  ls.items.push({ kind, amount, x: ix, y: iy, z: DROP_HEIGHT, vz: DROP_LAUNCH, ...(weapon ? { weapon } : {}) });
}

/** An enemy's drops: gold, maybe a healing item, and any extra healing items its type always drops. */
export function dropEnemyLoot(state: GameState, kind: string, x: number, y: number): void {
  const drops = state.rules.enemies[kind]!.drops;
  const ls = currentLevel(state);
  dropItem(state, ls, x, y, 'gold', int(state.rng, drops.gold[0], drops.gold[1]));
  if (chance(state.rng, drops.healingChance)) dropItem(state, ls, x, y, 'healingItem', 1);
  for (let i = 0; i < (drops.extraHealingItems ?? 0); i++) dropItem(state, ls, x + 0.4, y, 'healingItem', 1);
}

/** Items fall and land; landed items within reach are picked up, except healing items when the hero is full. A weapon goes into the hero's hand. */
export function updateItems(state: GameState, dt: number, events: SimEvent[]): void {
  const { hero } = state;
  const ls = currentLevel(state);
  for (let k = ls.items.length - 1; k >= 0; k--) {
    const item = ls.items[k]!;
    if (item.z > 0 || item.vz > 0) {
      item.vz -= GRAVITY * dt;
      item.z = Math.max(0, item.z + item.vz * dt);
      if (item.z === 0) item.vz = 0;
    }
    if (hero.dead || item.z !== 0 || dist(item.x, item.y, hero.x, hero.y) >= PICKUP_RADIUS) continue;
    if (item.kind === 'gold') hero.gold += item.amount;
    else if (item.kind === 'weapon') {
      // Arming can move the story on, which may change the level's items, so the item goes first.
      ls.items.splice(k, 1);
      events.push({ type: 'PickedUp', kind: item.kind, amount: item.amount, x: item.x, y: item.y, weapon: item.weapon! });
      arm(state, item.weapon!, item.x, item.y, events);
      continue;
    } else if (hero.healingItems >= state.rules.hero.heal.maxItems) continue;
    else hero.healingItems += item.amount;
    events.push({ type: 'PickedUp', kind: item.kind, amount: item.amount, x: item.x, y: item.y });
    ls.items.splice(k, 1);
  }
}
