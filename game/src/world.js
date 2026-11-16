// The simulation: one world, one fixed step, no wall clock inside it.
// Screens: title -> play -> upgrade (at dawn) -> ... -> win / lose.
// The keeper throws embers, stokes the hearth, lights braziers and fires
// flares; the dark sends a night's worth of creatures at the hearth.
import {
  BRAZIER_COST_OIL, BRAZIER_DPS, BRAZIER_RADIUS, EMBER_COOLDOWN, EMBER_COST_WOOD,
  EMBER_DAMAGE, EMBER_RANGE, EMBER_SPEED, ENEMY_TYPES, FLARE_COOLDOWN, FLARE_COST_OIL,
  FLARE_DAMAGE, FLARE_RADIUS, HEARTH_X, HEARTH_Y, KEEPER_MAX_HP, KEEPER_RADIUS,
  KEEPER_SPEED, NIGHTS, NIGHT_PLANS, STOKE_COOLDOWN, STOKE_COST_WOOD, UPGRADES,
  VIEW_H, VIEW_W,
} from './config.js';
import { createEnemy, pickKindForNight, spawnPoint, updateEnemy } from './enemies.js';
import {
  burnHearth, countLitBraziers, createBraziers, createHearth, damageHearth,
  hearthLightRadius, nearestUnlitBrazier, stokeHearth,
} from './hearth.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

export function createWorld(rng) {
  const world = {
    rng,
    screen: SCREEN_TITLE,
    paused: false,
    time: 0,
    score: 0,
    best: 0,
    chain: 0,
    chainTimer: 0,
    night: 1,
    nightTime: 0,
    nightDuration: 40,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    totalToSpawn: 0,
    spawned: 0,
    bossSpawned: false,
    wood: 20,
    oil: 10,
    keeper: { x: HEARTH_X, y: HEARTH_Y + 90, hp: KEEPER_MAX_HP, maxHp: KEEPER_MAX_HP, hitFlash: 0 },
    upgrades: {
      lightBonus: 0, burnMult: 1, splash: 0, throwMult: 1, maxHpBonus: 0,
      healNow: 0, oilBonus: 0, oilNow: 0, speedMult: 1, stokeBonus: 0, damageBonus: 0,
    },
    owned: [],
    upgradeOptions: [],
    hearth: createHearth(),
    braziers: createBraziers(),
    lightRadius: 175,
    enemies: [],
    embers: [],
    pickups: [],
    particles: [],
    floats: [],
    throwCooldown: 0,
    stokeCooldown: 0,
    flareCooldown: 0,
    flareFlash: 0,
    kills: 0,
    banished: 0,
    embersThrown: 0,
    banner: '',
    bannerTimer: 0,
    loseReason: '',
    result: null,
  };
  return world;
}

function freshUpgrades() {
  return {
    lightBonus: 0, burnMult: 1, splash: 0, throwMult: 1, maxHpBonus: 0,
    healNow: 0, oilBonus: 0, oilNow: 0, speedMult: 1, stokeBonus: 0, damageBonus: 0,
  };
}

export function startGame(world) {
  const best = world.best;
  const rng = world.rng;
  const fresh = createWorld(rng);
  Object.assign(world, fresh, { best, rng });
  world.upgrades = freshUpgrades();
  world.screen = SCREEN_PLAY;
  startNight(world, 1);
}

export function startNight(world, night) {
  const plan = NIGHT_PLANS[night - 1];
  world.night = night;
  world.nightTime = 0;
  world.nightDuration = plan.duration;
  world.spawnQueue = [];
  for (let i = 0; i < plan.count; i += 1) {
    world.spawnQueue.push(pickKindForNight(plan, world.rng));
  }
  // Shuffle the queue with the seeded generator.
  for (let i = world.spawnQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(world.rng.next() * (i + 1));
    [world.spawnQueue[i], world.spawnQueue[j]] = [world.spawnQueue[j], world.spawnQueue[i]];
  }
  world.totalToSpawn = plan.count;
  world.spawned = 0;
  world.spawnInterval = plan.duration / plan.count;
  world.spawnTimer = 1.2;
  world.bossSpawned = false;
  world.banner = night === NIGHTS ? 'NIGHT 7 — THE LONG DARK WAKES' : `NIGHT ${night} OF ${NIGHTS}`;
  world.bannerTimer = 2.6;
  world.wood += plan.woodBonus;
  world.oil += plan.oilBonus;
}

