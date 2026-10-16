'use strict';
// ---- Core: level data and physics. No DOM here, so it can be tested headlessly. ----
const TILE = 8, COLS = 32, ROWS = 16, PW = 14, PH = 10;
const WALK = 1, JUMP_V = 3, GRAV = 0.16, MAXFALL = 3.2, CONV = 0.5, LETHAL = 64, CRUMBLE_HP = 32;
const EMPTY = 0, WALL = 1, FLOOR = 2, CRUMBLE = 3, CONV_L = 4, CONV_R = 5, SPIKE = 6;
const GSIZE = { beetle: [12, 7], spider: [8, 7], bird: [12, 8], bee: [8, 5], armadillo: [14, 8], jaguar: [16, 9] };

// Maps are the 30x14 interior; the border walls are added by parseLevel.
// # wall  = floor  ~ crumbling floor  < > conveyor  ^ hazard  A ant hill  O portal (top-left of 2x2)  P start
// Guardians: [type, 'h', floorRow, minCol, maxCol, speed, colour] or [type, 'v', col, minRow, maxRow, speed, colour]
const LEVELS = [
  {
    name: 'Central Termite Mound', time: 180,
    pal: { bg: '#000000', wall: ['#c86428', '#5a2a0a'], floor: ['#d03030', '#ff8080'], crumble: '#a04040', conv: '#e0e0e0', spike: '#40d040', hazard: 'cactus', bar: '#d8d800' },
    map: [
      '.........................O....',
      '..A...........A...............',
      '======....=========....=======',
      '..............................',
      '..............................',
      '........======.......=====....',
      '..............................',
      '..A.......................A...',
      '=======.....==========....====',
      '..............................',
      '..............^...............',
      '.....=======.###.....=======..',
      '..............................',
      '.P....A..............^...A....',
    ],
    g: [['beetle', 'h', 15, 9, 19, 0.6, '#ff40ff'], ['beetle', 'h', 9, 13, 22, 0.5, '#40ffff']],
  },
  {
    name: 'The Sugar Bowl',
    pal: { bg: '#00002a', wall: ['#4060d0', '#102060'], floor: ['#e0e0e0', '#ffffff'], crumble: '#a0a0c0', conv: '#ffd040', spike: '#ff40ff', hazard: 'spike', bar: '#40e0ff' },
    map: [
      '..............................',
      '.A...........A..............A.',
      '====....<<<<<<<<<<<<<....=====',
      '..............................',
      '..............................',
      '.......=======......=======...',
      '..............................',
      '...A...........A..............',
      '>>>>>>>>.....======.....######',
      '..............................',
      '..............................',
      '...>>>>>>>>.......<<<<<<<<....',
      '..............O...............',
      '.P.....^...........^.......A..',
    ],
    g: [['beetle', 'h', 15, 9, 19, 0.7, '#ffff40'], ['bird', 'h', 11, 4, 26, 0.8, '#40ff40']],
  },
  {
    name: 'Armadillo Alley',
    pal: { bg: '#1a0a00', wall: ['#a06030', '#402000'], floor: ['#d0a040', '#ffe080'], crumble: '#c07030', conv: '#ffffff', spike: '#ff3030', hazard: 'spike', bar: '#ffa040' },
    map: [
      '..............................',
      '.A.......A.........A........A.',
      '~~~~..======..~~~~~~..========',
      '..............................',
      '..............................',
      '....~~~~~~~~.....~~~~~~~~~....',
      '..............................',
      '..............A...............',
      '======...============....=====',
      '..............................',
      '..............................',
      '..~~~~~~.....======.....~~~~~~',
      '...........................O..',
      '.P........^....A....^.........',
    ],
    g: [['armadillo', 'h', 15, 12, 20, 0.6, '#ffb060'], ['armadillo', 'h', 9, 10, 21, 0.8, '#ff60ff']],
  },
  {
    name: "The Spider's Larder",
    pal: { bg: '#000000', wall: ['#707070', '#303030'], floor: ['#40c0c0', '#a0ffff'], crumble: '#408080', conv: '#ffff40', spike: '#ffffff', hazard: 'spike', bar: '#a0a0a0' },
    map: [
      '..............................',
      'A....#..........A.......#....A',
      '=====#....============..#=====',
      '.....#..................#.....',
      '.....#..................#.....',
      '..======.....######.....====..',
      '..................#...........',
      '....A.............#......A....',
      '========....~~~~~~#.....======',
      '..............................',
      '..............................',
      '....====....>>>>>>>>....====..',
      'O.............................',
      '..P......^.........A.....^....',
    ],
    g: [['spider', 'v', 11, 4, 9, 0.5, '#ffffff'], ['spider', 'v', 23, 7, 13, 0.7, '#ff4040'], ['beetle', 'h', 12, 13, 20, 0.6, '#40ff40']],
  },
  {
    name: 'Jaguar Jungle Gym',
    pal: { bg: '#001400', wall: ['#208020', '#003000'], floor: ['#60c030', '#b0ff60'], crumble: '#5a8a2a', conv: '#ffff60', spike: '#ff8040', hazard: 'cactus', bar: '#60e040' },
    map: [
      '..............................',
      '..A......^..A.........^....A..',
      '.=============..=============.',
      '..............................',
      '..............................',
      '======....==========....======',
      '..............................',
      '....A.......^......^......A...',
      '..==========================..',
      '..............................',
      '..............................',
      '=====.....=========.....======',
      '..............O...............',
      '.P....^..A..............A..^..',
    ],
    g: [['jaguar', 'h', 9, 14, 19, 0.8, '#ffd040'], ['jaguar', 'h', 15, 9, 24, 1.0, '#ff8040'], ['bird', 'h', 5, 2, 29, 0.9, '#40ffff']],
  },
  {
    name: 'Conveyor of Crumbs',
    pal: { bg: '#200020', wall: ['#c040c0', '#400040'], floor: ['#ffa040', '#ffd090'], crumble: '#c08050', conv: '#40ffff', spike: '#ffff40', hazard: 'spike', bar: '#ff80ff' },
    map: [
      '..............................',
      '.A..........A...........A.....',
      '>>>>>>>>>>..<<<<<<<<<<..>>>>>>',
      '.........#..........#.........',
      '.........#..........#.........',
      '...<<<<<<#..~~~~~~..#>>>>>>...',
      '..............................',
      '......A.................A.....',
      '..>>>>>>>>>>.....<<<<<<<<<<...',
      '..............................',
      '..............A...............',
      '...=====....<<<<<<<<....=====.',
      '............................O.',
      '.P......^...........^.........',
    ],
    g: [['beetle', 'h', 9, 3, 12, 0.7, '#ff4040'], ['bee', 'v', 16, 7, 12, 0.6, '#ffff40'], ['beetle', 'h', 15, 10, 20, 0.8, '#40ff40']],
  },
  {
    name: 'The Beehive Bypass',
    pal: { bg: '#1a1400', wall: ['#d0a000', '#604000'], floor: ['#ffe040', '#fff0a0'], crumble: '#c0a030', conv: '#ffffff', spike: '#40ff40', hazard: 'cactus', bar: '#ffe040' },
    map: [
      '..............................',
      'A........A......A...........A.',
      '===....=====....=====....=====',
      '..............................',
      '..............................',
      '.....====....====....====.....',
      '..............................',
      '..............................',
      '..====....====....====....====',
      '..............................',
      '..............................',
      '=====....~~~~....~~~~....=====',
      'O.............................',
      '..P....^...A......A....^......',
    ],
    g: [['bee', 'v', 8, 2, 13, 0.7, '#ffffff'], ['bee', 'v', 16, 2, 13, 0.9, '#ff40ff'], ['bee', 'v', 24, 2, 13, 0.6, '#40ffff']],
  },
  {
    name: 'Snout of Eternity',
    pal: { bg: '#000018', wall: ['#3050a0', '#101838'], floor: ['#d04080', '#ff90c0'], crumble: '#a03060', conv: '#40ff80', spike: '#ffffff', hazard: 'spike', bar: '#ff60a0' },
    map: [
      '..............................',
      '.A............A............A..',
      '=====...~~~~#####~~~~...======',
      '..............................',
      '.............^...^............',
      '...>>>>>>...=======..<<<<<<...',
      '..............................',
      '....A...................A.....',
      '########.....~~~~.....########',
      '........#..............#......',
      '........#..............#......',
      '........#....<<<<<<....#====..',
      '..............O...............',
      '.P..^...............A...^.....',
    ],
    g: [['jaguar', 'h', 15, 9, 19, 1.0, '#ffff40'], ['spider', 'v', 21, 9, 13, 0.6, '#40ff40'], ['beetle', 'h', 6, 13, 19, 0.6, '#ff60ff']],
  },
  {
    name: "The Queen's Antechamber",
    pal: { bg: '#180000', wall: ['#a02020', '#400808'], floor: ['#e06030', '#ffa070'], crumble: '#b04020', conv: '#ffff40', spike: '#40ffff', hazard: 'spike', bar: '#ff5050' },
    map: [
      '..............................',
      'A....^...A...........^.......A',
      '====~~~~====....====~~~~======',
      '..............................',
      '..............................',
      '..<<<<<<<<..##..>>>>>>>>..##..',
      '..............................',
      '......A..........A............',
      '~~~~~~~~~~....~~~~~~~~....====',
      '..............................',
      '.........................A....',
      '..====....>>>>>>....<<<<<<=...',
      '............................O.',
      '.P...^...A..^......^......^...',
    ],
    g: [['armadillo', 'h', 15, 14, 19, 0.7, '#ffffff'], ['bird', 'h', 8, 2, 29, 1.1, '#ffff40'], ['beetle', 'h', 6, 17, 24, 0.7, '#40ffff']],
  },
  {
    name: 'The Royal Colony', time: 180,
    pal: { bg: '#100018', wall: ['#e0b030', '#604010'], floor: ['#b060ff', '#e0b0ff'], crumble: '#8040c0', conv: '#ff60ff', spike: '#ff4040', hazard: 'spike', bar: '#e0b030' },
    map: [
      '..............................',
      '.A....A....A......A....A....A.',
      '====~~~~======..======~~~~====',
      '..............................',
      '..............................',
      '....>>>>>.....##.....<<<<<....',
      '..............................',
      '..A.........^..^.........A....',
      '=======...==========...=======',
      '..............................',
      '..............A...............',
      '...~~~~~....======....~~~~~...',
      '..............O...............',
      '.P.A....^...........^....A....',
    ],
    g: [['jaguar', 'h', 15, 10, 20, 1.1, '#ffd040'], ['armadillo', 'h', 9, 1, 7, 0.8, '#ff60ff'], ['beetle', 'h', 9, 24, 30, 0.8, '#40ff40'],
        ['bird', 'h', 5, 2, 29, 1.2, '#ffffff'], ['bee', 'v', 15, 3, 10, 0.8, '#ff4040']],
  },
];

