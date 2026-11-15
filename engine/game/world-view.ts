import { lerp } from '../core/math';
import type { ScanView } from '../render/effects';
import type { Look } from '../render/look';
import type { SceneRenderer } from '../render/scene-renderer';
import { currentLevel, type Actor, type GameState, type SimEvent } from '../sim/state';
import type { ScreenFade } from '../ui/fade';
import type { Project, WorldLabels } from '../ui/world-labels';

/** One screen pixel at zoom 1, in tiles. Heights of labels and taps are measured in these. */
export const PX = 1 / 39.2;
const HIT_FLASH_SECONDS = 0.12;
const HERO_FLASH_SECONDS = 0.15;
/** Lightning: where a burst's arcs start and where they reach an enemy, in tiles above the ground. */
const BURST_HEIGHT = 0.6;
const BODY_HEIGHT = 0.5;
/** How many main bolts a burst grows, at least and at most, and how many levels of branches they sprout. */
const BURST_BOLTS = [3, 5] as const;
const BRANCH_DEPTH = 2;
/** Skill projectiles fly at this height, and throw off an arc on about this share of frames. */
const PROJECTILE_HEIGHT = 0.52;
const CRACKLE_CHANCE = 0.75;
/** Each chimney puffs this often. */
const SMOKE_SECONDS = 1.6;

/**
 * Draws the game state each frame and shows the rules' events in the world: actors and their animations, health
 * bars, lights, projectiles, markers, hit flashes, screen shake, explosions and moving between levels. Everything a
 * game names or words, such as sounds, text and its HUD, is left to the game.
 */
export class WorldView {
  /** Seconds left of each actor's hit flash, by id. */
  private readonly flashes = new Map<number, number>();
  /** Enemies seen winding up an attack, so each wind-up starts its attack animation once. */
  private readonly windingUp = new Set<number>();
  private nextSmokeAt = 0;
  private stepSeconds = 1 / 60;
  /** Reused each frame for the machines scanning the hero. */
  private readonly scans: ScanView[] = Array.from({ length: 6 }, () => ({
    fromX: 0, fromY: 0, fromHeight: 0, x: 0, y: 0, height: 0, radius: 0, progress: 0,
  }));

  constructor(
    private readonly state: GameState,
    private readonly renderer: SceneRenderer,
    private readonly look: Look,
    private readonly labels: WorldLabels,
    private readonly fade: ScreenFade,
    private readonly project: Project,
  ) {}

  /** Body size of an actor kind relative to an ordinary one. */
  scaleOf(kind: string): number {
    return this.look.actor(kind).scale ?? 1;
  }

  /** Shows the current level from scratch, for the start and after moving between levels. */
  showCurrentLevel(): void {
    const { renderer, state } = this;
    renderer.showLevel(currentLevel(state).level);
    renderer.clearActors();
    renderer.effects.clearDecals();
    renderer.follow(state.hero.x, state.hero.y, 0, true);
  }

