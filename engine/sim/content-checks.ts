import type { Vec2 } from '../core/math';
import type { Level } from '../world/level';
import { inBounds, tileIndex, type TileMap } from '../world/tile-map';
import type { GameContent, LevelContent } from './content';

/**
 * Mistakes in a game's content that the rules would only show in play: a portal to a level that doesn't exist, an
 * enemy kind with no numbers, a spawn inside a wall or cut off from where the hero starts, a quest step nothing can
 * reach. Returns one message per problem, empty when the content is sound. Every game's tests should run it.
 */
export function checkContent(content: GameContent): string[] {
  const problems: string[] = [];
  const levels = new Map(content.levels.map((l) => [l.level.id, l]));
  if (levels.size !== content.levels.length) problems.push('two levels share an id');
  if (!levels.has(content.startLevel)) problems.push(`the start level "${content.startLevel}" doesn't exist`);
  for (const lc of content.levels) problems.push(...checkLevel(lc, content, levels).map((p) => `${lc.level.id}: ${p}`));
  problems.push(...unreachableLevels(content, levels));
  problems.push(...checkQuest(content, levels));
  const skillIds = content.hero.skills.map((s) => s.id);
  if (new Set(skillIds).size !== skillIds.length) problems.push('two hero skills share an id');
  for (const [kind, type] of Object.entries(content.enemies)) {
    if (type.summon && !content.enemies[type.summon.kind]) problems.push(`enemy "${kind}" summons unknown kind "${type.summon.kind}"`);
  }
  return problems;
}

function checkLevel(lc: LevelContent, content: GameContent, levels: Map<string, LevelContent>): string[] {
  const { level } = lc;
  const { map } = level;
  const problems: string[] = [];
  const reached = reachableFrom(map, level.start);
  const tileOf = (p: Vec2): [number, number] => [Math.floor(p.x), Math.floor(p.y)];
  const where = (tx: number, ty: number) => `(${tx}, ${ty})`;
  /** A spot the hero must be able to stand on and walk to from the level's start. */
  const mustReach = (what: string, tx: number, ty: number): void => {
    if (!inBounds(map, tx, ty)) problems.push(`${what} at ${where(tx, ty)} is off the map`);
    else if (map.solid[tileIndex(map, tx, ty)]) problems.push(`${what} at ${where(tx, ty)} is inside something solid`);
    else if (!reached[tileIndex(map, tx, ty)]) problems.push(`${what} at ${where(tx, ty)} can't be reached from the start`);
  };
  /** Containers and readables are used from the tile in front of them (below on the map), so it must be reachable. */
  const mustUse = (what: string, use: string, tx: number, ty: number): void => {
    const front = inBounds(map, tx, ty + 1) && reached[tileIndex(map, tx, ty + 1)];
    if (!front) problems.push(`${what} at ${where(tx, ty)} can't be ${use}: the tile in front of it can't be reached from the start`);
  };

  mustReach('the start', ...tileOf(level.start));
  for (const p of level.portals) {
    mustReach(`the portal to "${p.to}"`, p.tx, p.ty);
    const destination = levels.get(p.to);
    if (!destination) {
      problems.push(`the portal at ${where(p.tx, p.ty)} leads to "${p.to}", which doesn't exist`);
      continue;
    }
    if (!destination.level.portals.some((back) => back.to === level.id)) {
      problems.push(`"${p.to}" has no portal back, so arriving from here puts the hero at its start`);
    }
    const [ax, ay] = tileOf({ x: p.tx + 0.5 + p.stepOut.x, y: p.ty + 0.5 + p.stepOut.y });
    mustReach(`arriving through the portal to "${p.to}"`, ax, ay);
  }
  for (const s of lc.spawns) {
    if (!content.enemies[s.kind]) problems.push(`a spawn uses unknown enemy kind "${s.kind}"`);
    mustReach(`the ${s.kind} spawn`, ...tileOf(s));
  }
  for (const c of lc.camps) {
    if (!content.enemies[c.kind]) problems.push(`a camp uses unknown enemy kind "${c.kind}"`);
    if (!campHasRoom(map, reached, c.tx, c.ty)) problems.push(`the ${c.kind} camp at ${where(c.tx, c.ty)} has no open ground around it that can be reached from the start`);
  }
  for (const kind of lc.campRespawns?.kinds ?? []) {
    if (!content.enemies[kind]) problems.push(`camps respawn unknown enemy kind "${kind}"`);
  }
  for (const n of lc.npcs) {
    if (!content.npcs[n.kind]) problems.push(`NPC "${n.name}" has unknown kind "${n.kind}"`);
    mustReach(`NPC "${n.name}"`, ...tileOf(n));
  }
  for (const c of lc.containers ?? []) mustUse('a container', 'opened', c.tx, c.ty);
  for (const r of lc.readables ?? []) mustUse(`"${r.id}"`, 'read', r.tx, r.ty);
  for (const s of level.structures) mustReach(`the door of "${s.name}"`, s.door.tx, s.door.ty);
  return problems;
}

