/* ═══════════════════════════════════════════
   game.js — Pier Master
   Owns the canvas, game loop, and all world state.
   Talks to: physics.js (rope/hook positions)
             ui.js      (event hooks)
             save.js    (persistence)
             data.js    (fish / rod / quest data)
════════════════════════════════════════════ */

'use strict';

/* ── Canvas setup ── */
const titleCanvas = document.getElementById('title-canvas');
const gameCanvas  = document.getElementById('game-canvas');
const tCtx        = titleCanvas.getContext('2d');
const gCtx        = gameCanvas.getContext('2d');

/* ── Game state ── */
let G = {
  /* Loaded from save / defaults */
  gold:          0,
  totalCaught:   0,
  catches:       {},
  catchRodLog:   {},
  speciesSeen:   new Set(),
  rodsOwned:     ['starter'],
  rodEquipped:   'starter',
  questsClaimed: [],

  /* Runtime */
  phase:         'title',   /* title | idle | casting | fishing | reeling */
  playerX:       0.5,       /* 0–1 fraction of dock width */
  playerFacing:  1,         /* 1 = right, -1 = left */
  dockStart:     0.05,      /* fraction of canvas width */
  dockEnd:       0.95,
  fishOnHook:    null,
  activeFish:    [],        /* swimming fish in world */

  /* Layout (px) — recalculated on resize */
  W: 0, H: 0,
  skyH:   0,   /* height of sky zone */
  dockY:  0,   /* Y of top of dock */
  waterY: 0,   /* Y of water surface (below dock) */

  /* Player anim */
  bobOffset: 0,
  bobDir:    1,
};

/* ── Input ── */
const keys = {};
let mouseMoveX = 0;

/* ════════════════════════════════════════════
   TITLE SCREEN ANIMATION
════════════════════════════════════════════ */
let titleFish = [];
let titleRAF  = null;

function startTitleScreen() {
  _resizeCanvas(titleCanvas);
  titleFish = Array.from({ length: 8 }, () => _makeTitleFish());
  _titleLoop();
}

function _titleLoop() {
  titleRAF = requestAnimationFrame(_titleLoop);
  _drawTitle();
}

function _drawTitle() {
  const w = titleCanvas.width;
  const h = titleCanvas.height;
  tCtx.clearRect(0, 0, w, h);

  /* Sky gradient */
  const sky = tCtx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#0a2a4a');
  sky.addColorStop(1, '#1a5c8c');
  tCtx.fillStyle = sky;
  tCtx.fillRect(0, 0, w, h * 0.6);

  /* Water */
  const waterGrad = tCtx.createLinearGradient(0, h * 0.55, 0, h);
  waterGrad.addColorStop(0, '#3a9bc4');
  waterGrad.addColorStop(1, '#1a5c8c');
  tCtx.fillStyle = waterGrad;
  tCtx.fillRect(0, h * 0.55, w, h * 0.45);

  /* Wave line */
  _drawWaveLine(tCtx, w, h * 0.55, w, 16, '#7ec8e3', 0.6);

  /* Pier */
  const pierY = h * 0.52;
  tCtx.fillStyle = '#8b5e3c';
  tCtx.fillRect(w * 0.25, pierY, w * 0.5, 14);
  _drawPile(tCtx, w * 0.38, pierY + 14, 18, h * 0.25);
  _drawPile(tCtx, w * 0.62, pierY + 14, 18, h * 0.22);

  /* Animated fish */
  titleFish.forEach(f => {
    f.x += f.speed * f.dir;
    if (f.x > w + 60)  { f.x = -60; f.dir =  1; }
    if (f.x < -60)     { f.x = w + 60; f.dir = -1; }
    _drawFish(tCtx, f.x, f.y, f.size, f.color, f.dir);
  });
}

function _makeTitleFish() {
  return {
    x:     Math.random() * titleCanvas.width,
    y:     titleCanvas.height * (0.62 + Math.random() * 0.3),
    size:  14 + Math.random() * 18,
    color: FISH[Math.floor(Math.random() * FISH.length)].color,
    speed: 0.4 + Math.random() * 0.8,
    dir:   Math.random() < 0.5 ? 1 : -1,
  };
}

