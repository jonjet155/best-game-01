// EMBERKEEP tuning: every number the game balances on lives here, in one
// place, so the loop can be tuned without touching the simulation.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;
export const NIGHTS = 7;
export const BEST_KEY = 'emberkeep-best-score';

// The hearth stands at the centre of the clearing. Its light is the safe
// zone: the radius below is the hearth's reach at full strength.
export const HEARTH_X = VIEW_W / 2;
export const HEARTH_Y = VIEW_H / 2 - 10;
export const HEARTH_MAX_HP = 100;
export const HEARTH_BASE_LIGHT = 175;
export const HEARTH_LIGHT_MAX = 320;
export const HEARTH_BURN_PER_SEC = 1.6; // light shrinks unless stoked
export const HEARTH_REGEN_PER_SEC = 0; // light never regrows on its own

export const KEEPER_MAX_HP = 100;
export const KEEPER_SPEED = 235;
export const KEEPER_RADIUS = 15;

// Throwing embers: the core verb. Each throw spends 1 wood.
export const EMBER_COST_WOOD = 1;
export const EMBER_COOLDOWN = 0.26;
export const EMBER_SPEED = 640;
export const EMBER_DAMAGE = 34;
export const EMBER_RADIUS = 7;
export const EMBER_RANGE = 560;

// Stoke (E): feed the hearth wood to push the light back out.
export const STOKE_COST_WOOD = 4;
export const STOKE_LIGHT = 55;
export const STOKE_HEAL = 6;
export const STOKE_COOLDOWN = 0.5;

// Flare (Q): a burst of light that sears everything near the keeper.
export const FLARE_COST_OIL = 6;
export const FLARE_RADIUS = 190;
export const FLARE_DAMAGE = 55;
export const FLARE_COOLDOWN = 6;

// Braziers: four iron bowls around the hearth. Light one (F, standing
// close) and it burns all night, scorching the dark around it.
export const BRAZIER_COST_OIL = 4;
export const BRAZIER_RADIUS = 120;
export const BRAZIER_DPS = 26;
export const BRAZIER_POSITIONS = [
  { x: HEARTH_X, y: HEARTH_Y - 250 },
  { x: HEARTH_X + 265, y: HEARTH_Y },
  { x: HEARTH_X, y: HEARTH_Y + 250 },
  { x: HEARTH_X - 265, y: HEARTH_Y },
];

// Shadow kinds. hp and speed scale a little with the night; see enemies.js.
export const ENEMY_TYPES = {
  cinderling: { name: 'CINDERLING', hp: 30, speed: 62, radius: 13, damage: 6, score: 20, wood: 2, oil: 1, color: '#8b5cf6' },
  gloom: { name: 'GLOOM', hp: 70, speed: 42, radius: 19, damage: 10, score: 40, wood: 3, oil: 2, color: '#a855f7' },
  wisp: { name: 'WISP', hp: 22, speed: 105, radius: 10, damage: 5, score: 30, wood: 1, oil: 2, color: '#c084fc' },
  husk: { name: 'HUSK', hp: 170, speed: 26, radius: 26, damage: 16, score: 80, wood: 6, oil: 3, color: '#7c3aed' },
  longdark: { name: 'THE LONG DARK', hp: 1400, speed: 34, radius: 46, damage: 22, score: 2000, wood: 40, oil: 25, color: '#4c1d95' },
};

// What each night sends. count grows, the mix hardens, night 7 adds the boss.
export const NIGHT_PLANS = [
  { count: 10, mix: { cinderling: 1 }, duration: 34, woodBonus: 12, oilBonus: 4 },
  { count: 15, mix: { cinderling: 0.7, gloom: 0.3 }, duration: 38, woodBonus: 14, oilBonus: 5 },
  { count: 20, mix: { cinderling: 0.5, gloom: 0.3, wisp: 0.2 }, duration: 42, woodBonus: 16, oilBonus: 6 },
  { count: 26, mix: { cinderling: 0.4, gloom: 0.3, wisp: 0.2, husk: 0.1 }, duration: 46, woodBonus: 18, oilBonus: 7 },
  { count: 32, mix: { cinderling: 0.3, gloom: 0.3, wisp: 0.25, husk: 0.15 }, duration: 50, woodBonus: 20, oilBonus: 8 },
  { count: 38, mix: { cinderling: 0.25, gloom: 0.3, wisp: 0.25, husk: 0.2 }, duration: 54, woodBonus: 22, oilBonus: 9 },
  { count: 30, mix: { cinderling: 0.3, gloom: 0.25, wisp: 0.25, husk: 0.2 }, duration: 58, woodBonus: 25, oilBonus: 10, boss: true },
];

// Between-night upgrades: pick one of three at dawn. id, name, line, apply.
export const UPGRADES = [
  { id: 'wide', name: 'WIDE WICK', line: 'Hearth light +45, burns slower', apply: (u) => { u.lightBonus += 45; u.burnMult *= 0.85; } },
  { id: 'splash', name: 'EMBER SPLASH', line: 'Embers burst: +30 splash damage', apply: (u) => { u.splash += 30; } },
  { id: 'hands', name: 'QUICK HANDS', line: 'Throw embers 30% faster', apply: (u) => { u.throwMult *= 0.7; } },
  { id: 'sturdy', name: 'STURDY KEEPER', line: '+30 max health, heal 30 now', apply: (u) => { u.maxHpBonus += 30; u.healNow += 30; } },
  { id: 'rich', name: 'RICH OIL', line: 'Kills drop +1 oil, +10 oil now', apply: (u) => { u.oilBonus += 1; u.oilNow += 10; } },
  { id: 'swift', name: 'SWIFT BOOTS', line: 'Keeper moves 15% faster', apply: (u) => { u.speedMult *= 1.15; } },
  { id: 'kindling', name: 'DEEP KINDLING', line: 'Stoke restores +30 light', apply: (u) => { u.stokeBonus += 30; } },
  { id: 'flint', name: 'FLINT HEART', line: 'Embers +12 damage', apply: (u) => { u.damageBonus += 12; } },
];
