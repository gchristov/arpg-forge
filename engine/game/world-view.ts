import { lerp } from '../core/math';
import type { Look } from '../render/look';
import type { SceneRenderer } from '../render/scene-renderer';
import { currentLevel, type Actor, type GameState, type SimEvent } from '../sim/state';
import type { ScreenFade } from '../ui/fade';
import type { Project, WorldLabels } from '../ui/world-labels';

/** One screen pixel at zoom 1, in tiles. Heights of labels and taps are measured in these. */
export const PX = 1 / 39.2;
const HIT_FLASH_SECONDS = 0.12;
const HERO_FLASH_SECONDS = 0.15;
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
    for (const e of ls.enemies) {
      if (!e.dead && state.rules.enemies[e.kind]?.boss) {
        renderer.glow(lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha), 2.2, look.effects.bossLight, 0.6);
      }
    }
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