/* ════════════════════════════════════════════
   GAME INIT
════════════════════════════════════════════ */
function initGame() {
  /* Stop title */
  cancelAnimationFrame(titleRAF);

  /* Load save */
  const saved = loadSave();
  G.gold          = saved.gold;
  G.totalCaught   = saved.totalCaught;
  G.catches       = saved.catches;
  G.catchRodLog   = saved.catchRodLog;
  G.speciesSeen   = new Set(saved.speciesSeen);
  G.rodsOwned     = saved.rodsOwned;
  G.rodEquipped   = saved.rodEquipped;
  G.questsClaimed = saved.questsClaimed;

  /* Sync rod objects from data */
  RODS.forEach(r => {
    r.owned    = G.rodsOwned.includes(r.id);
    r.equipped = r.id === G.rodEquipped;
  });

  /* Layout */
  _resizeCanvas(gameCanvas);
  window.addEventListener('resize', () => {
    _resizeCanvas(gameCanvas);
    physicsSetWaterY(G.waterY);
  });

  /* Physics */
  physicsInit(G.W, G.H, G.waterY);

  /* Player starts randomly on left or right portion of dock */
  G.playerX    = Math.random() < 0.5 ? 0.2 : 0.75;
  G.playerFacing = G.playerX > 0.5 ? -1 : 1;

  /* Spawn fish */
  _spawnFish();

  /* Input */
  window.addEventListener('keydown',  _onKeyDown);
  window.addEventListener('keyup',    e => { keys[e.code] = false; });
  gameCanvas.addEventListener('click', _onCanvasClick);

  /* UI init (ui.js) */
  uiInit();

  /* Start loop */
  G.phase = 'idle';
  _gameLoop();
}

/* ════════════════════════════════════════════
   MAIN GAME LOOP
════════════════════════════════════════════ */
let lastTs = 0;

function _gameLoop(ts = 0) {
  requestAnimationFrame(_gameLoop);
  const dt = Math.min(ts - lastTs, 50); /* cap at 50ms */
  lastTs = ts;

  _update(dt);
  _draw();
}

/* ── UPDATE ── */
function _update(dt) {
  /* Player movement when idle */
  if (G.phase === 'idle') {
    const speed = 0.0025;
    let moved = false;
    if (keys['ArrowLeft']  || keys['KeyA']) { G.playerX -= speed * dt; G.playerFacing = -1; moved = true; }
    if (keys['ArrowRight'] || keys['KeyD']) { G.playerX += speed * dt; G.playerFacing =  1; moved = true; }
    G.playerX = Math.max(G.dockStart + 0.02, Math.min(G.dockEnd - 0.02, G.playerX));

    /* Bob when idle */
    G.bobOffset += G.bobDir * 0.03;
    if (Math.abs(G.bobOffset) > 1.5) G.bobDir *= -1;
  }

  /* Swim fish */
  G.activeFish.forEach(f => {
    f.x += f.vx;
    if (f.x < -40)      { f.x = -40;       f.vx = Math.abs(f.vx); }
    if (f.x > G.W + 40) { f.x = G.W + 40;  f.vx = -Math.abs(f.vx); }
    /* Gentle vertical drift */
    f.y += Math.sin(Date.now() * 0.001 + f.phase) * 0.15;
  });

  /* Update rope anchor to rod tip */
  if (G.phase === 'casting' || G.phase === 'fishing') {
    const tip = _getRodTip();
    physicsSetAnchor(tip.x, tip.y);
  }
}

/* ── DRAW ── */
function _draw() {
  const ctx = gCtx;
  const { W, H, skyH, dockY, waterY } = G;

  ctx.clearRect(0, 0, W, H);

  /* Sky */
  const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
  skyGrad.addColorStop(0, '#87ceeb');
  skyGrad.addColorStop(1, '#b8e0f7');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, skyH);

  /* Water */
  const wGrad = ctx.createLinearGradient(0, waterY, 0, H);
  wGrad.addColorStop(0.0,  '#7ec8e3');
  wGrad.addColorStop(0.25, '#3a9bc4');
  wGrad.addColorStop(1.0,  '#1a5c8c');
  ctx.fillStyle = wGrad;
  ctx.fillRect(0, waterY, W, H - waterY);

  /* Wave line */
  _drawWaveLine(ctx, W, waterY, W, 18, '#9fd8ee', 0.5);

  /* Fish (below water surface layer for z-depth) */
  G.activeFish.forEach(f => {
    ctx.globalAlpha = f.y < waterY + 12 ? 0.4 : 1;
    _drawFish(ctx, f.x, f.y, f.size, f.color, f.vx >= 0 ? 1 : -1);
    ctx.globalAlpha = 1;
  });

  /* Dock */
  _drawDock(ctx);

  /* Rope + hook */
  const rope = physicsGetRope();
  if (rope.length > 1) {
    ctx.beginPath();
    ctx.moveTo(rope[0].x, rope[0].y);
    for (let i = 1; i < rope.length - 1; i++) {
      ctx.lineTo(rope[i].x, rope[i].y);
    }
    ctx.strokeStyle = 'rgba(180,170,150,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* Hook */
  const hook = physicsGetHook();
  if (hook) _drawHook(ctx, hook.x, hook.y);

  /* Splash particles */
  physicsGetParticles().forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7ec8e3';
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  /* Player (drawn on dock) */
  _drawPlayer(ctx);
}

