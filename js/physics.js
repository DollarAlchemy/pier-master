/* ═══════════════════════════════════════════
   physics.js — Pier Master
   Matter.js handles:
     • Fishing line  — chain of linked bodies
     • Hook          — pendulum body with water drag
     • Fish struggle — constraint force during QTE
     • Splash        — particle burst on catch

   The physics world is invisible (no Matter renderer).
   Positions are read each frame by game.js to draw
   the line on the game canvas.
════════════════════════════════════════════ */

'use strict';

/* Destructure the Matter.js globals we need */
const {
  Engine, World, Bodies, Body, Constraint,
  Events, Runner, Vector,
} = Matter;

/* ── Physics constants ── */
const PHYSICS = {
  GRAVITY_Y:     0.6,    /* gentler than default 1.0 */
  WATER_DRAG:    0.06,   /* linear drag when body is submerged */
  CHAIN_SEGS:    12,     /* number of rope segments */
  SEG_RADIUS:    2,      /* radius of each rope body */
  SEG_STIFFNESS: 0.7,    /* constraint stiffness */
  HOOK_RADIUS:   5,
  HOOK_MASS:     0.8,
  PARTICLE_COUNT:8,
};

/* ── Module state ── */
let engine   = null;
let runner   = null;
let ropeSegs = [];       /* array of Matter bodies */
let ropeConstraints = [];
let hookBody = null;
let anchorConstraint = null;   /* ties first seg to cast origin */
let waterY   = 0;             /* world-space Y of water surface */
let struggling = false;        /* true during QTE */
let struggleForce = { x: 0, y: 0 };

/* Particles for catch splash */
let particles = [];

/* ────────────────────────────────────────
   init — call once when game screen loads
──────────────────────────────────────────── */
function physicsInit(canvasW, canvasH, wY) {
  waterY = wY;

  engine = Engine.create();
  engine.gravity.y = PHYSICS.GRAVITY_Y;

  runner = Runner.create();
  Runner.run(runner, engine);

  /* Apply water drag every physics tick */
  Events.on(engine, 'beforeUpdate', _applyWaterDrag);
}

/* ────────────────────────────────────────
   cast — create rope from (ox,oy) anchor
   targetX/targetY = where hook lands
──────────────────────────────────────────── */
function physicsCast(ox, oy, targetX, targetY) {
  _clearRope();

  const segCount = PHYSICS.CHAIN_SEGS;
  const r        = PHYSICS.SEG_RADIUS;

  /* Interpolate segment starting positions along cast arc */
  for (let i = 0; i <= segCount; i++) {
    const t  = i / segCount;
    const sx = ox + (targetX - ox) * t;
    const sy = oy + (targetY - oy) * t + Math.sin(t * Math.PI) * 40; /* arc */
    const seg = Bodies.circle(sx, sy, r, {
      mass:          0.05,
      frictionAir:   0.04,
      collisionFilter: { mask: 0 },  /* rope doesn't collide with anything */
      label: 'rope',
    });
    ropeSegs.push(seg);
  }

  /* Hook body at end */
  hookBody = Bodies.circle(targetX, targetY, PHYSICS.HOOK_RADIUS, {
    mass:          PHYSICS.HOOK_MASS,
    frictionAir:   0.02,
    restitution:   0.1,
    collisionFilter: { mask: 0 },
    label: 'hook',
  });

  /* Link segments together */
  for (let i = 0; i < ropeSegs.length - 1; i++) {
    const c = Constraint.create({
      bodyA:       ropeSegs[i],
      bodyB:       ropeSegs[i + 1],
      length:      _dist(ropeSegs[i].position, ropeSegs[i + 1].position),
      stiffness:   PHYSICS.SEG_STIFFNESS,
      damping:     0.1,
      render:      { visible: false },
    });
    ropeConstraints.push(c);
  }

  /* Link last segment to hook */
  const hookLink = Constraint.create({
    bodyA:     ropeSegs[ropeSegs.length - 1],
    bodyB:     hookBody,
    length:    8,
    stiffness: 0.9,
    damping:   0.1,
    render:    { visible: false },
  });
  ropeConstraints.push(hookLink);

  /* Anchor first segment to cast origin (pinned) */
  anchorConstraint = Constraint.create({
    pointA:    { x: ox, y: oy },
    bodyB:     ropeSegs[0],
    length:    0,
    stiffness: 1.0,
    render:    { visible: false },
  });

  World.add(engine.world, [
    ...ropeSegs,
    hookBody,
    ...ropeConstraints,
    anchorConstraint,
  ]);
}

