// The shadow creatures: what they are, how they move, how they die.
// Enemies crawl in from the dark edge of the clearing and walk at the
// hearth; inside the light they burn and slow, outside it they are fast
// and bold. The Long Dark is the night-7 boss: it snuffs braziers and
// calls shades to its side.
import { ENEMY_TYPES, HEARTH_X, HEARTH_Y, VIEW_H, VIEW_W } from './config.js';

export function spawnPoint(rng) {
  // Any point on the dark rim, just outside the clearing.
  const side = rng.int(0, 3);
  const m = 30;
  if (side === 0) return { x: rng.range(m, VIEW_W - m), y: -m };
  if (side === 1) return { x: VIEW_W + m, y: rng.range(m, VIEW_H - m) };
  if (side === 2) return { x: rng.range(m, VIEW_W - m), y: VIEW_H + m };
  return { x: -m, y: rng.range(m, VIEW_H - m) };
}

export function createEnemy(kind, x, y, night) {
  const t = ENEMY_TYPES[kind];
  const scale = 1 + (night - 1) * 0.07;
  return {
    kind,
    name: t.name,
    x,
    y,
    hp: t.hp * scale,
    maxHp: t.hp * scale,
    speed: t.speed * (1 + (night - 1) * 0.03),
    radius: t.radius,
    damage: t.damage,
    score: t.score,
    wood: t.wood,
    oil: t.oil,
    color: t.color,
    wobble: 0,
    wobbleSpeed: 2 + night * 0.1,
    burn: 0,
    hitFlash: 0,
    touchCooldown: 0,
    summonCooldown: kind === 'longdark' ? 6 : 0,
  };
}

// Pick the next kind for a night's spawn queue from the night's mix.
export function pickKindForNight(plan, rng) {
  const entries = Object.entries(plan.mix);
  let roll = rng.next();
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return entries[0][0];
}

// One fixed step of one enemy. Returns 'hearth' when it reaches the fire.
export function updateEnemy(e, world, dt) {
  e.wobble += dt * e.wobbleSpeed;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.touchCooldown > 0) e.touchCooldown -= dt;

  // Burning in the light: the dark cannot stand the fire.
  const distHearth = Math.hypot(e.x - HEARTH_X, e.y - HEARTH_Y);
  const inLight = distHearth < world.lightRadius;
  if (inLight) {
    e.burn += dt;
    e.hp -= 14 * dt;
  }
  const speedMult = inLight ? 0.62 : 1;

  // Wisps weave; the rest shamble straight at the hearth.
  const dx = HEARTH_X - e.x;
  const dy = HEARTH_Y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let vx = dx / d;
  let vy = dy / d;
  if (e.kind === 'wisp') {
    const perp = Math.sin(e.wobble * 2.2) * 0.7;
    vx += -vy * perp;
    vy += vx * perp * 0.3;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;
  }
  e.x += vx * e.speed * speedMult * dt;
  e.y += vy * e.speed * speedMult * dt;

  // The boss snuffs braziers it passes and calls shades.
  if (e.kind === 'longdark') {
    e.summonCooldown -= dt;
    for (const b of world.braziers) {
      if (b.lit && Math.hypot(b.x - e.x, b.y - e.y) < 70) b.lit = false;
    }
  }

  if (distHearth < e.radius + 26) return 'hearth';
  return null;
}
