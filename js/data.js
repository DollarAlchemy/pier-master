/* ═══════════════════════════════════════════
   data.js — Pier Master
   Single source of truth for all game content.
   No DOM, no logic — pure data objects.
════════════════════════════════════════════ */

'use strict';

const FISH = [
  {
    id:       'goldfish',
    name:     'Goldfish',
    color:    '#f5a623',
    rarity:   1,
    goldVal:  5,
    depthMin: 0.05,
    depthMax: 0.45,
    speed:    1.2,
    size:     18,
    desc:     'A classic. Practically jumps onto your hook.',
  },
  {
    id:       'bluegill',
    name:     'Bluegill',
    color:    '#2196f3',
    rarity:   1,
    goldVal:  8,
    depthMin: 0.15,
    depthMax: 0.60,
    speed:    1.4,
    size:     20,
    desc:     'Curious and feisty. Common in shallow water.',
  },
  {
    id:       'clownfish',
    name:     'Clownfish',
    color:    '#ff5722',
    rarity:   2,
    goldVal:  18,
    depthMin: 0.30,
    depthMax: 0.75,
    speed:    1.0,
    size:     18,
    desc:     'Striking stripes. Worth finding.',
  },
  {
    id:       'pufferfish',
    name:     'Pufferfish',
    color:    '#8bc34a',
    rarity:   2,
    goldVal:  24,
    depthMin: 0.40,
    depthMax: 0.85,
    speed:    0.7,
    size:     24,
    desc:     'Slow but valuable. Handle with care.',
  },
  {
    id:       'swordfish',
    name:     'Swordfish',
    color:    '#607d8b',
    rarity:   3,
    goldVal:  45,
    depthMin: 0.55,
    depthMax: 1.0,
    speed:    2.0,
    size:     32,
    desc:     'Fast and deep. Puts up a real fight.',
  },
  {
    id:       'anglerfish',
    name:     'Anglerfish',
    color:    '#9c27b0',
    rarity:   4,
    goldVal:  80,
    depthMin: 0.70,
    depthMax: 1.0,
    speed:    0.8,
    size:     28,
    desc:     'Lurks in the deep dark. Extremely rare.',
  },
];

/* ── Rods ──────────────────────────────────
   winLow / winHigh: % range of QTE bar that counts as a catch
   speed:  QTE marker speed multiplier (1.0 = normal)
   special: null | 'fast' | 'wide' | 'rare' | 'double' | 'rainbow'
──────────────────────────────────────────── */
const RODS = [
  {
    id:       'starter',
    name:     'Starter Rod',
    emoji:    '🎣',
    price:    0,
    owned:    true,
    equipped: true,
    desc:     'Solid and dependable. The rod every pier legend begins with.',
    winLow:   32,
    winHigh:  68,
    speed:    1.0,
    special:  null,
  },
  {
    id:       'swift',
    name:     'Swift Cast',
    emoji:    '⚡',
    price:    80,
    owned:    false,
    equipped: false,
    desc:     'The marker flies. High skill, high reward.',
    winLow:   36,
    winHigh:  64,
    speed:    1.65,
    special:  'fast',
  },
  {
    id:       'steady',
    name:     'Steady Hand',
    emoji:    '🎯',
    price:    130,
    owned:    false,
    equipped: false,
    desc:     'Wider catch zone. Perfect for beginners leveling up.',
    winLow:   22,
    winHigh:  78,
    speed:    0.75,
    special:  'wide',
  },
  {
    id:       'deepdiver',
    name:     'Deep Diver',
    emoji:    '🔭',
    price:    220,
    owned:    false,
    equipped: false,
    desc:     'Pulls rare fish from the deep. Worth the investment.',
    winLow:   30,
    winHigh:  70,
    speed:    1.0,
    special:  'rare',
  },
  {
    id:       'lucky',
    name:     'Lucky Lure',
    emoji:    '🍀',
    price:    260,
    owned:    false,
    equipped: false,
    desc:     '40% chance to haul in a second fish on every catch.',
    winLow:   30,
    winHigh:  70,
    speed:    1.0,
    special:  'double',
  },
  {
    id:       'rainbow',
    name:     'Rainbow Rod',
    emoji:    '🌈',
    price:    450,
    owned:    false,
    equipped: false,
    desc:     'Catches anything, anywhere. Pure dock magic.',
    winLow:   18,
    winHigh:  82,
    speed:    1.1,
    special:  'rainbow',
  },
];

/* ── Quests ────────────────────────────────
   condition types:
     total      — state.totalCaught >= count
     fish       — state.catches[fish] >= count
     fish_rod   — state.catchRodLog[fish+'_'+rod] >= count
     rods_owned — rods owned >= count
     species    — unique species caught >= count
──────────────────────────────────────────── */
const QUESTS = [
  {
    id:       'first_cast',
    name:     'First Cast',
    desc:     'Catch any fish for the very first time.',
    condition:{ type: 'total', count: 1 },
    reward:   30,
  },
  {
    id:       'goldfish_3',
    name:     'Goldfish Getter',
    desc:     'Catch 3 Goldfish.',
    condition:{ type: 'fish', fish: 'goldfish', count: 3 },
    reward:   50,
  },
  {
    id:       'bluegill_starter',
    name:     'Blue Streak',
    desc:     'Catch 2 Bluegill using the Starter Rod.',
    condition:{ type: 'fish_rod', fish: 'bluegill', rod: 'starter', count: 2 },
    reward:   75,
  },
  {
    id:       'clown_3',
    name:     'Clown Around',
    desc:     'Catch 3 Clownfish.',
    condition:{ type: 'fish', fish: 'clownfish', count: 3 },
    reward:   80,
  },
  {
    id:       'puffer_deep',
    name:     'Puff Daddy',
    desc:     'Catch 2 Pufferfish with the Deep Diver rod.',
    condition:{ type: 'fish_rod', fish: 'pufferfish', rod: 'deepdiver', count: 2 },
    reward:   160,
  },
  {
    id:       'first_sword',
    name:     'Blade Runner',
    desc:     'Land a Swordfish.',
    condition:{ type: 'fish', fish: 'swordfish', count: 1 },
    reward:   100,
  },
  {
    id:       'rods_3',
    name:     'The Reel Deal',
    desc:     'Own 3 different rods.',
    condition:{ type: 'rods_owned', count: 3 },
    reward:   120,
  },
  {
    id:       'total_15',
    name:     'Bucket Half Full',
    desc:     'Catch 15 fish in total.',
    condition:{ type: 'total', count: 15 },
    reward:   180,
  },
  {
    id:       'anglerfish_1',
    name:     'Legend of the Deep',
    desc:     'Catch an Anglerfish.',
    condition:{ type: 'fish', fish: 'anglerfish', count: 1 },
    reward:   250,
  },
  {
    id:       'all_species',
    name:     'Pier Master',
    desc:     'Catch every species at least once.',
    condition:{ type: 'species', count: FISH.length },
    reward:   500,
  },
];

/* ── Fish pool helper ──────────────────────
   Returns weighted random fish type.
   rod.special = 'rare'    → bias toward rarity 3+
   rod.special = 'rainbow' → all fish equally
──────────────────────────────────────────── */
function pickFishForRod(rod) {
  let pool = FISH;

  if (rod && rod.special === 'rare') {
    pool = FISH.filter(f => f.rarity >= 2);
  }

  /* Weight = (5 - rarity)² so common fish appear more, but rare are still catchable */
  const weights = pool.map(f =>
    rod && rod.special === 'rainbow' ? 1 : Math.pow(5 - f.rarity, 2)
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
