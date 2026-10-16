
// ---- Presentation: layout, rendering, sound, input and the game state machine ----
(function () {
  const W = 256, S = 4, FIELD_H = 128;
  // 'tall' is the classic 256x192 screen; 'wide' is 256x144 (16:9) with a two-row status strip,
  // used whenever it makes the playfield bigger (landscape phones, wide desktop windows).
  let H = 192, MODE = 'tall';
  const cv = document.getElementById('screen');
  const ctx = cv.getContext('2d');
  function setMode(m) {
    if (m === MODE && cv.width === W * S) return;
    MODE = m; H = m === 'wide' ? 144 : 192;
    cv.width = W * S; cv.height = H * S;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  setMode('tall');
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const isStandalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  let touchUI = false;

  // ---------- sprites ----------
  function makeSprite(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const col = pal[rows[j][i]];
      if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    }
    return c;
  }
  const flip = rows => rows.map(r => [...r].reverse().join(''));
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  const ANT_TOP = [
    'tt................',
    'ttt....bbbbb......',
    'tttt..bbbbbbbb....',
    '.tttbbbbbbbbbbb...',
    '..ttbbbwwddbbbeb..',
    '...tbbbwwddbbbnnnn',
    '....bbbbbbbbbb....',
  ];
  const ANT_A = ANT_TOP.concat(['....ll.ll...ll.ll.', '....ll.ll...ll.ll.', '...ddd.dd..ddd.dd.']);
  const ANT_B = ANT_TOP.concat(['.....lll.....lll..', '.....lll.....lll..', '.....ddd.....ddd..']);
  const ANT_PAL = { t: '#6e4b2a', b: '#bca37c', w: '#f4efe1', d: '#3a2614', n: '#a38b66', e: '#111111', l: '#8c714f' };
  const ANT = {
    R: [makeSprite(ANT_A, ANT_PAL), makeSprite(ANT_B, ANT_PAL)],
    L: [makeSprite(flip(ANT_A), ANT_PAL), makeSprite(flip(ANT_B), ANT_PAL)],
  };

  const GR = {
    beetle: [
      ['...xxxxxx...', '..xhxxxxxx..', '.xxxxxxxxxkk', '.xxxxxxxxxxk', '..xxxxxxxx..', '.l.l.l.l.l..', 'l.l.l.l.l...'],
      ['...xxxxxx...', '..xhxxxxxx..', '.xxxxxxxxxkk', '.xxxxxxxxxxk', '..xxxxxxxx..', '..l.l.l.l.l.', '.l.l.l.l.l..'],
    ],
    spider: [
      ['..xxxx..', '.xhxxhx.', 'lxxxxxxl', 'l.xxxx.l', '.l.xx.l.', 'l..ll..l', '.l....l.'],
      ['..xxxx..', '.xhxxhx.', '.lxxxxl.', 'l.xxxx.l', 'l..xx..l', '.l....l.', 'l......l'],
    ],
    bird: [
      ['...x........', '...xx.......', '....xx......', '..xxxxxxxh..', '.xxxxxxxxxyy', 'xx..xxxxx...', '............', '............'],
      ['............', '............', '............', '..xxxxxxxh..', '.xxxxxxxxxyy', 'xx..xxxxx...', '....xx......', '...xx.......'],
    ],
    bee: [
      ['.hh..hh.', '..hhhh..', '.xkxkxk.', 'xxkxkxkk', '.xkxkxk.'],
      ['........', 'hhhhhhhh', '.xkxkxk.', 'xxkxkxkk', '.xkxkxk.'],
    ],
    armadillo: [
      ['....xxxxx.....', '..xxkxxkxxx...', '.xxkxxkxxkxxx.', 'xxkxxkxxkxxxhx', 'xxxxxxxxxxxxxx', '.xxxxxxxxxxxx.', '..ll..ll..ll..', '..ll..ll..ll..'],
      ['....xxxxx.....', '..xxkxxkxxx...', '.xxkxxkxxkxxx.', 'xxkxxkxxkxxxhx', 'xxxxxxxxxxxxxx', '.xxxxxxxxxxxx.', '...ll..ll..ll.', '...ll..ll..ll.'],
    ],
    jaguar: [
      ['.............x.x', 'x...........xxxx', '.x..xxxxxxxxxhxk', '..xxxkxxkxxkxxxx', '..xkxxxkxxxkxxx.', '..xxxxxxxxxxxx..', '..xx.xx...xx.xx.', '..xx.xx...xx.xx.', '..kk.kk...kk.kk.'],
      ['.............x.x', 'x...........xxxx', '.x..xxxxxxxxxhxk', '..xxxkxxkxxkxxxx', '..xkxxxkxxxkxxx.', '..xxxxxxxxxxxx..', '...xxxx...xxxx..', '...xxxx...xxxx..', '...kk.kk..kk.kk.'],
    ],
  };
  const gCache = {};
  function guardSprite(g, f) {
    const left = g.axis === 'h' && g.dir < 0;
    const key = g.type + g.color + f + left;
    if (!gCache[key]) {
      const pal = { x: g.color, h: '#ffffff', k: shade(g.color, 0.45), l: shade(g.color, 0.7), y: '#ffd000' };
      const rows = GR[g.type][f];
      gCache[key] = makeSprite(left ? flip(rows) : rows, pal);
    }
    return gCache[key];
  }

  const HILL = makeSprite([
    '........', '...mm...', '..mhmm..', '..mmom..', '.mhmmmm.', '.mmmmhm.', 'mmmmmmmm', 'mmmmmmmm',
  ], { m: '#c47a3c', h: '#f2b26a', o: '#2a1206' });
  const HILL_PATH = [[1, 6], [1, 5], [2, 4], [2, 3], [3, 2], [3, 1], [4, 1], [5, 2], [5, 3], [6, 4], [6, 5], [7, 6], [6, 7], [4, 7], [2, 7]];

  const SPIKE_ROWS = ['........', '........', '..#...#.', '..#...#.', '.###.###', '.###.###', '#######.', '########'];
  const CACTUS_ROWS = ['...##...', '...##.#.', '.#.##.#.', '.#.####.', '.####...', '...##...', '...##...', '..####..'];
  let tiles = null;
  function buildTiles(pal) {
    const wall = document.createElement('canvas'); wall.width = wall.height = 8;
    let x = wall.getContext('2d');
    x.fillStyle = pal.wall[0]; x.fillRect(0, 0, 8, 8);
    x.fillStyle = pal.wall[1]; x.fillRect(0, 3, 8, 1); x.fillRect(0, 7, 8, 1); x.fillRect(3, 0, 1, 3); x.fillRect(7, 4, 1, 3);
    const floor = document.createElement('canvas'); floor.width = floor.height = 8;
    x = floor.getContext('2d');
    x.fillStyle = pal.floor[0]; x.fillRect(0, 0, 8, 5);
    x.fillStyle = pal.floor[1]; x.fillRect(0, 0, 8, 1);
    x.fillStyle = pal.floor[0];
    for (let i = 0; i < 8; i += 2) { x.fillRect(i, 5, 1, 1); x.fillRect(i + 1, 6, 1, 1); }
    const spike = makeSprite(pal.hazard === 'cactus' ? CACTUS_ROWS : SPIKE_ROWS, { '#': pal.spike });
    return { wall, floor, spike };
  }

  // ---------- text ----------
  function text(s, x, y, col, align, size) {
    ctx.font = `${size || 8}px "Press Start 2P", "Courier New", monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = align || 'left';
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  const pad6 = n => String(n).padStart(6, '0');
  const pad2 = n => String(n).padStart(2, '0');
  const RAINBOW = ['#ff4040', '#ffa040', '#ffff40', '#40ff40', '#40ffff', '#4080ff', '#ff40ff'];

  // ---------- sound and haptics ----------
  let AC = null, master = null, musicOn = true, nextNote = 0, noteIdx = 0;
  function ensureAudio() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
      } catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  }
  function tone(f0, f1, dur, type, vol, when) {
    if (!AC) return;
    const t = AC.currentTime + (when || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function note(f, t, dur) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.035, t); g.gain.setValueAtTime(0.035, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.01);
  }
  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* no haptics */ } }
  const sfx = {
    jump: () => tone(260, 620, 0.16, 'square', 0.04),
    slurp: () => { tone(1400, 160, 0.22, 'sawtooth', 0.05); tone(700, 90, 0.3, 'square', 0.03, 0.05); buzz(12); },
    open: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'square', 0.05, i * 0.08)); buzz([20, 40, 20]); },
    death: () => { tone(700, 50, 0.7, 'sawtooth', 0.07); buzz([70, 40, 140]); },
    blip: f => tone(f, f, 0.03, 'square', 0.03),
    life: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, 0.08, 'square', 0.05, i * 0.06)),
    stomp: () => { tone(140, 30, 0.5, 'sawtooth', 0.12); tone(90, 40, 0.4, 'square', 0.08, 0.02); buzz(200); },
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.16, 'square', 0.05, i * 0.13)),
  };
  // In the Hall of the Mountain King (Grieg, public domain), as a one-channel beeper loop.
  const NF = { B3: 246.94, C4: 261.63, Cs4: 277.18, D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Gs4: 415.3, A4: 440, As4: 466.16, B4: 493.88, C5: 523.25, Cs5: 554.37, E5: 659.25, Fs5: 739.99 };
  const PA = [['B3', 1], ['Cs4', 1], ['D4', 1], ['E4', 1], ['Fs4', 1], ['D4', 1], ['Fs4', 2], ['F4', 1], ['Cs4', 1], ['F4', 2], ['E4', 1], ['C4', 1], ['E4', 2],
    ['B3', 1], ['Cs4', 1], ['D4', 1], ['E4', 1], ['Fs4', 1], ['D4', 1], ['Fs4', 1], ['B4', 1], ['A4', 1], ['Fs4', 1], ['D4', 1], ['Fs4', 1], ['A4', 4]];
  const PB = [['Fs4', 1], ['Gs4', 1], ['As4', 1], ['B4', 1], ['Cs5', 1], ['As4', 1], ['Cs5', 2], ['C5', 1], ['Gs4', 1], ['C5', 2], ['B4', 1], ['G4', 1], ['B4', 2],
    ['Fs4', 1], ['Gs4', 1], ['As4', 1], ['B4', 1], ['Cs5', 1], ['As4', 1], ['Cs5', 1], ['Fs5', 1], ['E5', 1], ['Cs5', 1], ['As4', 1], ['Cs5', 1], ['E5', 4]];
  const TUNE = PA.concat(PA, PB, PA).map(([n, u]) => [NF[n], u]);
  function runMusic() {
    if (!AC) return;
    if (!(musicOn && state === 'play' && !paused)) { nextNote = 0; return; }
    const unit = Math.max(0.09, 0.14 - lap * 0.015);
    if (nextNote < AC.currentTime) nextNote = AC.currentTime + 0.05;
    while (nextNote < AC.currentTime + 0.2) {
      const [f, u] = TUNE[noteIdx];
      note(f, nextNote, u * unit * 0.92);
      nextNote += u * unit;
      noteIdx = (noteIdx + 1) % TUNE.length;
    }
  }

  // ---------- state ----------
  let state = 'title', stateT = 0, tick = 0, paused = false;
  let levelIdx = 0, startLevel = 0, lap = 0, L = null, P = null;
  let score = 0, hi = 0, lives = 3, nextLife = 10000, energy = 1, portalOpen = false, tallyWait = 0;
  let slurp = 0, slurpTarget = null, parts = [];
  const input = { left: false, right: false, jump: false };
  const keys = { left: false, right: false, jump: false };
  const touchIn = { left: false, right: false, jump: false };
  const padIn = { left: false, right: false, jump: false };
  let swipePulse = 0;
  try { hi = parseInt(localStorage.getItem('manic-anteater-hi') || '0', 10) || 0; } catch (e) { hi = 0; }
  function saveHi() { try { localStorage.setItem('manic-anteater-hi', String(hi)); } catch (e) { /* storage unavailable */ } }

  function startGame() { keepAwake(); score = 0; lives = 3; lap = 0; levelIdx = startLevel; nextLife = 10000; noteIdx = 0; loadLevel(); }
  function loadLevel() {
    L = parseLevel(LEVELS[levelIdx], lap);
    P = makePlayer(L);
    energy = 1; parts = []; slurp = 0; slurpTarget = null; tallyWait = 0;
    tiles = buildTiles(L.pal);
    portalOpen = L.hills.length === 0;
    state = 'enter'; stateT = 0;
  }
  function addScore(n) {
    score += n;
    if (score >= nextLife) { lives++; nextLife += 10000; sfx.life(); }
    if (score > hi) hi = score;
  }
  function die() { state = 'dying'; stateT = 0; sfx.death(); }
  function collect(i) {
    const h = L.hills[i];
    h.got = true; addScore(100);
    slurp = 14; slurpTarget = h;
    for (let k = 0; k < 7; k++) parts.push({ x: h.c * 8 + 1 + Math.random() * 6, y: h.r * 8 + 2 + Math.random() * 5, d: k * 2 });
    sfx.slurp();
    if (L.hills.every(q => q.got)) { portalOpen = true; sfx.open(); }
  }
  function snout() { return { x: P.facing > 0 ? P.x + 16 : P.x - 2, y: P.y + 5 }; }

  function updatePlay() {
    energy -= 1 / (60 * L.time);
    if (energy <= 0) { energy = 0; die(); return; }
    for (const g of L.guards) updateGuard(g);
    const ev = stepPlayer(L, P, input);
    if (ev.jumped) sfx.jump();
    if (ev.crumbles) for (const i of ev.crumbles) { L.hp[i] -= 1; if (L.hp[i] <= 0) L.grid[i] = 0; }
    if (ev.fell || touchesHazard(L, P) || P.y > FIELD_H) { die(); return; }
    for (const g of L.guards) if (hitsGuard(P, g)) { die(); return; }
    for (const i of hillsTouched(L, P)) collect(i);
    if (portalOpen && touchesPortal(L, P)) { state = 'tally'; stateT = 0; sfx.open(); }
    if (slurp > 0) slurp--;
    const s = snout();
    parts = parts.filter(p => {
      if (p.d > 0) { p.d--; return true; }
      p.x += (s.x - p.x) * 0.25; p.y += (s.y - p.y) * 0.25;
      return Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 1.5;
    });
  }
  function readInput() {
    pollPad();
    input.left = keys.left || touchIn.left || padIn.left;
    input.right = keys.right || touchIn.right || padIn.right;
    input.jump = keys.jump || touchIn.jump || padIn.jump || swipePulse > 0;
    if (swipePulse > 0) swipePulse--;
  }
  function update() {
    tick++;
    readInput();
    if (paused) return;
    stateT++;
    switch (state) {
      case 'enter': if (stateT > 50) state = 'play'; break;
      case 'play': updatePlay(); break;
      case 'dying':
        if (stateT >= 60) {
          if (lives <= 0) { state = 'gameover'; stateT = 0; saveHi(); }
          else { lives--; loadLevel(); }
        }
        break;
      case 'tally':
        if (energy > 0) {
          const d = Math.min(energy, 0.008);
          energy -= d; addScore(Math.round(d * 1250));
          if (stateT % 3 === 0) sfx.blip(300 + energy * 900);
        } else if (++tallyWait > 40) {
          levelIdx++; saveHi();
          if (levelIdx >= LEVELS.length) { addScore(5000); saveHi(); state = 'win'; stateT = 0; sfx.win(); }
          else loadLevel();
        }
        break;
      case 'gameover':
        if (stateT === 40) sfx.stomp();
        if (stateT > 420) toTitle();
        break;
    }
  }
  function toTitle() { state = 'title'; stateT = 0; saveHi(); }
  function onStart() {
    ensureAudio();
    if (paused) { paused = false; syncButtons(); return; }
    if (state === 'title') startGame();
    else if (state === 'enter') state = 'play';
    else if (state === 'gameover' && stateT > 70) toTitle();
    else if (state === 'win' && stateT > 60) { lap++; levelIdx = 0; loadLevel(); }
  }
  const pausable = () => state !== 'title' && state !== 'gameover' && state !== 'win';
  function togglePause() { if (pausable()) paused = !paused; syncButtons(); }
  function toggleMusic() { musicOn = !musicOn; syncButtons(); }
  function changeStart(d) { startLevel = (startLevel + d + LEVELS.length) % LEVELS.length; sfx.blip(600); }

  // ---------- drawing ----------
  function drawField() {
    const pal = L.pal;
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, FIELD_H);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 32; c++) {
      const i = r * 32 + c, t = L.grid[i], x = c * 8, y = r * 8;
      if (!t) continue;
      if (t === 1) ctx.drawImage(tiles.wall, x, y);
      else if (t === 2) ctx.drawImage(tiles.floor, x, y);
      else if (t === 6) ctx.drawImage(tiles.spike, x, y);
      else if (t === 3) {
        const vh = Math.max(1, Math.ceil(5 * L.hp[i] / 32));
        ctx.fillStyle = pal.crumble; ctx.fillRect(x, y + 5 - vh, 8, vh);
        ctx.fillStyle = pal.floor[1]; ctx.fillRect(x, y + 5 - vh, 8, 1);
        ctx.fillStyle = pal.bg; ctx.fillRect(x + 2, y + 6 - vh, 1, 1); ctx.fillRect(x + 6, y + 4, 1, 1);
        ctx.fillStyle = pal.crumble; ctx.fillRect(x + 1, y + 6, 1, 1); ctx.fillRect(x + 4, y + 6, 1, 1);
      } else {
        const dir = t === 4 ? -1 : 1;
        ctx.fillStyle = pal.conv; ctx.fillRect(x, y, 8, 3);
        ctx.fillStyle = pal.bg;
        const off = ((Math.floor(tick / 3) * dir) % 4 + 4) % 4;
        ctx.fillRect(x + off, y + 1, 2, 1); ctx.fillRect(x + ((off + 4) % 8), y + 1, 2, 1);
        ctx.fillStyle = shade(pal.conv, 0.55); ctx.fillRect(x + 1, y + 3, 2, 2); ctx.fillRect(x + 5, y + 3, 2, 2);
      }
    }
    L.hills.forEach((h, n) => {
      if (h.got) return;
      const x = h.c * 8, y = h.r * 8;
      ctx.drawImage(HILL, x, y);
      ctx.fillStyle = '#1a0800';
      for (let k = 0; k < 2; k++) {
        const pt = HILL_PATH[(Math.floor(tick / 7) + n * 4 + k * 7) % HILL_PATH.length];
        ctx.fillRect(x + pt[0], y + pt[1], 1, 1);
      }
    });
    if (L.portal) drawPortal(L.portal.c * 8, L.portal.r * 8);
  }
  function drawPortal(x, y) {
    ctx.fillStyle = L.pal.wall[0]; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = L.pal.wall[1]; ctx.fillRect(x, y + 4, 16, 1); ctx.fillRect(x, y + 10, 16, 1);
    if (portalOpen) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = RAINBOW[(Math.floor(tick / (reduceMotion ? 12 : 4)) + k) % RAINBOW.length];
        ctx.fillRect(x + 2 + k * 2, y + 2 + k * 2, 12 - k * 4, 12 - k * 4);
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y + 7, 2, 2);
    } else {
      ctx.fillStyle = '#000000'; ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.fillStyle = shade(L.pal.wall[0], 0.6);
      for (let i = 0; i < 12; i += 3) { ctx.fillRect(x + 2 + i, y + 2, 1, 12); }
    }
  }
  function drawGuards() {
    for (const g of L.guards) {
      const f = (g.type === 'bee' || g.type === 'bird') ? Math.floor(tick / 5) % 2 : Math.floor(g.frame / 4) % 2;
      if (g.type === 'spider') {
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(Math.round(g.x) + 3, g.anchor - 2, 1, Math.max(0, Math.round(g.y) - g.anchor + 2));
      }
      ctx.drawImage(guardSprite(g, f), Math.round(g.x), Math.round(g.y));
    }
  }
  function drawPlayer() {
    const f = P.air ? 0 : Math.floor(P.walk / 5) % 2;
    const sx = Math.round(P.x) - 2, sy = Math.round(P.y);
    ctx.drawImage((P.facing > 0 ? ANT.R : ANT.L)[f], sx, sy);
    if (slurp > 0 && slurpTarget) {
      const s = snout(), tx = slurpTarget.c * 8 + 4, ty = slurpTarget.r * 8 + 4;
      const k = slurp > 7 ? (14 - slurp) / 7 : slurp / 7;
      const ex = s.x + (tx - s.x) * k, ey = s.y + (ty - s.y) * k;
      const n = Math.max(1, Math.round(Math.max(Math.abs(ex - s.x), Math.abs(ey - s.y))));
      ctx.fillStyle = '#ff6f93';
      for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(s.x + (ex - s.x) * i / n), Math.round(s.y + (ey - s.y) * i / n), 1, 1);
    }
    ctx.fillStyle = '#ff4a2a';
    for (const p of parts) if (p.d <= 0) ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  function energyBar(x, y, w) {
    ctx.fillStyle = '#2a0c0c'; ctx.fillRect(x, y, w, 8);
    const low = energy < 0.2 && Math.floor(tick / 10) % 2;
    ctx.fillStyle = low ? '#ff4040' : '#f2f2f2'; ctx.fillRect(x + 2, y + 2, Math.round((w - 4) * energy), 4);
  }
  function drawStatus() {
    const got = L.hills.filter(h => h.got).length;
    const hillCol = portalOpen ? '#40ff40' : '#40ffff';
    ctx.fillStyle = '#000000'; ctx.fillRect(0, FIELD_H, W, H - FIELD_H);
    if (MODE === 'wide') {
      // two-row strip: energy and level, then score, hills and lives
      ctx.fillStyle = '#b01c1c'; ctx.fillRect(0, 128, 52, 8);
      text('ENERGY', 2, 128, '#ffffff');
      energyBar(52, 128, 164);
      ctx.fillStyle = L.pal.bar; ctx.fillRect(216, 128, 40, 8);
      text('L' + pad2(levelIdx + 1), 236, 128, '#000000', 'center');
      text('SCORE ' + pad6(score), 0, 136, '#ffff40');
      text(`HILLS ${got}/${L.hills.length}`, 148, 136, hillCol, 'center');
      text('LIVES ' + lives, 256, 136, '#ffffff', 'right');
      return;
    }
    ctx.fillStyle = L.pal.bar; ctx.fillRect(0, 128, W, 9);
    text(L.name.toUpperCase(), 128, 129, '#000000', 'center');
    ctx.fillStyle = '#b01c1c'; ctx.fillRect(0, 139, 56, 8);
    text('ENERGY', 4, 139, '#ffffff');
    energyBar(56, 139, 200);
    text('HI ' + pad6(hi), 0, 151, '#ffff40');
    text('SCORE ' + pad6(score), 256, 151, '#ffff40', 'right');
    const shown = Math.min(lives, 8);
    for (let i = 0; i < shown; i++) {
      const f = state === 'play' ? Math.floor((tick + i * 7) / 10) % 2 : 0;
      ctx.drawImage(ANT.R[f], 2 + i * 21, 164);
    }
    text(`HILLS ${got}/${L.hills.length}`, 256, 166, hillCol, 'right');
    text(`LEVEL ${pad2(levelIdx + 1)}/10${lap ? '  LAP ' + (lap + 1) : ''}`, 0, 182, '#8f8f9f');
    if (!touchUI) text(musicOn ? 'M:MUSIC ON' : 'M:MUSIC OFF', 256, 182, '#8f8f9f', 'right');
  }
  function panel(lines, y) {
    const h = lines.length * 12 + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(16, y, 224, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(16, y, 224, 1); ctx.fillRect(16, y + h - 1, 224, 1);
    lines.forEach(([s, c], i) => text(s, 128, y + 6 + i * 12, c, 'center'));
  }
  function drawTitle() {
    const wide = MODE === 'wide';
    // y positions for the classic and the 16:9 screen
    const Y = wide
      ? { w1: 4, w2: 22, ant: 42, ground: 62, l1: 68, l2: 79, l3: -1, start: 92, name: 103, press: 118, hi: 132 }
      : { w1: 12, w2: 32, ant: 68, ground: 88, l1: 100, l2: 111, l3: 122, start: 140, name: 151, press: 166, hi: 182 };
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    const word = (s, y) => {
      const x0 = 128 - s.length * 8;
      [...s].forEach((ch, i) => text(ch, x0 + i * 16, y, RAINBOW[(i + (reduceMotion ? 0 : Math.floor(tick / 8))) % RAINBOW.length], 'left', 16));
    };
    word('MANIC', Y.w1); word('ANTEATER', Y.w2);
    // a short attract loop: the anteater strolls along slurping up a row of hills
    const ax = (tick * 0.7) % 330 - 50;
    ctx.fillStyle = '#c86428'; ctx.fillRect(0, Y.ground, W, 2);
    ctx.fillStyle = '#5a2a0a'; ctx.fillRect(0, Y.ground + 2, W, 1);
    for (const hx of [40, 85, 130, 175, 220]) if (ax + 34 < hx) ctx.drawImage(HILL, hx, Y.ground - 8, 8, 8);
    ctx.drawImage(ANT.R[Math.floor(tick / 8) % 2], Math.round(ax), Y.ant, 36, 20);
    text('SLURP UP EVERY ANT HILL,', 128, Y.l1, '#ffffff', 'center');
    text('THEN DIVE INTO THE PORTAL.', 128, Y.l2, '#ffffff', 'center');
    if (Y.l3 > 0) text('DODGE THE BEASTS. MIND THE DROP.', 128, Y.l3, '#a0a0b0', 'center');
    text(`START LEVEL  < ${pad2(startLevel + 1)} >`, 128, Y.start, '#40ffff', 'center');
    text(LEVELS[startLevel].name.toUpperCase(), 128, Y.name, '#3aa0a0', 'center');
    const prompt = touchUI ? 'TAP JUMP TO PLAY' : 'PRESS ENTER OR TAP TO PLAY';
    if (Math.floor(tick / 30) % 2 === 0 || reduceMotion) text(prompt, 128, Y.press, '#ffff40', 'center');
    text('HI-SCORE ' + pad6(hi), 128, Y.hi, '#ff8040', 'center');
  }
  function drawBoot(x, y) {
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(x + 6, y, 12, 15); ctx.fillRect(x, y + 13, 24, 7);
    ctx.fillStyle = '#9c6230'; ctx.fillRect(x + 5, y, 14, 3); ctx.fillRect(x + 1, y + 13, 6, 2);
    ctx.fillStyle = '#e8d8b0'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 10, y + 5 + i * 3, 4, 1);
    ctx.fillStyle = '#20140a'; ctx.fillRect(x, y + 20, 24, 2);
  }
  function drawGameOver() {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, FIELD_H);
    ctx.fillStyle = '#c86428'; ctx.fillRect(0, 110, W, 2);
    const by = Math.min(88, -30 + stateT * 3);
    if (by < 88) ctx.drawImage(ANT.R[0], 119, 100);
    else { ctx.fillStyle = '#bca37c'; ctx.fillRect(112, 108, 32, 2); }
    drawBoot(116, by);
    if (stateT > 40) {
      [...'GAME OVER'].forEach((ch, i) => text(ch, 56 + i * 16, 36, RAINBOW[(i + Math.floor(tick / 6)) % RAINBOW.length], 'left', 16));
      text('FINAL SCORE ' + pad6(score), 128, 60, '#ffffff', 'center');
    }
    drawStatus();
  }
  function drawWin() {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, FIELD_H);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = RAINBOW[i % RAINBOW.length];
      const x = (i * 53 + tick * (1 + (i % 3))) % 256, y = (i * 29 + Math.floor(tick * 0.5 * (1 + (i % 2)))) % 128;
      ctx.fillRect(x, y, 1, 1);
    }
    text('THE ROYAL COLONY', 128, 18, '#ffff40', 'center');
    text('IS ALL SLURPED UP!', 128, 30, '#ffff40', 'center');
    const bob = reduceMotion ? 0 : Math.round(Math.sin(tick / 8) * 3);
    ctx.drawImage(ANT.R[Math.floor(tick / 8) % 2], 110, 50 + bob, 36, 20);
    text('BONUS 5000', 128, 84, '#40ff40', 'center');
    text(`${touchUI ? 'JUMP' : 'ENTER'}: LAP ${lap + 2}, FASTER BEASTS`, 128, 104, '#40ffff', 'center');
    drawStatus();
  }
  function render() {
    if (state === 'title') { drawTitle(); return; }
    if (state === 'gameover') { drawGameOver(); return; }
    if (state === 'win') { drawWin(); return; }
    drawField(); drawGuards();
    if (state !== 'tally') drawPlayer();
    if (state === 'dying') {
      ctx.fillStyle = reduceMotion ? 'rgba(255,40,40,0.35)' : (Math.floor(stateT / 4) % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,0,0,0.35)');
      ctx.fillRect(0, 0, W, FIELD_H);
    }
    if (state === 'enter') panel([[L.name.toUpperCase(), '#ffff40'], [`LEVEL ${levelIdx + 1} OF 10`, '#ffffff'], [Math.floor(stateT / 8) % 2 ? 'GET READY' : '', '#40ffff']], 40);
    if (state === 'tally' && energy <= 0) panel([['LEVEL CLEARED!', '#40ff40']], 52);
    if (paused) panel([['PAUSED', '#ffff40'], [touchUI ? 'TAP JUMP TO RESUME' : 'P OR ENTER TO RESUME', '#ffffff']], 46);
    drawStatus();
  }

  // ---------- layout: fit the screen to whatever the device gives us ----------
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  function insets() {
    const s = getComputedStyle(probe);
    return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
  }
  function layout() {
    touchUI = matchMedia('(pointer: coarse)').matches;
    const vw = window.innerWidth, vh = window.innerHeight, I = insets();
    const land = vw > vh;
    root.classList.toggle('touch', touchUI);
    root.classList.toggle('land', touchUI && land);
    root.classList.toggle('port', touchUI && !land);
    root.classList.toggle('installed', isStandalone());
    let aw, ah;
    if (touchUI && land) {
      const side = Math.round(Math.min(190, Math.max(100, vw * 0.14)));
      root.style.setProperty('--side', side + 'px');
      aw = vw - Math.max(6, I.l) - Math.max(6, I.r) - 2 * side - 16;
      ah = vh - Math.max(6, I.t) - Math.max(6, I.b);
    } else if (touchUI) {
      const controls = Math.max(220, vh * 0.3);
      aw = vw - Math.max(6, I.l) - Math.max(6, I.r);
      ah = vh - Math.max(6, I.t) - Math.max(6, I.b) - controls - 52;
    } else {
      aw = Math.min(1100, vw - 32) - 24;
      ah = vh - 210;
    }
    aw = Math.max(200, aw); ah = Math.max(140, ah);
    // 'wide' only when it actually makes the playfield bigger
    const sTall = Math.min(aw / 256, ah / 192), sWide = Math.min(aw / 256, ah / 144);
    setMode(sWide > sTall * 1.04 ? 'wide' : 'tall');
    const s = MODE === 'wide' ? sWide : sTall;
    cv.style.width = Math.floor(256 * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
  }
  let layoutQueued = false;
  function queueLayout() { if (layoutQueued) return; layoutQueued = true; requestAnimationFrame(() => { layoutQueued = false; layout(); }); }
  addEventListener('resize', queueLayout);
  addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.visualViewport) visualViewport.addEventListener('resize', queueLayout);

  // ---------- input: keyboard ----------
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  addEventListener('keydown', e => {
    ensureAudio();
    const k = KEYS[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'Enter' || (e.code === 'Space' && state !== 'play' && state !== 'enter')) { onStart(); e.preventDefault(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (e.code === 'KeyM') toggleMusic();
    if (state === 'title' && (k === 'left' || k === 'right')) changeStart(k === 'left' ? -1 : 1);
  });
  addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) keys[k] = false; });

  // ---------- input: touch ----------
  // The walk pad is one surface: slide between halves without lifting, swipe up to jump in that direction.
  const moveEl = document.getElementById('pad-move'), jumpEl = document.getElementById('pad-jump');
  const halves = { l: moveEl.querySelector('.l'), r: moveEl.querySelector('.r') };
  const movePtr = new Map(), jumpPtr = new Set();
  const dirAt = e => { const r = moveEl.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? -1 : 1; };
  function syncMove() {
    let l = false, r = false;
    for (const p of movePtr.values()) { if (p.dir < 0) l = true; else r = true; }
    touchIn.left = l; touchIn.right = r;
    halves.l.classList.toggle('on', l); halves.r.classList.toggle('on', r);
  }
  moveEl.addEventListener('pointerdown', e => {
    e.preventDefault(); ensureAudio();
    try { moveEl.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    const d = dirAt(e);
    movePtr.set(e.pointerId, { dir: d, y0: e.clientY });
    if (state === 'title') changeStart(d);
    syncMove();
  });
  moveEl.addEventListener('pointermove', e => {
    const p = movePtr.get(e.pointerId);
    if (!p) return;
    p.dir = dirAt(e);
    if (p.y0 - e.clientY > 28) { if (state === 'play' && !paused) swipePulse = 6; p.y0 = e.clientY; }
    else if (e.clientY > p.y0) p.y0 = e.clientY;
    syncMove();
  });
  const moveUp = e => { movePtr.delete(e.pointerId); syncMove(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => moveEl.addEventListener(t, moveUp));
  jumpEl.addEventListener('pointerdown', e => {
    e.preventDefault(); ensureAudio();
    if (paused || (state !== 'play' && state !== 'enter')) { onStart(); return; }
    if (state === 'enter') state = 'play';
    try { jumpEl.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    jumpPtr.add(e.pointerId); touchIn.jump = true; jumpEl.classList.add('on');
  });
  const jumpUp = e => { jumpPtr.delete(e.pointerId); touchIn.jump = jumpPtr.size > 0; jumpEl.classList.toggle('on', touchIn.jump); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => jumpEl.addEventListener(t, jumpUp));
  [moveEl, jumpEl].forEach(el => el.addEventListener('contextmenu', e => e.preventDefault()));
  cv.addEventListener('pointerdown', () => { cv.focus({ preventScroll: true }); if (state !== 'play' || paused) onStart(); });

  // ---------- input: gamepad ----------
  let padPrev = { start: false, jump: false, left: false, right: false };
  function pollPad() {
    padIn.left = padIn.right = padIn.jump = false;
    let start = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0;
      padIn.left = padIn.left || ax < -0.45 || b(14);
      padIn.right = padIn.right || ax > 0.45 || b(15);
      padIn.jump = padIn.jump || b(0) || b(1) || b(12);
      start = start || b(9);
    }
    if (start && !padPrev.start) { if (paused || !pausable() || state === 'enter') onStart(); else togglePause(); }
    if (padIn.jump && !padPrev.jump && (state !== 'play' || paused) && state !== 'enter') onStart();
    if (state === 'title') {
      if (padIn.left && !padPrev.left) changeStart(-1);
      if (padIn.right && !padPrev.right) changeStart(1);
    }
    padPrev = { start, jump: padIn.jump, left: padIn.left, right: padIn.right };
  }

  // ---------- focus, pausing and wake lock ----------
  function releaseAll() {
    keys.left = keys.right = keys.jump = false;
    movePtr.clear(); jumpPtr.clear(); syncMove(); touchIn.jump = false; jumpEl.classList.remove('on');
  }
  function autoPause() { releaseAll(); if (state === 'play') { paused = true; syncButtons(); } }
  addEventListener('blur', autoPause);
  let wakeLock = null;
  function keepAwake() {
    if (wakeLock || !navigator.wakeLock || document.hidden) return;
    navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPause();
    else if (state !== 'title') keepAwake();
  });

  // ---------- toolbar: music, pause, full screen, install ----------
  const $ = id => document.getElementById(id);
  const musicBtn = $('btn-music'), pauseBtn = $('btn-pause'), fullBtn = $('btn-full'), installBtn = $('btn-install');
  musicBtn.addEventListener('click', () => { ensureAudio(); toggleMusic(); });
  pauseBtn.addEventListener('click', () => { ensureAudio(); if (paused) { paused = false; syncButtons(); } else togglePause(); });
  if (document.fullscreenEnabled && root.requestFullscreen && !isStandalone()) fullBtn.hidden = false;
  fullBtn.addEventListener('click', () => {
    ensureAudio();
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => { fullBtn.hidden = true; });
  });
  document.addEventListener('fullscreenchange', () => { fullBtn.textContent = document.fullscreenElement ? 'Exit full' : 'Full screen'; queueLayout(); });
  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', () => {
    if (!installEvt) return;
    installEvt.prompt();
    Promise.resolve(installEvt.userChoice).catch(() => {}).then(() => { installEvt = null; installBtn.hidden = true; });
  });
  addEventListener('appinstalled', () => { installBtn.hidden = true; });
  function syncButtons() {
    musicBtn.textContent = musicOn ? 'Music on' : 'Music off';
    musicBtn.setAttribute('aria-pressed', String(musicOn));
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }

  // iPhone and iPad have no install prompt, so explain the Share menu once.
  const toast = $('toast');
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let toastSeen = false;
  try { toastSeen = localStorage.getItem('manic-anteater-ios-tip') === '1'; } catch (e) { toastSeen = false; }
  if (isIOS && !inFrame && !isStandalone() && !toastSeen) toast.hidden = false;
  $('toast-close').addEventListener('click', () => {
    toast.hidden = true;
    try { localStorage.setItem('manic-anteater-ios-tip', '1'); } catch (e) { /* storage unavailable */ }
  });

  // Offline support when served as a site (not inside an embedded preview).
  if (!inFrame && 'serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    runMusic();
    render();
    requestAnimationFrame(loop);
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ levelIdx, score, hi, lives, lap, startLevel, musicOn, playing: !['title', 'gameover', 'win'].includes(state) }));
  function boot(data) {
    data = data || {};
    if (typeof data.hi === 'number') hi = Math.max(hi, data.hi);
    if (typeof data.startLevel === 'number') startLevel = data.startLevel % LEVELS.length;
    if (typeof data.musicOn === 'boolean') musicOn = data.musicOn;
    L = parseLevel(LEVELS[0], 0); P = makePlayer(L); tiles = buildTiles(L.pal);
    if (data.playing) {
      score = data.score | 0; lives = typeof data.lives === 'number' ? data.lives : 3; lap = data.lap | 0;
      levelIdx = Math.min(data.levelIdx | 0, LEVELS.length - 1);
      nextLife = (Math.floor(score / 10000) + 1) * 10000;
      loadLevel();
    }
    layout();
    syncButtons();
    requestAnimationFrame(t => { last = t; loop(t); });
  }
  if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data);
})();