function offerUpgrades(world) {
  const pool = UPGRADES.filter((u) => !world.owned.includes(u.id));
  const options = [];
  while (options.length < 3 && pool.length > 0) {
    const i = Math.floor(world.rng.next() * pool.length);
    options.push(pool.splice(i, 1)[0]);
  }
  // If the pool runs dry, repeat the kindling line rather than stalling.
  while (options.length < 3) options.push(UPGRADES[6]);
  world.upgradeOptions = options;
}

export function chooseUpgrade(world, index, audio) {
  const up = world.upgradeOptions[index];
  if (!up || world.screen !== SCREEN_UPGRADE) return;
  up.apply(world.upgrades);
  world.owned.push(up.id);
  if (world.upgrades.healNow > 0) {
    world.keeper.maxHp = KEEPER_MAX_HP + world.upgrades.maxHpBonus;
    world.keeper.hp = Math.min(world.keeper.maxHp, world.keeper.hp + world.upgrades.healNow);
    world.upgrades.healNow = 0;
  }
  if (world.upgrades.oilNow > 0) {
    world.oil += world.upgrades.oilNow;
    world.upgrades.oilNow = 0;
  }
  world.hearth.lightBonus = world.upgrades.lightBonus;
  world.hearth.burnMult = world.upgrades.burnMult;
  world.hearth.stokeBonus = world.upgrades.stokeBonus;
  if (audio) audio.pickup();
  world.screen = SCREEN_PLAY;
  startNight(world, world.night + 1);
}

function addFloat(world, x, y, text, color) {
  world.floats.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  if (world.floats.length > 40) world.floats.shift();
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: world.rng.range(0.3, 0.7), maxLife: 0.7, color, size: world.rng.range(2, 5),
    });
  }
  if (world.particles.length > 300) world.particles.splice(0, world.particles.length - 300);
}

function killEnemy(world, e, audio) {
  world.kills += 1;
  world.banished += 1;
  world.chain += 1;
  world.chainTimer = 2.5;
  const mult = Math.min(3, 1 + (world.chain - 1) * 0.25);
  const gained = Math.round(e.score * mult);
  world.score += gained;
  addFloat(world, e.x, e.y - 14, `+${gained}`, mult > 1 ? '#fbbf24' : '#fef3c7');
  if (world.chain >= 3) {
    addFloat(world, e.x, e.y - 34, `CHAIN x${Math.min(9, world.chain)}`, '#f97316');
  }
  burst(world, e.x, e.y, e.color, e.kind === 'longdark' ? 40 : 12, 160);
  burst(world, e.x, e.y, '#fbbf24', 6, 120);
  // The kill drops fuel: wood and oil orbs the keeper gathers by walking over.
  world.pickups.push({ x: e.x, y: e.y, kind: 'wood', value: e.wood, vx: 0, vy: 0 });
  if (e.oil > 0) {
    world.pickups.push({ x: e.x + 10, y: e.y + 6, kind: 'oil', value: e.oil + world.upgrades.oilBonus, vx: 0, vy: 0 });
  }
  if (world.pickups.length > 48) world.pickups.splice(0, world.pickups.length - 48);
  if (audio) audio.kill();
  if (e.kind === 'longdark') {
    world.score += 1000;
    addFloat(world, e.x, e.y - 50, 'THE LONG DARK IS BANISHED! +1000', '#fbbf24');
    winGame(world, audio);
  }
}

function damageEnemy(world, e, amount, audio) {
  e.hp -= amount;
  e.hitFlash = 0.12;
  if (e.hp <= 0) killEnemy(world, e, audio);
}

function winGame(world, audio) {
  world.screen = SCREEN_WIN;
  world.result = {
    score: world.score, kills: world.kills, nights: NIGHTS,
    best: Math.max(world.best, world.score),
  };
  world.best = world.result.best;
  if (audio) audio.win();
}

function loseGame(world, reason, audio) {
  world.screen = SCREEN_LOSE;
  world.loseReason = reason;
  world.result = {
    score: world.score, kills: world.kills, nights: world.night,
    best: Math.max(world.best, world.score),
  };
  world.best = world.result.best;
  if (audio) audio.lose();
}