  react(events: SimEvent[]): void {
    const { renderer, state, look } = this;
    const { effects } = look;
    for (const e of events) {
      switch (e.type) {
        case 'WalkTargetSet':
          renderer.showMarker(e.x, e.y, effects.walkMarker);
          break;
        case 'TargetSet':
          renderer.showMarker(e.x, e.y, effects.targetMarker);
          break;
        case 'TransitionStarted':
          this.fade.toBlack();
          break;
        case 'EnteredLevel':
          this.showCurrentLevel();
          this.fade.fromBlack();
          break;
        case 'Swung':
          if (e.actorId === state.hero.id) renderer.playActor(String(e.actorId), 'attack', state.rules.hero.melee.swingSeconds * 1.6);
          break;
        case 'SkillUsed':
          renderer.playActor(String(state.hero.id), 'cast', 0.45);
          break;
        case 'EnemyDamaged':
          renderer.playActor(String(e.enemyId), 'hit');
          this.flashes.set(e.enemyId, HIT_FLASH_SECONDS);
          renderer.shake(e.crit ? 0.18 : 0.08);
          break;
        case 'HeroHurt':
          renderer.playActor(String(state.hero.id), 'hit');
          this.flashes.set(state.hero.id, HERO_FLASH_SECONDS);
          renderer.shake(0.25);
          break;
        case 'EnemyKilled': {
          const remains = look.actor(e.kind).remains;
          if (remains) renderer.effects.decal(e.x, e.y, remains.radius, remains.colour, remains.opacity, 40);
          break;
        }
        case 'Exploded':
          renderer.effects.decal(e.x, e.y, 0.8, effects.explosion.scorch, 0.7, 12);
          renderer.effects.flash(e.x, e.y, e.radius, effects.explosion.flash, 0.35);
          renderer.shake(0.22);
          if (effects.lightning !== undefined) this.lightningBurst(e.x, e.y, e.radius, events, effects.lightning);
          break;
        case 'SlamWarned':
          renderer.playActor(String(e.enemyId), 'cast', 1.0);
          break;
        case 'SlamLanded':
          renderer.effects.decal(e.x, e.y, e.radius, effects.slam.scorch, 0.7, 8);
          renderer.effects.flash(e.x, e.y, e.radius, effects.slam.flash, 0.5);
          renderer.shake(0.45);
          break;
      }
    }
  }

