// The hearth and its braziers: the light the whole game revolves around.
// The hearth burns down over a night; stoking feeds it wood and pushes the
// light back out. Braziers are lit with oil and scorch the dark all night.
import {
  BRAZIER_POSITIONS, HEARTH_BASE_LIGHT, HEARTH_BURN_PER_SEC, HEARTH_LIGHT_MAX,
  HEARTH_MAX_HP, STOKE_HEAL, STOKE_LIGHT,
} from './config.js';

export function createHearth() {
  return {
    hp: HEARTH_MAX_HP,
    maxHp: HEARTH_MAX_HP,
    light: HEARTH_BASE_LIGHT,
    lightBonus: 0,
    burnMult: 1,
    stokeBonus: 0,
  };
}

export function createBraziers() {
  return BRAZIER_POSITIONS.map((p) => ({ x: p.x, y: p.y, lit: false, flicker: 0 }));
}

// The light radius right now: base + upgrades, clamped by the hearth's
// current burn level.
export function hearthLightRadius(hearth) {
  return Math.min(HEARTH_LIGHT_MAX, hearth.light + hearth.lightBonus);
}

export function burnHearth(hearth, dt) {
  hearth.light = Math.max(70, hearth.light - HEARTH_BURN_PER_SEC * hearth.burnMult * dt);
}

export function stokeHearth(hearth, upgrades) {
  hearth.light = Math.min(
    HEARTH_LIGHT_MAX - hearth.lightBonus,
    hearth.light + STOKE_LIGHT + (upgrades.stokeBonus || 0),
  );
  hearth.hp = Math.min(hearth.maxHp, hearth.hp + STOKE_HEAL);
}

export function damageHearth(hearth, amount) {
  hearth.hp = Math.max(0, hearth.hp - amount);
  return hearth.hp <= 0;
}

// The nearest unlit brazier within reach of a point, or null.
export function nearestUnlitBrazier(braziers, x, y, reach) {
  let best = null;
  let bestD = reach;
  for (const b of braziers) {
    if (b.lit) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function countLitBraziers(braziers) {
  let n = 0;
  for (const b of braziers) if (b.lit) n += 1;
  return n;
}