/**
 * Whether a camp has reachable open ground where its enemies scatter: around its centre, which may be solid (a fire),
 * matching `spawnCamp`.
 */
function campHasRoom(map: TileMap, reached: Uint8Array, tx: number, ty: number): boolean {
  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      const d = Math.hypot(x - tx, y - ty);
      if (d > 1.1 && inBounds(map, x, y) && reached[tileIndex(map, x, y)]) return true;
    }
  }
  return false;
}

/** Open tiles reachable from `start`, moving between tiles that share an edge. */
function reachableFrom(map: TileMap, start: Vec2): Uint8Array {
  const reached = new Uint8Array(map.width * map.height);
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (!inBounds(map, sx, sy) || map.solid[tileIndex(map, sx, sy)]) return reached;
  const queue = [tileIndex(map, sx, sy)];
  reached[queue[0]!] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % map.width;
    const y = (i - x) / map.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const n = tileIndex(map, nx, ny);
      if (reached[n] || map.solid[n]) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }
  return reached;
}

/** Levels no chain of portals leads to from the start level. */
function unreachableLevels(content: GameContent, levels: Map<string, LevelContent>): string[] {
  const seen = new Set([content.startLevel]);
  const queue = [content.startLevel];
  while (queue.length) {
    const level: Level | undefined = levels.get(queue.pop()!)?.level;
    for (const p of level?.portals ?? []) {
      if (seen.has(p.to)) continue;
      seen.add(p.to);
      queue.push(p.to);
    }
  }
  return [...levels.keys()].filter((id) => !seen.has(id)).map((id) => `no portal leads to level "${id}"`);
}

function checkQuest(content: GameContent, levels: Map<string, LevelContent>): string[] {
  const npcKinds = new Set(content.levels.flatMap((l) => l.npcs.map((n) => n.kind)));
  const enemyKinds = new Set(content.levels.flatMap((l) => [
    ...l.spawns.map((s) => s.kind), ...l.camps.map((c) => c.kind), ...(l.campRespawns?.kinds ?? []),
  ]));
  for (const type of Object.values(content.enemies)) if (type.summon) enemyKinds.add(type.summon.kind);
  return content.quest.flatMap((step, i) => {
    const trigger = step.reachedBy;
    if (!trigger) return [];
    if (trigger.type === 'talk' && !npcKinds.has(trigger.npcKind)) return [`quest step ${i} needs talking to "${trigger.npcKind}", who isn't in any level`];
    if (trigger.type === 'enter' && !levels.has(trigger.levelId)) return [`quest step ${i} needs entering "${trigger.levelId}", which doesn't exist`];
    if (trigger.type === 'kill' && !enemyKinds.has(trigger.enemyKind)) return [`quest step ${i} needs killing a "${trigger.enemyKind}", which never appears`];
    return [];
  });
}
