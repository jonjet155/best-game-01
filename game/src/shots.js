// Staged scenes for screenshots: ?shot=title|play|win|lose&seed=N builds a
// fixed, deterministic scene with the seeded generator and paints it twice,
// then sets window.__shotReady (and body[data-ready]) so the screenshot
// script knows the frame is done. No wall clock is read here.
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, startGame } from './world.js';
import { createEnemy } from './enemies.js';
import { NIGHTS } from './config.js';

export function stageShot(name, world) {
  if (name === 'title') {
    world.screen = SCREEN_TITLE;
    world.best = 29180;
    world.time = 0.6;
    return { screen: SCREEN_TITLE, best: world.best };
  }
  if (name === 'win' || name === 'lose') {
    startGame(world);
    if (name === 'win') {
      world.screen = SCREEN_WIN;
      world.score = 29180;
      world.kills = 214;
      world.banished = 214;
      world.embersThrown = 388;
      world.night = NIGHTS;
      world.result = { score: 29180, kills: 214, nights: 7, best: 29180 };
      world.best = 29180;
      return { screen: SCREEN_WIN, best: 29180 };
    }
    world.screen = SCREEN_LOSE;
    world.score = 12480;
    world.kills = 96;
    world.banished = 96;
    world.embersThrown = 201;
    world.night = 4;
    world.hearth.hp = 0;
    world.loseReason = 'THE HEARTH WENT DARK';
    world.result = { score: 12480, kills: 96, nights: 4, best: 29180 };
    world.best = 29180;
    return { screen: SCREEN_LOSE, best: 29180 };
  }
  // play: a dense mid-fight on night 3, HUD full, floats and chain live.
  startGame(world);
  world.night = 3;
  world.score = 5840;
  world.best = 18260;
  world.wood = 47;
  world.oil = 23;
  world.chain = 3;
  world.chainTimer = 2.0;
  world.kills = 61;
  world.banished = 61;
  world.embersThrown = 74;
  world.keeper.x = 640;
  world.keeper.y = 430;
  world.keeper.hp = 74;
  world.hearth.hp = 82;
  world.hearth.light = 205;
  world.lightRadius = 205;
  world.braziers[0].lit = true;
  world.braziers[1].lit = true;
  const kinds = ['cinderling', 'cinderling', 'cinderling', 'gloom', 'gloom', 'wisp', 'wisp', 'husk', 'cinderling', 'gloom', 'wisp', 'cinderling'];
  const spots = [
    [180, 150], [1020, 140], [1120, 380], [240, 520], [980, 560], [420, 130],
    [860, 620], [150, 360], [700, 120], [520, 600], [1150, 240], [330, 260],
  ];
  kinds.forEach((kind, i) => {
    const [x, y] = spots[i];
    world.enemies.push(createEnemy(kind, x, y, 3));
  });
  world.spawnQueue = ['cinderling', 'cinderling', 'gloom', 'wisp', 'husk', 'cinderling', 'gloom', 'wisp'];
  world.totalToSpawn = 20;
  world.spawned = 12;
  world.embers.push({ x: 700, y: 380, vx: 400, vy: -300, traveled: 120, damage: 34 });
  world.embers.push({ x: 760, y: 340, vx: 500, vy: -200, traveled: 200, damage: 34 });
  world.floats.push({ x: 420, y: 200, text: '+40', color: '#fef3c7', life: 0.9, maxLife: 1.1 });
  world.floats.push({ x: 980, y: 300, text: '+80', color: '#fbbf24', life: 0.8, maxLife: 1.1 });
  world.floats.push({ x: 700, y: 240, text: 'CHAIN x3', color: '#f97316', life: 1.0, maxLife: 1.1 });
  world.floats.push({ x: 560, y: 500, text: '+14', color: '#fef3c7', life: 0.7, maxLife: 1.1 });
  world.pickups.push({ x: 500, y: 480, kind: 'wood', value: 3, vx: 0, vy: 0 });
  world.pickups.push({ x: 830, y: 470, kind: 'oil', value: 2, vx: 0, vy: 0 });
  world.banner = 'NIGHT 3 OF 7';
  world.bannerTimer = 1.5;
  world.time = 24.5;
  return { screen: SCREEN_PLAY, best: world.best };
}