/* ────────────────────────────────────────
   reel — remove rope from physics world
──────────────────────────────────────────── */
function physicsReel() {
  _clearRope();
  struggling     = false;
  struggleForce  = { x: 0, y: 0 };
}

/* ────────────────────────────────────────
   startStruggle — apply random force
   to hook each frame (fish on the line)
──────────────────────────────────────────── */
function physicsStartStruggle(intensity) {
  struggling = true;
  _updateStruggleForce(intensity);
}

function physicsStopStruggle() {
  struggling = false;
}

/* ────────────────────────────────────────
   spawnSplash — burst of particles at (x,y)
──────────────────────────────────────────── */
function physicsSpawnSplash(x, y) {
  for (let i = 0; i < PHYSICS.PARTICLE_COUNT; i++) {
    const angle    = (Math.PI * 2 / PHYSICS.PARTICLE_COUNT) * i;
    const speed    = 3 + Math.random() * 4;
    const particle = Bodies.circle(x, y, 3 + Math.random() * 3, {
      mass:          0.1,
      restitution:   0.4,
      frictionAir:   0.05,
      collisionFilter: { mask: 0 },
      label: 'splash',
    });
    Body.setVelocity(particle, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed - 4,
    });
    World.add(engine.world, particle);
    particles.push({ body: particle, born: Date.now(), life: 800 });
  }
}

/* ────────────────────────────────────────
   getRopePositions — called by game.js
   Returns array of {x,y} for canvas drawing
──────────────────────────────────────────── */
function physicsGetRope() {
  if (!ropeSegs.length) return [];
  const pts = ropeSegs.map(s => ({ x: s.position.x, y: s.position.y }));
  if (hookBody) pts.push({ x: hookBody.position.x, y: hookBody.position.y });
  return pts;
}

function physicsGetHook() {
  return hookBody ? { x: hookBody.position.x, y: hookBody.position.y } : null;
}

/* ────────────────────────────────────────
   getParticles — returns live particles
──────────────────────────────────────────── */
function physicsGetParticles() {
  const now = Date.now();
  /* Expire old particles */
  particles = particles.filter(p => {
    if (now - p.born > p.life) {
      World.remove(engine.world, p.body);
      return false;
    }
    return true;
  });
  return particles.map(p => ({
    x:       p.body.position.x,
    y:       p.body.position.y,
    alpha:   1 - (now - p.born) / p.life,
    radius:  p.body.circleRadius,
  }));
}

/* ────────────────────────────────────────
   resize — update anchor when canvas resizes
──────────────────────────────────────────── */
function physicsSetWaterY(y) {
  waterY = y;
}

function physicsSetAnchor(x, y) {
  if (anchorConstraint) {
    anchorConstraint.pointA = { x, y };
  }
}

/* ── Internal helpers ── */

function _clearRope() {
  if (ropeSegs.length) World.remove(engine.world, ropeSegs);
  if (hookBody)        World.remove(engine.world, hookBody);
  if (ropeConstraints.length) World.remove(engine.world, ropeConstraints);
  if (anchorConstraint) World.remove(engine.world, anchorConstraint);
  ropeSegs        = [];
  hookBody        = null;
  ropeConstraints = [];
  anchorConstraint= null;
}

function _applyWaterDrag() {
  const drag = PHYSICS.WATER_DRAG;
  const allBodies = [...ropeSegs, hookBody].filter(Boolean);
  allBodies.forEach(b => {
    if (b.position.y > waterY) {
      Body.setVelocity(b, {
        x: b.velocity.x * (1 - drag),
        y: b.velocity.y * (1 - drag),
      });
    }
  });

  /* Struggle force on hook */
  if (struggling && hookBody) {
    Body.applyForce(hookBody, hookBody.position, struggleForce);
    /* Re-randomize occasionally */
    if (Math.random() < 0.04) _updateStruggleForce(1.5);
  }
}

function _updateStruggleForce(intensity) {
  const angle = Math.random() * Math.PI * 2;
  const mag   = 0.005 * intensity;
  struggleForce = {
    x: Math.cos(angle) * mag,
    y: Math.sin(angle) * mag * 0.5,
  };
}

function _dist(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