function makeGuard(spec, mul) {
  const [type, axis, a, b, c, sp, color] = spec;
  const [w, h] = GSIZE[type];
  const g = { type, axis, w, h, sp: sp * mul, color, dir: 1, frame: 0 };
  if (axis === 'h') { g.y = a * TILE - h; g.lo = b * TILE; g.hi = (c + 1) * TILE - w; g.x = g.lo; }
  else { g.x = a * TILE + ((TILE - w) >> 1); g.lo = b * TILE; g.hi = (c + 1) * TILE - h; g.y = g.lo; g.anchor = g.lo; }
  return g;
}

function updateGuard(g) {
  const k = g.axis === 'h' ? 'x' : 'y';
  g[k] += g.sp * g.dir;
  if (g[k] >= g.hi) { g[k] = g.hi; g.dir = -1; } else if (g[k] <= g.lo) { g[k] = g.lo; g.dir = 1; }
  g.frame += g.sp;
}

function parseLevel(def, lap) {
  const grid = new Uint8Array(COLS * ROWS), hp = new Float32Array(COLS * ROWS);
  const hills = []; let portal = null, start = { c: 2, r: 14 };
  for (let r = 0; r < ROWS; r++) {
    const row = (r === 0 || r === ROWS - 1) ? '#'.repeat(COLS) : '#' + (def.map[r - 1] || '').padEnd(30, '.').slice(0, 30) + '#';
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c; let t = EMPTY;
      switch (row[c]) {
        case '#': t = WALL; break;
        case '=': t = FLOOR; break;
        case '~': t = CRUMBLE; hp[i] = CRUMBLE_HP; break;
        case '<': t = CONV_L; break;
        case '>': t = CONV_R; break;
        case '^': t = SPIKE; break;
        case 'A': hills.push({ c, r, got: false }); break;
        case 'O': portal = { c, r }; break;
        case 'P': start = { c, r }; break;
      }
      grid[i] = t;
    }
  }
  const mul = 1 + 0.25 * (lap || 0);
  return { def, grid, hp, hills, portal, start, name: def.name, pal: def.pal, time: def.time || 150, guards: (def.g || []).map(s => makeGuard(s, mul)) };
}

