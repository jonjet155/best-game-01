// The renderer: everything the player sees, painted on one canvas.
// Warm hearth light against cold dark blue shadow; the light radius is
// drawn as a real glow the player can read at a glance. The HUD is dense
// on purpose: score, fuel, night, health, keys, the incoming roster and
// the explicit win/lose lines are all on screen while playing.
import {
  BRAZIER_RADIUS, ENEMY_TYPES, FLARE_RADIUS, HEARTH_X, HEARTH_Y, NIGHTS,
  VIEW_H, VIEW_W,
} from './config.js';
import { aliveCounts, incomingRoster, upgradeCardAt } from './world.js';
import { countLitBraziers } from './hearth.js';

const FONT = (px, weight) => `${weight || 700} ${px}px "Trebuchet MS", Verdana, sans-serif`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    canvas.style.width = `${VIEW_W * scale}px`;
    canvas.style.height = `${VIEW_H * scale}px`;
    return scale;
  }

  function bar(x, y, w, h, frac, fill, bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function text(str, x, y, px, color, align, weight) {
    ctx.font = FONT(px, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function drawGround(world, t) {
    // Cold night ground with a faint warm pool around the hearth.
    const g = ctx.createRadialGradient(HEARTH_X, HEARTH_Y, 40, HEARTH_X, HEARTH_Y, 620);
    g.addColorStop(0, '#3a2a18');
    g.addColorStop(0.45, '#1c1a26');
    g.addColorStop(1, '#0a0d1f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Scattered stones and tufts, placed by the seeded world rng at build
    // time would drift; instead a fixed hash of grid cells keeps them still.
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let gy = 0; gy < 12; gy += 1) {
      for (let gx = 0; gx < 20; gx += 1) {
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
        if (h % 3 === 0) ctx.fillRect(gx * 64 + (h % 40), gy * 60 + (h % 30), 3, 3);
      }
    }
    // Ring of pale stones marking the clearing's edge.
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(HEARTH_X, HEARTH_Y, 330, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHearth(world, t) {
    const flick = Math.sin(t * 9) * 3 + Math.sin(t * 23) * 2;
    const r = world.lightRadius;
    // The glow itself.
    const g = ctx.createRadialGradient(HEARTH_X, HEARTH_Y, 10, HEARTH_X, HEARTH_Y, r);
    g.addColorStop(0, 'rgba(251,191,36,0.55)');
    g.addColorStop(0.55, 'rgba(249,115,22,0.18)');
    g.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(HEARTH_X, HEARTH_Y, r, 0, Math.PI * 2);
    ctx.fill();
    // Stone ring.
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.arc(HEARTH_X, HEARTH_Y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#44403c';
    ctx.beginPath();
    ctx.arc(HEARTH_X, HEARTH_Y, 27, 0, Math.PI * 2);
    ctx.fill();
    // Fire: three tongues that never sit still.
    const flames = ['#fde68a', '#fbbf24', '#f97316'];
    for (let i = 0; i < 3; i += 1) {
      const fh = 26 + flick * (i + 1) * 0.3 + i * 4;
      ctx.fillStyle = flames[i];
      ctx.beginPath();
      ctx.ellipse(HEARTH_X + (i - 1) * 7, HEARTH_Y - 8 - i * 3, 9 - i * 2, fh * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hearth health pips above the fire.
    bar(HEARTH_X - 34, HEARTH_Y - 52, 68, 8, world.hearth.hp / world.hearth.maxHp, '#f97316', 'rgba(0,0,0,0.55)');
    text('HEARTH', HEARTH_X, HEARTH_Y - 58, 11, '#fdba74', 'center');
  }

  function drawBraziers(world, t) {
    for (const b of world.braziers) {
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
      ctx.fill();
      if (b.lit) {
        const fl = Math.sin(t * 11 + b.x) * 2;
        const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, BRAZIER_RADIUS);
        g.addColorStop(0, 'rgba(251,191,36,0.4)');
        g.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BRAZIER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y - 4, 6, 10 + fl, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        text('F', b.x, b.y + 4, 12, '#94a3b8', 'center');
      }
    }
  }

  function drawKeeper(world, t) {
    const k = world.keeper;
    const bob = Math.sin(t * 6) * 1.5;
    // Lantern glow around the keeper.
    const g = ctx.createRadialGradient(k.x, k.y, 6, k.x, k.y, 70);
    g.addColorStop(0, 'rgba(253,230,138,0.35)');
    g.addColorStop(1, 'rgba(253,230,138,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(k.x, k.y, 70, 0, Math.PI * 2);
    ctx.fill();
    // Hooded keeper: cloak, hood, lantern.
    ctx.fillStyle = k.hitFlash > 0 ? '#fca5a5' : '#92400e';
    ctx.beginPath();
    ctx.moveTo(k.x, k.y - 14 + bob);
    ctx.lineTo(k.x - 13, k.y + 14);
    ctx.lineTo(k.x + 13, k.y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = k.hitFlash > 0 ? '#fecaca' : '#b45309';
    ctx.beginPath();
    ctx.arc(k.x, k.y - 12 + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1005';
    ctx.beginPath();
    ctx.arc(k.x, k.y - 12 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    // The lantern swings at the keeper's side.
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(k.x + 14, k.y - 2 + bob, 6, 9);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(k.x + 14, k.y - 2 + bob, 6, 9);
  }

  function drawEnemy(e, t) {
    const wob = Math.sin(e.wobble * 3) * 2;
    // Shadow body: a dark blob with glowing eyes — readable at any size.
    ctx.fillStyle = e.hitFlash > 0 ? '#e9d5ff' : '#1e1b2e';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + wob * 0.4, e.radius, e.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Eyes.
    const eyeY = e.y - e.radius * 0.25 + wob * 0.4;
    ctx.fillStyle = e.kind === 'longdark' ? '#ef4444' : '#f0abfc';
    ctx.beginPath();
    ctx.arc(e.x - e.radius * 0.35, eyeY, 3.2, 0, Math.PI * 2);
    ctx.arc(e.x + e.radius * 0.35, eyeY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (e.kind === 'longdark') {
      // Crown of dark flame.
      ctx.fillStyle = '#4c1d95';
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(e.x + i * 14, e.y - e.radius * 0.8);
        ctx.lineTo(e.x + i * 14 + 7, e.y - e.radius * 1.5);
        ctx.lineTo(e.x + i * 14 + 14, e.y - e.radius * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      text('THE LONG DARK', e.x, e.y - e.radius - 26, 13, '#f87171', 'center');
    }
    // Burn marks while the light sears it.
    if (e.burn > 0.2) {
      ctx.fillStyle = 'rgba(251,146,60,0.8)';
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.radius * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Health bar when hurt.
    if (e.hp < e.maxHp) {
      bar(e.x - e.radius, e.y - e.radius - 12, e.radius * 2, 5, e.hp / e.maxHp, '#c084fc', 'rgba(0,0,0,0.6)');
    }
  }

  function drawEmbers(world) {
    for (const em of world.embers) {
      const g = ctx.createRadialGradient(em.x, em.y, 1, em.x, em.y, 16);
      g.addColorStop(0, 'rgba(254,243,199,0.95)');
      g.addColorStop(0.4, 'rgba(251,146,60,0.8)');
      g.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(em.x, em.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(em.x, em.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickups(world, t) {
    for (const p of world.pickups) {
      const bob = Math.sin(t * 5 + p.x) * 2;
      if (p.kind === 'wood') {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(p.x - 5, p.y - 4 + bob, 10, 8);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(p.x - 5, p.y - 4 + bob, 10, 3);
      } else {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles(world) {
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(world) {
    for (const f of world.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, 15, f.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(world) {
    // The dark presses in from the edges; the hearth light holds it back.
    const r = world.lightRadius;
    const g = ctx.createRadialGradient(HEARTH_X, HEARTH_Y, r * 0.7, HEARTH_X, HEARTH_Y, 640);
    g.addColorStop(0, 'rgba(4,6,18,0)');
    g.addColorStop(0.75, 'rgba(4,6,18,0.42)');
    g.addColorStop(1, 'rgba(2,3,12,0.78)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (world.flareFlash > 0) {
      ctx.fillStyle = `rgba(253,230,138,${world.flareFlash * 0.9})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawHud(world) {
    // Top bar: score, night, hearth, keeper, fuel.
    ctx.fillStyle = 'rgba(2,4,14,0.72)';
    ctx.fillRect(0, 0, VIEW_W, 64);
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fillRect(0, 64, VIEW_W, 2);
    text('EMBERKEEP', 16, 26, 22, '#fbbf24');
    text(`SCORE ${world.score}`, 16, 50, 14, '#fef3c7');
    text(`BEST ${Math.max(world.best, world.score)}`, 190, 50, 14, '#a8a29e');
    text(`NIGHT ${world.night}/${NIGHTS}`, 330, 30, 20, '#fef3c7', 'left');
    const planFrac = world.totalToSpawn > 0 ? world.spawned / world.totalToSpawn : 0;
    bar(330, 38, 170, 10, planFrac, '#7c3aed', 'rgba(255,255,255,0.15)');
    text('DAWN IN', 510, 30, 12, '#a8a29e');
    text(world.spawnQueue.length + world.enemies.length > 0 ? `${world.spawnQueue.length + world.enemies.length} LEFT` : 'CLEAR!', 510, 48, 14, '#e9d5ff');
    text('HEARTH', 620, 26, 12, '#fdba74');
    bar(620, 32, 120, 12, world.hearth.hp / world.hearth.maxHp, '#f97316', 'rgba(255,255,255,0.15)');
    text(`${Math.ceil(world.hearth.hp)}/100`, 745, 44, 12, '#fdba74');
    text('KEEPER', 790, 26, 12, '#fca5a5');
    bar(790, 32, 120, 12, world.keeper.hp / world.keeper.maxHp, '#ef4444', 'rgba(255,255,255,0.15)');
    text(`${Math.ceil(world.keeper.hp)}/100`, 915, 44, 12, '#fca5a5');
    text(`WOOD ${world.wood}`, 990, 30, 15, '#d97706');
    text(`OIL ${world.oil}`, 990, 50, 15, '#fbbf24');
    if (world.chain >= 2) {
      text(`CHAIN x${Math.min(9, world.chain)}`, 1140, 30, 18, '#f97316', 'left');
    }
    text(`BANISHED ${world.banished}`, 1140, 50, 13, '#e9d5ff');

    // Left panel: incoming roster + alive counts.
    ctx.fillStyle = 'rgba(2,4,14,0.6)';
    ctx.fillRect(12, 84, 190, 196);
    text('INCOMING', 22, 106, 13, '#c084fc');
    const roster = incomingRoster(world);
    let ry = 128;
    if (roster.length === 0) text('— none —', 22, ry, 13, '#a8a29e');
    for (const r of roster.slice(0, 5)) {
      text(`${r.name} x${r.count}`, 22, ry, 13, '#e9d5ff');
      ry += 20;
    }
    text('ALIVE NOW', 22, ry + 8, 13, '#c084fc');
    const alive = aliveCounts(world);
    let ay = ry + 30;
    for (const [kind, n] of Object.entries(alive)) {
      text(`${ENEMY_TYPES[kind].name} x${n}`, 22, ay, 13, '#fef3c7');
      ay += 18;
    }

    // Bottom bar: the rules of the game, always visible.
    ctx.fillStyle = 'rgba(2,4,14,0.72)';
    ctx.fillRect(0, VIEW_H - 56, VIEW_W, 56);
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fillRect(0, VIEW_H - 56, VIEW_W, 2);
    text('WIN: banish THE LONG DARK on Night 7', 16, VIEW_H - 32, 14, '#86efac');
    text('LOSE: the hearth dies or the keeper falls', 16, VIEW_H - 12, 14, '#fca5a5');
    text('WASD move · MOUSE aim · CLICK / SPACE throw ember (1 wood)', 470, VIEW_H - 32, 13, '#fef3c7');
    text('E stoke (4 wood) · F light brazier (4 oil) · Q flare (6 oil) · P pause · M mute', 470, VIEW_H - 12, 13, '#fef3c7');
    const flareReady = world.flareCooldown <= 0 && world.oil >= 6;
    text(flareReady ? 'FLARE READY [Q]' : `FLARE ${Math.ceil(world.flareCooldown)}s`, 1130, VIEW_H - 22, 14, flareReady ? '#fde68a' : '#78716c', 'left');

    // Night banner.
    if (world.bannerTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.bannerTimer);
      text(world.banner, VIEW_W / 2, 130, 30, '#fbbf24', 'center');
      ctx.globalAlpha = 1;
    }
    if (world.paused) {
      ctx.fillStyle = 'rgba(2,4,14,0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10, 44, '#fef3c7', 'center');
      text('P to resume · R to restart', VIEW_W / 2, VIEW_H / 2 + 30, 16, '#a8a29e', 'center');
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8,8,22,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawTitle(world) {
    drawGround(world, 0.6);
    drawHearth(world, 0.6);
    drawBraziers(world, 0.6);
    drawDarkness(world);
    ctx.fillStyle = 'rgba(2,4,14,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text('EMBERKEEP', VIEW_W / 2, 150, 72, '#fbbf24', 'center');
    text('— the fire is the only light —', VIEW_W / 2, 190, 22, '#fdba74', 'center');
    panel(VIEW_W / 2 - 330, 230, 660, 210);
    text('Tend the hearth. Throw embers at the dark.', VIEW_W / 2, 268, 18, '#fef3c7', 'center');
    text('The hearth light IS the safe zone: inside it the dark burns,', VIEW_W / 2, 296, 16, '#e7e5e4', 'center');
    text('outside it the dark hunts. Light the braziers. Survive 7 nights.', VIEW_W / 2, 320, 16, '#e7e5e4', 'center');
    text('WIN: banish THE LONG DARK on Night 7', VIEW_W / 2, 356, 16, '#86efac', 'center');
    text('LOSE: the hearth dies or the keeper falls', VIEW_W / 2, 380, 16, '#fca5a5', 'center');
    text('WASD move · MOUSE aim · CLICK / SPACE throw · E stoke · F brazier · Q flare', VIEW_W / 2, 412, 15, '#fde68a', 'center');
    text('CLICK OR PRESS ENTER TO BEGIN', VIEW_W / 2, 490, 22, '#fef3c7', 'center');
    if (world.best > 0) text(`BEST SCORE ${world.best}`, VIEW_W / 2, 530, 16, '#a8a29e', 'center');
    text('7 nights · 5 shadow kinds · 1 boss · upgrades at every dawn', VIEW_W / 2, 580, 14, '#a8a29e', 'center');
  }

  function drawUpgrade(world) {
    drawGround(world, world.time);
    drawHearth(world, world.time);
    drawBraziers(world, world.time);
    drawDarkness(world);
    ctx.fillStyle = 'rgba(2,4,14,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(`DAWN AFTER NIGHT ${world.night}`, VIEW_W / 2, 120, 36, '#fde68a', 'center');
    text('The dark retreats. Choose one gift of the fire — click or press 1 / 2 / 3.', VIEW_W / 2, 160, 18, '#fef3c7', 'center');
    text(`SCORE ${world.score} · BANISHED ${world.banished} · WOOD ${world.wood} · OIL ${world.oil}`, VIEW_W / 2, 200, 16, '#e7e5e4', 'center');
    const cardW = 300;
    const cardH = 170;
    const top = 300;
    const totalW = cardW * 3 + 40;
    const left = (VIEW_W - totalW) / 2;
    world.upgradeOptions.forEach((up, i) => {
      const x = left + i * (cardW + 20);
      panel(x, top, cardW, cardH);
      text(`[${i + 1}]`, x + cardW / 2, top + 34, 16, '#a8a29e', 'center');
      text(up.name, x + cardW / 2, top + 66, 20, '#fbbf24', 'center');
      const words = up.line.split(' ');
      let line = '';
      let ly = top + 100;
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 26) {
          text(line.trim(), x + cardW / 2, ly, 15, '#fef3c7', 'center');
          ly += 22;
          line = w;
        } else line += ' ' + w;
      }
      if (line.trim()) text(line.trim(), x + cardW / 2, ly, 15, '#fef3c7', 'center');
    });
    text('Your hearth burns brighter with every dawn you survive.', VIEW_W / 2, 540, 15, '#a8a29e', 'center');
  }

  function drawEnd(world, won) {
    drawGround(world, world.time);
    drawHearth(world, world.time);
    drawBraziers(world, world.time);
    for (const e of world.enemies) drawEnemy(e, world.time);
    drawDarkness(world);
    ctx.fillStyle = 'rgba(2,4,14,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (won) {
      text('DAWN BREAKS — YOU WIN!', VIEW_W / 2, 130, 46, '#fbbf24', 'center');
      text('The Long Dark is banished. Seven nights, and the fire still burns.', VIEW_W / 2, 175, 19, '#fef3c7', 'center');
    } else {
      text('THE DARK TAKES THE HEARTH', VIEW_W / 2, 130, 46, '#f87171', 'center');
      text(world.loseReason || 'The fire went out.', VIEW_W / 2, 175, 19, '#fef3c7', 'center');
    }
    panel(VIEW_W / 2 - 280, 220, 560, 220);
    text(`FINAL SCORE  ${world.result ? world.result.score : world.score}`, VIEW_W / 2, 268, 24, '#fef3c7', 'center');
    text(`BEST  ${world.result ? world.result.best : world.best}`, VIEW_W / 2, 302, 18, '#fde68a', 'center');
    text(`SHADOWS BANISHED  ${world.result ? world.result.kills : world.kills}`, VIEW_W / 2, 334, 18, '#e9d5ff', 'center');
    text(`NIGHTS SURVIVED  ${world.result ? world.result.nights : world.night} / ${NIGHTS}`, VIEW_W / 2, 366, 18, '#e9d5ff', 'center');
    text(`EMBERS THROWN  ${world.embersThrown}`, VIEW_W / 2, 398, 18, '#e9d5ff', 'center');
    text('CLICK OR PRESS ENTER TO PLAY AGAIN', VIEW_W / 2, 500, 22, '#fef3c7', 'center');
    text('R restarts too · your best score is kept', VIEW_W / 2, 536, 14, '#a8a29e', 'center');
  }

  function draw(world, screen) {
    const t = world.time;
    if (screen === 'title') {
      drawTitle(world);
      return;
    }
    if (screen === 'upgrade') {
      drawUpgrade(world);
      return;
    }
    if (screen === 'win') {
      drawEnd(world, true);
      return;
    }
    if (screen === 'lose') {
      drawEnd(world, false);
      return;
    }
    // Play screen.
    drawGround(world, t);
    drawBraziers(world, t);
    drawPickups(world, t);
    drawHearth(world, t);
    for (const e of world.enemies) drawEnemy(e, t);
    drawKeeper(world, t);
    drawEmbers(world);
    drawParticles(world);
    drawFloats(world);
    drawDarkness(world);
    drawHud(world);
  }

  return { draw, fit };
}