/* ════════════════════════════════════════════
   DRAW HELPERS
════════════════════════════════════════════ */
function _drawDock(ctx) {
  const { W, dockY, waterY } = G;
  const x0 = G.dockStart * W;
  const x1 = G.dockEnd   * W;
  const dockW = x1 - x0;

  /* Plank surface */
  ctx.fillStyle = '#a0714f';
  ctx.fillRect(x0, dockY, dockW, 16);
  /* Plank shadow */
  ctx.fillStyle = '#7a5535';
  ctx.fillRect(x0, dockY + 13, dockW, 3);

  /* Plank lines */
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth   = 0.5;
  for (let px = x0 + 30; px < x1; px += 30) {
    ctx.beginPath(); ctx.moveTo(px, dockY); ctx.lineTo(px, dockY + 16); ctx.stroke();
  }

  /* Piles */
  const pilePositions = [0.25, 0.5, 0.75];
  pilePositions.forEach(frac => {
    const px = x0 + dockW * frac;
    _drawPile(ctx, px, dockY + 16, 20, waterY - dockY - 4);
  });
}

function _drawPile(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(x - w/2, 0, x + w/2, 0);
  grad.addColorStop(0, '#5c3d20');
  grad.addColorStop(0.5, '#8b5e3c');
  grad.addColorStop(1, '#5c3d20');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x - w/2, y, w, h, [0, 0, 4, 4]);
  ctx.fill();
}

function _drawPlayer(ctx) {
  const { W, dockY, bobOffset } = G;
  const px = G.playerX * W;
  const py = dockY - 2 + bobOffset;
  const sc = G.playerFacing;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(sc, 1);

  /* Hat */
  ctx.fillStyle = '#d63031';
  ctx.beginPath();
  ctx.ellipse(0, -52, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-8, -58, 16, 8);

  /* Head */
  ctx.fillStyle = '#f9c74f';
  ctx.beginPath();
  ctx.arc(0, -44, 7, 0, Math.PI * 2);
  ctx.fill();

  /* Body */
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -37);
  ctx.lineTo(0, -18);
  ctx.stroke();

  /* Arms — casting arm forward */
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(12, -26);  /* rod arm */
  ctx.moveTo(0, -32);
  ctx.lineTo(-8, -25);
  ctx.stroke();

  /* Rod */
  ctx.strokeStyle = '#8b5e3c';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(12, -26);
  ctx.lineTo(22, -42);
  ctx.stroke();

  /* Legs */
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-5, 0);
  ctx.moveTo(0, -18);
  ctx.lineTo(5, 0);
  ctx.stroke();

  ctx.restore();
}