function makePlayer(L) {
  return { x: L.start.c * TILE, y: (L.start.r + 1) * TILE - PH, vx: 0, vy: 0, air: false, apex: 0, facing: 1, walk: 0 };
}

function tileAt(L, c, r) { return (c < 0 || c >= COLS || r < 0 || r >= ROWS) ? WALL : L.grid[r * COLS + c]; }
function isWall(L, c, r) { return tileAt(L, c, r) === WALL; }
function isSupport(L, c, r) { const t = tileAt(L, c, r); return t >= WALL && t <= CONV_R; }
function colSpan(x) { return [Math.floor(x / TILE), Math.floor((x + PW - 0.001) / TILE)]; }
function rowSpan(y) { return [Math.floor(y / TILE), Math.floor((y + PH - 0.001) / TILE)]; }
function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

function groundInfo(L, p) {
  const feet = p.y + PH, r = Math.round(feet / TILE);
  const out = { supported: false, conv: 0, cr: [] };
  if (Math.abs(feet - r * TILE) > 0.001) return out;
  const [c0, c1] = colSpan(p.x);
  for (let c = c0; c <= c1; c++) {
    const t = tileAt(L, c, r);
    if (t >= WALL && t <= CONV_R) {
      out.supported = true;
      if (t === CONV_L) out.conv = -1; else if (t === CONV_R) out.conv = 1;
      else if (t === CRUMBLE) out.cr.push(r * COLS + c);
    }
  }
  return out;
}