function throwEmber(world, tx, ty, audio) {
  if (world.throwCooldown > 0 || world.wood < EMBER_COST_WOOD) return;
  const k = world.keeper;
  const dx = tx - k.x;
  const dy = ty - k.y;
  const d = Math.hypot(dx, dy) || 1;
  world.wood -= EMBER_COST_WOOD;
  world.embersThrown += 1;
  world.throwCooldown = EMBER_COOLDOWN * world.upgrades.throwMult;
  world.embers.push({
    x: k.x + (dx / d) * 22, y: k.y + (dy / d) * 22,
    vx: (dx / d) * EMBER_SPEED, vy: (dy / d) * EMBER_SPEED,
    traveled: 0, damage: EMBER_DAMAGE + world.upgrades.damageBonus,
  });
  burst(world, k.x + (dx / d) * 22, k.y + (dy / d) * 22, '#fb923c', 3, 60);
  if (audio) audio.throwEmber();
}

function doStoke(world, audio) {
  if (world.stokeCooldown > 0 || world.wood < STOKE_COST_WOOD) return;
  world.wood -= STOKE_COST_WOOD;
  world.stokeCooldown = STOKE_COOLDOWN;
  stokeHearth(world.hearth, world.upgrades);
  burst(world, HEARTH_X, HEARTH_Y, '#fbbf24', 16, 140);
  addFloat(world, HEARTH_X, HEARTH_Y - 44, 'STOKED! +LIGHT', '#fde68a');
  if (audio) audio.stoke();
}

function doFlare(world, audio) {
  if (world.flareCooldown > 0 || world.oil < FLARE_COST_OIL) return;
  world.oil -= FLARE_COST_OIL;
  world.flareCooldown = FLARE_COOLDOWN;
  world.flareFlash = 0.35;
  const k = world.keeper;
  for (const e of [...world.enemies]) {
    const d = Math.hypot(e.x - k.x, e.y - k.y);
    if (d < FLARE_RADIUS + e.radius) {
      damageEnemy(world, e, FLARE_DAMAGE, audio);
      const push = 160;
      const dx = (e.x - k.x) / (d || 1);
      const dy = (e.y - k.y) / (d || 1);
      e.x += dx * push * 0.3;
      e.y += dy * push * 0.3;
    }
  }
  burst(world, k.x, k.y, '#fde68a', 24, 260);
  if (audio) audio.flare();
}

function lightBrazier(world, audio) {
  const k = world.keeper;
  const b = nearestUnlitBrazier(world.braziers, k.x, k.y, 120);
  if (!b || world.oil < BRAZIER_COST_OIL) return;
  world.oil -= BRAZIER_COST_OIL;
  b.lit = true;
  burst(world, b.x, b.y, '#fbbf24', 18, 130);
  addFloat(world, b.x, b.y - 30, 'BRAZIER LIT', '#fde68a');
  if (audio) audio.brazier();
}

