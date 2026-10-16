// Reachability check: BFS over standing positions using the game's own physics (guardians ignored).
const C = require("../src/core.js");
let bad = 0;
C.LEVELS.forEach((def, li) => {
  for (const [i, row] of def.map.entries()) if (row.length !== 30) { console.log(`L${li + 1} row ${i} length ${row.length}`); bad++; }
  const L = C.parseLevel(def, 0);
  const start = C.makePlayer(L);
  const seen = new Set(), q = [[start.x, start.y]];
  const hills = new Set(); let portal = false;
  seen.add(start.x + '|' + start.y);
  const acts = [{ left: 1 }, { right: 1 }, { jump: 1 }, { jump: 1, left: 1 }, { jump: 1, right: 1 }];
  while (q.length) {
    const [x, y] = q.shift();
    for (const a of acts) {
      const p = { x, y, vx: 0, vy: 0, air: false, apex: y, facing: 1, walk: 0 };
      let n = 0, ok = true; const got = [];
      let pt = false;
      do {
        const ev = C.stepPlayer(L, p, n === 0 ? a : {});
        if (ev.fell || C.touchesHazard(L, p)) { ok = false; break; }
        got.push(...C.hillsTouched(L, p));
        if (C.touchesPortal(L, p)) pt = true;
        n++;
      } while (p.air && n < 600);
      if (!ok || p.air) continue;
      got.forEach(h => hills.add(h)); if (pt) portal = true;
      const k = Math.round(p.x * 2) / 2 + '|' + p.y;
      if (!seen.has(k)) { seen.add(k); q.push([p.x, p.y]); }
    }
  }
  const missing = L.hills.map((h, i) => hills.has(i) ? null : `(${h.c},${h.r})`).filter(Boolean);
  const okAll = !missing.length && portal && L.portal;
  if (!okAll) bad++;
  console.log(`L${li + 1} ${def.name}: hills ${hills.size}/${L.hills.length}${missing.length ? ' MISSING ' + missing.join(' ') : ''} portal ${portal ? 'ok' : 'UNREACHABLE'} states ${seen.size}`);
});
process.exit(bad ? 1 : 0);