function moveX(L, p, dx) {
  let nx = p.x + dx, blocked = false;
  const [r0, r1] = rowSpan(p.y);
  if (dx > 0) {
    const c = Math.floor((nx + PW - 0.001) / TILE);
    for (let r = r0; r <= r1; r++) if (isWall(L, c, r)) { nx = c * TILE - PW; blocked = true; break; }
  } else if (dx < 0) {
    const c = Math.floor(nx / TILE);
    for (let r = r0; r <= r1; r++) if (isWall(L, c, r)) { nx = (c + 1) * TILE; blocked = true; break; }
  }
  p.x = nx;
  return blocked;
}

// One 60 Hz tick. Jumps are committed arcs and walking off a ledge drops straight down, as in the original.
function stepPlayer(L, p, inp) {
  const ev = {};
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (!p.air) {
    if (inp.jump) {
      p.air = true; p.vy = -JUMP_V; p.vx = dir * WALK; p.apex = p.y;
      if (dir) p.facing = dir;
      ev.jumped = true;
    } else {
      const g = groundInfo(L, p);
      if (dir) p.facing = dir;
      const dx = dir * WALK + g.conv * CONV;
      if (dx) { const ox = p.x; moveX(L, p, dx); if (dir) p.walk += Math.abs(p.x - ox); }
      const g2 = groundInfo(L, p);
      if (!g2.supported) { p.air = true; p.vx = 0; p.vy = 0; p.apex = p.y; }
      else ev.crumbles = g2.cr;
    }
  }
  if (p.air) {
    p.vy = Math.min(p.vy + GRAV, MAXFALL);
    if (p.vx && moveX(L, p, p.vx)) p.vx = 0;
    const [c0, c1] = colSpan(p.x);
    if (p.vy < 0) {
      const ny = p.y + p.vy, r = Math.floor(ny / TILE);
      let hit = false;
      for (let c = c0; c <= c1; c++) if (isWall(L, c, r)) { hit = true; break; }
      if (hit) { p.y = (r + 1) * TILE; p.vy = 0; } else p.y = ny;
    } else {
      const feet = p.y + PH, nf = feet + p.vy;
      let landed = false;
      for (let t = Math.ceil(feet / TILE - 1e-9) * TILE; t <= nf + 1e-9; t += TILE) {
        const r = t / TILE;
        let s = false;
        for (let c = c0; c <= c1; c++) if (isSupport(L, c, r)) { s = true; break; }
        if (s) { p.y = t - PH; landed = true; break; }
      }
      if (!landed) p.y = nf - PH;
      else {
        p.air = false; p.vy = 0; p.vx = 0; ev.landed = true;
        if (p.y - p.apex > LETHAL) ev.fell = true;
      }
    }
    if (p.y < p.apex) p.apex = p.y;
  }
  return ev;
}

function touchesHazard(L, p) {
  const [c0, c1] = colSpan(p.x), r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + PH) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
    if (tileAt(L, c, r) === SPIKE && overlap(p.x + 1, p.y + 1, PW - 2, PH - 1, c * TILE + 1, r * TILE + 3, 6, 5)) return true;
  return false;
}
function hillsTouched(L, p) {
  const out = [];
  L.hills.forEach((h, i) => { if (!h.got && overlap(p.x - 3, p.y - 1, PW + 6, PH + 1, h.c * TILE + 1, h.r * TILE + 2, 6, 6)) out.push(i); });
  return out;
}
function touchesPortal(L, p) { const o = L.portal; return !!o && overlap(p.x, p.y, PW, PH, o.c * TILE + 4, o.r * TILE + 4, 8, 12); }
function hitsGuard(p, g) { return overlap(p.x + 2, p.y + 2, PW - 4, PH - 3, g.x + 1, g.y + 1, g.w - 2, g.h - 2); }

if (typeof module !== 'undefined') module.exports = { LEVELS, parseLevel, makePlayer, stepPlayer, touchesHazard, hillsTouched, touchesPortal, hitsGuard, updateGuard, TILE, PH };