function updatePlay(world, input, audio, dt) {
  world.time += dt;
  world.nightTime += dt;
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.flareFlash > 0) world.flareFlash -= dt;
  world.throwCooldown = Math.max(0, world.throwCooldown - dt);
  world.stokeCooldown = Math.max(0, world.stokeCooldown - dt);
  world.flareCooldown = Math.max(0, world.flareCooldown - dt);
  if (world.chainTimer > 0) {
    world.chainTimer -= dt;
    if (world.chainTimer <= 0) world.chain = 0;
  }

  // The hearth burns down; the light is the safe zone.
  burnHearth(world.hearth, dt);
  world.lightRadius = hearthLightRadius(world.hearth);

  // Keeper movement.
  const k = world.keeper;
  const mx = input.moveX();
  const my = input.moveY();
  const mLen = Math.hypot(mx, my) || 1;
  const speed = KEEPER_SPEED * world.upgrades.speedMult;
  k.x = Math.max(24, Math.min(VIEW_W - 24, k.x + (mx / mLen) * speed * dt * (mx || my ? 1 : 0)));
  k.y = Math.max(24, Math.min(VIEW_H - 24, k.y + (my / mLen) * speed * dt * (mx || my ? 1 : 0)));
  if (k.hitFlash > 0) k.hitFlash -= dt;

  // Actions.
  if (input.mouse.clicked || input.pressed('Space')) {
    throwEmber(world, input.mouse.x, input.mouse.y, audio);
  }
  if (input.pressed('KeyE')) doStoke(world, audio);
  if (input.pressed('KeyQ')) doFlare(world, audio);
  if (input.pressed('KeyF')) lightBrazier(world, audio);

  // Spawning.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = world.spawnInterval;
      const kind = world.spawnQueue.shift();
      const p = spawnPoint(world.rng);
      world.enemies.push(createEnemy(kind, p.x, p.y, world.night));
      world.spawned += 1;
    }
  }
  // The boss arrives five seconds into night 7.
  if (world.night === NIGHTS && !world.bossSpawned && world.nightTime > 5) {
    world.bossSpawned = true;
    const p = spawnPoint(world.rng);
    world.enemies.push(createEnemy('longdark', p.x, p.y, world.night));
    world.banner = 'THE LONG DARK HAS COME';
    world.bannerTimer = 2.6;
    if (audio) audio.boss();
  }

  // Boss summons shades.
  for (const e of world.enemies) {
    if (e.kind === 'longdark' && e.summonCooldown <= 0) {
      e.summonCooldown = 8;
      for (let i = 0; i < 2; i += 1) {
        world.enemies.push(createEnemy('cinderling', e.x + world.rng.range(-60, 60), e.y + world.rng.range(-60, 60), world.night));
      }
      world.banner = 'THE LONG DARK CALLS SHADES';
      world.bannerTimer = 1.6;
    }
  }

  // Braziers scorch the dark around them.
  for (const b of world.braziers) {
    if (!b.lit) continue;
    b.flicker += dt;
    for (const e of world.enemies) {
      if (Math.hypot(e.x - b.x, e.y - b.y) < BRAZIER_RADIUS + e.radius) {
        e.hp -= BRAZIER_DPS * dt;
      }
    }
  }

  // Embers fly and strike.
  for (const ember of world.embers) {
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    ember.traveled += EMBER_SPEED * dt;
    world.particles.push({
      x: ember.x, y: ember.y, vx: 0, vy: 0,
      life: 0.18, maxLife: 0.18, color: '#fb923c', size: 3,
    });
  }
  for (const ember of [...world.embers]) {
    let spent = ember.traveled > EMBER_RANGE;
    for (const e of [...world.enemies]) {
      if (Math.hypot(e.x - ember.x, e.y - ember.y) < e.radius + 8) {
        damageEnemy(world, e, ember.damage, audio);
        if (world.upgrades.splash > 0) {
          for (const other of [...world.enemies]) {
            if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 70) {
              damageEnemy(world, other, world.upgrades.splash, audio);
            }
          }
        }
        burst(world, ember.x, ember.y, '#fb923c', 8, 140);
        if (audio) audio.hit();
        spent = true;
        break;
      }
    }
    if (spent) world.embers.splice(world.embers.indexOf(ember), 1);
  }

  // Enemies advance; the dead-by-light and the slain are cleared.
  for (const e of [...world.enemies]) {
    const reached = updateEnemy(e, world, dt);
    if (e.hp <= 0) {
      if (e.kind !== 'longdark') killEnemy(world, e, audio);
      else if (e.hp <= 0) killEnemy(world, e, audio);
      world.enemies.splice(world.enemies.indexOf(e), 1);
      continue;
    }
    if (reached === 'hearth') {
      const dead = damageHearth(world.hearth, e.damage);
      burst(world, e.x, e.y, '#7c3aed', 14, 150);
      addFloat(world, HEARTH_X, HEARTH_Y - 50, `-${e.damage} HEARTH`, '#f87171');
      if (audio) audio.hurt();
      world.enemies.splice(world.enemies.indexOf(e), 1);
      if (dead) {
        loseGame(world, 'THE HEARTH WENT DARK', audio);
        return;
      }
      continue;
    }
    // Touching the keeper hurts the keeper.
    const d = Math.hypot(e.x - k.x, e.y - k.y);
    if (d < e.radius + KEEPER_RADIUS && e.touchCooldown <= 0) {
      e.touchCooldown = 0.9;
      k.hp -= e.damage;
      k.hitFlash = 0.3;
      burst(world, k.x, k.y, '#f87171', 10, 130);
      addFloat(world, k.x, k.y - 26, `-${e.damage}`, '#f87171');
      if (audio) audio.hurt();
      if (k.hp <= 0) {
        k.hp = 0;
        loseGame(world, 'THE KEEPER HAS FALLEN', audio);
        return;
      }
    }
  }

  // Pickups drift to the keeper and are gathered.
  for (const p of [...world.pickups]) {
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    if (d < 110) {
      p.x += ((k.x - p.x) / (d || 1)) * 260 * dt;
      p.y += ((k.y - p.y) / (d || 1)) * 260 * dt;
    }
    if (d < 24) {
      if (p.kind === 'wood') world.wood += p.value;
      else world.oil += p.value;
      addFloat(world, p.x, p.y - 10, `+${p.value} ${p.kind.toUpperCase()}`, p.kind === 'wood' ? '#d97706' : '#fbbf24');
      if (audio) audio.pickup();
      world.pickups.splice(world.pickups.indexOf(p), 1);
    }
  }

  // Particles and floating numbers fade.
  for (const pt of [...world.particles]) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(world.particles.indexOf(pt), 1);
  }
  for (const f of [...world.floats]) {
    f.y -= 34 * dt;
    f.life -= dt;
    if (f.life <= 0) world.floats.splice(world.floats.indexOf(f), 1);
  }

  // Dawn: the night is clear when nothing is left to spawn or fight.
  if (world.spawnQueue.length === 0 && world.enemies.length === 0 && world.screen === SCREEN_PLAY) {
    if (world.night >= NIGHTS) {
      winGame(world, audio);
      return;
    }
    world.wood += 6;
    world.oil += 3;
    offerUpgrades(world);
    world.screen = SCREEN_UPGRADE;
    if (audio) audio.dawn();
  }
}