function _drawFish(ctx, x, y, size, color, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  /* Body */
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  /* Tail */
  ctx.beginPath();
  ctx.moveTo(size * 0.8, 0);
  ctx.lineTo(size * 1.4, -size * 0.5);
  ctx.lineTo(size * 1.4,  size * 0.5);
  ctx.closePath();
  ctx.fill();

  /* Eye */
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(-size * 0.5, -size * 0.15, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function _drawHook(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.arc(x, y + 4, 5, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
  ctx.restore();
}

function _drawWaveLine(ctx, w, y, totalW, amp, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  const segs = 32;
  const t    = Date.now() * 0.001;
  for (let i = 0; i <= segs; i++) {
    const sx = (i / segs) * totalW;
    const sy = y - Math.sin(i / segs * Math.PI * 4 + t) * amp * 0.5
                 - Math.sin(i / segs * Math.PI * 2 - t * 0.7) * amp * 0.3;
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(w, y + amp);
  ctx.lineTo(0, y + amp);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ════════════════════════════════════════════
   FISH SPAWNING
════════════════════════════════════════════ */
function _spawnFish() {
  const rod    = _equippedRod();
  const count  = 6 + Math.floor(Math.random() * 5);
  G.activeFish = [];

  for (let i = 0; i < count; i++) {
    const type   = pickFishForRod(rod);
    const waterH = G.H - G.waterY;
    const depth  = type.depthMin + Math.random() * (type.depthMax - type.depthMin);
    const spd    = (0.3 + Math.random() * 0.6) * type.speed;
    const dir    = Math.random() < 0.5 ? 1 : -1;

    G.activeFish.push({
      type:  type,
      x:     Math.random() * G.W,
      y:     G.waterY + depth * waterH,
      vx:    spd * dir * 0.4,
      size:  type.size * (0.85 + Math.random() * 0.3),
      color: type.color,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/* ════════════════════════════════════════════
   CASTING
════════════════════════════════════════════ */
function cast() {
  if (G.phase !== 'idle') return;
  G.phase = 'casting';
  uiSetCastVisible(false);
  uiSetMoveHint(false);

  const tip    = _getRodTip();
  const hookX  = tip.x + G.playerFacing * (60 + Math.random() * 40);
  const hookY  = G.waterY + G.H * 0.12 + Math.random() * G.H * 0.18;

  physicsCast(tip.x, tip.y, hookX, hookY);

  uiShowNotice('Line in the water…');

  /* Wait for bite */
  const biteMs = 1800 + Math.random() * 3200;
  setTimeout(_triggerBite, biteMs);
}

function _triggerBite() {
  if (G.phase !== 'casting') return;
  G.phase        = 'fishing';
  G.fishOnHook   = pickFishForRod(_equippedRod());

  physicsStartStruggle(G.fishOnHook.rarity);
  uiStartQTE(G.fishOnHook, _onQTEResult);
}

function _onQTEResult(result) {
  /* result: 'perfect' | 'good' | 'miss' */
  physicsStopStruggle();

  if (result === 'miss') {
    uiShowNotice('The fish got away!');
    _endFishing();
    return;
  }

  const fish    = G.fishOnHook;
  const rod     = _equippedRod();
  const bonus   = result === 'perfect' ? 1.5 : 1;
  const gold    = Math.round(fish.goldVal * bonus);

  /* Record catch */
  G.gold        += gold;
  G.totalCaught += 1;
  G.catches[fish.id]  = (G.catches[fish.id]  || 0) + 1;
  G.speciesSeen.add(fish.id);
  if (rod) {
    const key = fish.id + '_' + rod.id;
    G.catchRodLog[key] = (G.catchRodLog[key] || 0) + 1;
  }

  /* Splash physics */
  const hook = physicsGetHook();
  if (hook) physicsSpawnSplash(hook.x, hook.y);

  /* Double catch: Lucky Lure */
  if (rod && rod.special === 'double' && Math.random() < 0.4) {
    const bonus2 = pickFishForRod(rod);
    const gold2  = bonus2.goldVal;
    G.gold        += gold2;
    G.totalCaught += 1;
    G.catches[bonus2.id] = (G.catches[bonus2.id] || 0) + 1;
    G.speciesSeen.add(bonus2.id);
    setTimeout(() => uiShowNotice(`Bonus: ${bonus2.name}! +${gold2}g`), 600);
  }

  /* Persist */
  G.rodsOwned   = RODS.filter(r => r.owned).map(r => r.id);
  G.rodEquipped = _equippedRod()?.id ?? 'starter';
  writeSave(G);

  /* UI feedback */
  uiUpdateGold(G.gold);
  uiUpdateCatchPanel();
  uiCheckQuestProgress();
  uiShowCaughtSplash(fish.name, gold);
  uiShowNotice(`${fish.name}! +${gold}g`);

  _endFishing();
}

function _endFishing() {
  G.phase      = 'idle';
  G.fishOnHook = null;
  physicsReel();
  _spawnFish();
  uiSetCastVisible(true);
  uiSetMoveHint(true);
}

/* ════════════════════════════════════════════
   INPUT
════════════════════════════════════════════ */
function _onKeyDown(e) {
  keys[e.code] = true;

  if ((e.code === 'Space' || e.code === 'Enter') && G.phase === 'idle') {
    e.preventDefault();
    cast();
  }
  if (e.code === 'Space' && G.phase === 'fishing') {
    e.preventDefault();
    uiQTEClick();
  }
}

function _onCanvasClick(e) {
  if (G.phase === 'idle') {
    /* Move player toward click */
    const rect   = gameCanvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const dockX0 = G.dockStart;
    const dockX1 = G.dockEnd;
    const clamped = Math.max(dockX0 + 0.02, Math.min(dockX1 - 0.02, clickX));
    G.playerFacing = clamped > G.playerX ? 1 : -1;
    G.playerX      = clamped;
  }
}

/* ════════════════════════════════════════════
   LAYOUT / RESIZE
════════════════════════════════════════════ */
function _resizeCanvas(canvas) {
  canvas.width  = canvas.clientWidth  * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  if (canvas === gameCanvas) {
    G.W      = canvas.width;
    G.H      = canvas.height;
    G.skyH   = G.H * 0.45;
    G.dockY  = G.H * 0.52;
    G.waterY = G.dockY + 16;
  }
}

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function _equippedRod() {
  return RODS.find(r => r.equipped) || RODS[0];
}

function _getRodTip() {
  const px = G.playerX * G.W;
  const py = G.dockY - 42;
  return {
    x: px + G.playerFacing * 22,
    y: py - 16,
  };
}