  /**
   * Places everything for a frame, `alpha` of the way from the previous step's state to the latest. `stepSeconds` is
   * the length of a rules step, to tell how fast each actor moved in the last one.
   */
  draw(alpha: number, frameSeconds: number, stepSeconds: number): void {
    const { renderer, state, labels, look } = this;
    this.puffChimneys();
    this.animateWindUps();
    for (const [id, left] of this.flashes) {
      if (left - frameSeconds <= 0) this.flashes.delete(id);
      else this.flashes.set(id, left - frameSeconds);
    }
    const ls = currentLevel(state);
    this.stepSeconds = stepSeconds;
    this.drawActor(state.hero, alpha);
    for (const n of ls.npcs) this.drawActor(n, alpha);
    labels.beginBars();
    for (const e of ls.enemies) {
      this.drawActor(e, alpha, e.dead ? Math.max(0, 1 - e.deadFor) : 1);
      const scale = this.scaleOf(e.kind);
      if (!e.dead && !state.rules.enemies[e.kind]?.boss && (e.hp < e.maxHp || e.id === state.hero.targetId)) {
        const x = lerp(e.prevX, e.x, alpha);
        const y = lerp(e.prevY, e.y, alpha);
        labels.bar(this.project, x, y, (44 * scale + 6) * PX, e.hp / e.maxHp, 28 * Math.max(1, scale * 0.8) * renderer.zoom);
      }
    }
    labels.endBars();
    for (const p of state.projectiles) {
      if (p.kind === 'skill') renderer.glow(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha), 2.6, look.effects.skillLight, 0.9);
    }
    for (const t of state.telegraphs) renderer.glow(t.x, t.y, t.radius + 0.6, look.effects.telegraphLight, 0.6);
    const { sealedLight } = look.effects;
    if (sealedLight !== undefined && ls.enemies.some((e) => !e.dead)) {
      for (const p of ls.level.portals) if (p.sealed) renderer.glow(p.tx + 0.5, p.ty + 0.5, 2.4, sealedLight, 1);
    }
    for (const e of ls.enemies) {
      if (!e.dead && state.rules.enemies[e.kind]?.boss) {
        renderer.glow(lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha), 2.2, look.effects.bossLight, 0.6);
      }
    }
    renderer.setAlarmed(ls.alarmed);
    this.showScans(alpha);
    if (look.effects.lightning !== undefined) this.crackleProjectiles(alpha, look.effects.lightning);
    renderer.effects.showProjectiles(state.projectiles, alpha);
    renderer.effects.showTelegraphs(state.telegraphs);
    renderer.effects.showItems(ls.items, performance.now() / 1000);
  }

  private drawActor(actor: Actor & { dead?: boolean }, alpha: number, fade = 1): void {
    const x = lerp(actor.prevX, actor.x, alpha);
    const y = lerp(actor.prevY, actor.y, alpha);
    // How fast it actually moved in the last step: wandering, backing away and chasing all differ.
    const speed = Math.hypot(actor.x - actor.prevX, actor.y - actor.prevY) / this.stepSeconds;
    this.renderer.setActor(
      String(actor.id), actor.kind, x, y, actor.facingX, actor.facingY,
      { moving: actor.moving, dead: Boolean(actor.dead), flash: (this.flashes.get(actor.id) ?? 0) > 0 ? 1 : 0, fade, speed },
    );
    const light = this.look.actor(actor.kind).light;
    if (light && fade > 0) this.renderer.glow(x, y, light.radius, light.colour, light.intensity * fade);
  }

  /** Beams from machines looking the hero over, for enemies whose look has a scanner. */
  private showScans(alpha: number): void {
    const { state, look } = this;
    const hero = look.actor(state.hero.kind);
    let count = 0;
    for (const e of currentLevel(state).enemies) {
      const scanner = look.actor(e.kind).scanner;
      if (e.scan < 0 || e.dead || !scanner || count >= this.scans.length) continue;
      const s = this.scans[count++]!;
      s.fromX = lerp(e.prevX, e.x, alpha);
      s.fromY = lerp(e.prevY, e.y, alpha);
      s.fromHeight = scanner.eyeHeight;
      s.x = lerp(state.hero.prevX, state.hero.x, alpha);
      s.y = lerp(state.hero.prevY, state.hero.y, alpha);
      s.height = hero.height;
      s.radius = hero.radius * 1.3;
      s.progress = e.scan;
    }
    this.renderer.effects.showScans(this.scans, count);
  }

  /**
   * Lightning from a burst: strikes on every enemy it hurt, sometimes flickering back; arcs jumping between enemies
   * hit together; and a few branching bolts reaching through the dome of its flash. Timings and shapes are random, so no two bursts
   * look alike.
   */
  private lightningBurst(x: number, y: number, radius: number, events: SimEvent[], colour: number): void {
    const { effects } = this.renderer;
    const hits: Array<{ x: number; y: number; h: number }> = [];
    for (const hit of events) {
      if (hit.type !== 'EnemyDamaged' || Math.hypot(hit.x - x, hit.y - y) > radius + 1.5) continue;
      const kind = currentLevel(this.state).enemies.find((en) => en.id === hit.enemyId)?.kind ?? '';
      hits.push({ x: hit.x, y: hit.y, h: BODY_HEIGHT * this.scaleOf(kind) });
    }
    for (const hit of hits) {
      const strikes = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < strikes; k++) {
        effects.arc(x, y, BURST_HEIGHT, hit.x, hit.y, hit.h, colour, 0.12 + Math.random() * 0.12, k * (0.06 + Math.random() * 0.08));
      }
    }
    for (let k = 1; k < hits.length; k++) {
      const a = hits[k - 1]!;
      const b = hits[k]!;
      if (Math.random() < 0.4) effects.arc(a.x, a.y, a.h, b.x, b.y, b.h, colour, 0.15 + Math.random() * 0.1, 0.05 + Math.random() * 0.15);
    }
    const bolts = BURST_BOLTS[0] + Math.floor(Math.random() * (BURST_BOLTS[1] - BURST_BOLTS[0] + 1));
    for (let k = 0; k < bolts; k++) {
      // Up and out from the middle of the burst, at any angle around it.
      const around = Math.random() * Math.PI * 2;
      const up = 0.15 + Math.random() * 0.9;
      const dome = { x, y, h: BURST_HEIGHT, radius };
      this.branch(dome, x, y, BURST_HEIGHT, Math.cos(around) * Math.cos(up), Math.sin(around) * Math.cos(up), Math.sin(up),
        radius * (0.55 + Math.random() * 0.35), 1, 0, Math.random() * 0.12, colour);
    }
  }

  /**
   * One stroke of branching lightning, heading along (dx, dy, dh) from a point, kept inside the burst's dome and above
   * the ground. Strokes sprout thinner, shorter branches partway along, like real lightning.
   */
  private branch(
    dome: { x: number; y: number; h: number; radius: number },
    x: number, y: number, h: number, dx: number, dy: number, dh: number,
    length: number, width: number, depth: number, delay: number, colour: number,
  ): void {
    let ex = x + dx * length;
    let ey = y + dy * length;
    let eh = Math.max(0.05, h + dh * length);
    const reach = Math.hypot(ex - dome.x, ey - dome.y, eh - dome.h);
    if (reach > dome.radius * 0.95) {
      const pull = (dome.radius * 0.95) / reach;
      ex = dome.x + (ex - dome.x) * pull;
      ey = dome.y + (ey - dome.y) * pull;
      eh = Math.max(0.05, dome.h + (eh - dome.h) * pull);
    }
    const life = 0.18 + Math.random() * 0.16;
    this.renderer.effects.arc(x, y, h, ex, ey, eh, colour, life, delay, width);
    if (depth >= BRANCH_DEPTH) return;
    const children = depth === 0 ? 1 + Math.floor(Math.random() * 2) : Math.random() < 0.5 ? 1 : 0;
    for (let k = 0; k < children; k++) {
      const t = 0.3 + Math.random() * 0.55;
      // Off at an angle from the parent, then renormalised.
      let cx = dx + (Math.random() - 0.5) * 1.6;
      let cy = dy + (Math.random() - 0.5) * 1.6;
      let ch = dh + (Math.random() - 0.3) * 0.8;
      const n = Math.hypot(cx, cy, ch) || 1;
      cx /= n;
      cy /= n;
      ch /= n;
      this.branch(dome, x + (ex - x) * t, y + (ey - y) * t, h + (eh - h) * t, cx, cy, ch,
        length * (0.4 + Math.random() * 0.25), width * 0.6, depth + 1, delay + t * 0.04, colour);
    }
  }

  /** Skill projectiles crackle with short arcs of every length as they fly. */
  private crackleProjectiles(alpha: number, colour: number): void {
    for (const p of this.state.projectiles) {
      if (p.kind !== 'skill') continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      for (let k = 0; k < 2; k++) {
        if (Math.random() > CRACKLE_CHANCE) continue;
        const angle = Math.random() * Math.PI * 2;
        const reach = 0.25 + Math.random() * 0.6;
        this.renderer.effects.arc(
          x, y, PROJECTILE_HEIGHT, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach,
          PROJECTILE_HEIGHT + (Math.random() - 0.5) * 0.6, colour, 0.05 + Math.random() * 0.07,
        );
      }
    }
  }

  /** Starts an enemy's attack animation as its wind-up begins, timed so the blow lands as the attack does. */
  private animateWindUps(): void {
    const { state } = this;
    for (const e of currentLevel(state).enemies) {
      if (e.windUp >= 0 && !this.windingUp.has(e.id)) {
        this.windingUp.add(e.id);
        this.renderer.playActor(String(e.id), 'attack', (state.rules.enemies[e.kind]?.windUp ?? 0.4) * 1.8);
      } else if (e.windUp < 0) this.windingUp.delete(e.id);
    }
  }

  /** Smoke drifts from each chimney. */
  private puffChimneys(): void {
    const { state } = this;
    if (state.time < this.nextSmokeAt) return;
    this.nextSmokeAt = state.time + SMOKE_SECONDS;
    for (const s of currentLevel(state).level.structures) {
      if (!s.chimney) continue;
      const look = this.look.structure(s.kind);
      const height = look.wallHeight + look.roofHeight + 22 * PX;
      const vx = (0.05 + Math.random() * 0.2) * 0.7;
      const vy = -(0.05 + Math.random() * 0.2) * 0.7;
      this.renderer.effects.smoke(s.chimney.tx + 0.5, s.chimney.ty + 0.5, height, vx, vy, (10 + Math.random() * 8) * PX, this.look.effects.smoke, 3.5);
    }
  }
}