export function update(world, input, audio, dt) {
  if (input.pressed('KeyM')) {
    if (audio) audio.toggleMute();
  }
  if (world.screen === SCREEN_TITLE) {
    if (input.pressed('Enter') || input.mouse.clicked) {
      if (audio) audio.ensure();
      startGame(world);
    }
    return;
  }
  if (world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE) {
    if (input.pressed('Enter') || input.pressed('KeyR') || input.mouse.clicked) {
      if (audio) audio.ensure();
      startGame(world);
    }
    return;
  }
  if (world.screen === SCREEN_UPGRADE) {
    if (input.pressed('Digit1')) chooseUpgrade(world, 0, audio);
    else if (input.pressed('Digit2')) chooseUpgrade(world, 1, audio);
    else if (input.pressed('Digit3')) chooseUpgrade(world, 2, audio);
    else if (input.mouse.clicked) {
      const idx = upgradeCardAt(input.mouse.x, input.mouse.y);
      if (idx >= 0) chooseUpgrade(world, idx, audio);
    }
    return;
  }
  // Play screen.
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    world.paused = !world.paused;
    return;
  }
  if (world.paused) return;
  updatePlay(world, input, audio, dt);
}

// Upgrade cards sit in a row across the middle of the screen.
export function upgradeCardAt(x, y) {
  const cardW = 300;
  const cardH = 170;
  const top = 300;
  const totalW = cardW * 3 + 40;
  const left = (VIEW_W - totalW) / 2;
  if (y < top || y > top + cardH) return -1;
  for (let i = 0; i < 3; i += 1) {
    const cx = left + i * (cardW + 20);
    if (x >= cx && x <= cx + cardW) return i;
  }
  return -1;
}

// Incoming roster for the HUD: kinds still to spawn, counted.
export function incomingRoster(world) {
  const counts = {};
  for (const kind of world.spawnQueue) counts[kind] = (counts[kind] || 0) + 1;
  for (const e of world.enemies) counts[e.kind] = (counts[e.kind] || 0) + 0; // alive shown separately
  const out = [];
  for (const [kind, n] of Object.entries(counts)) {
    out.push({ kind, name: ENEMY_TYPES[kind].name, count: n });
  }
  return out;
}

export function aliveCounts(world) {
  const counts = {};
  for (const e of world.enemies) counts[e.kind] = (counts[e.kind] || 0) + 1;
  return counts;
}
