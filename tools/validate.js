// Reachability check: BFS over standing positions using the game's own physics (guardians ignored).
const C = require("../src/core.js");
let bad = 0;
C.LEVELS.forEach((def, li) => {
  for (const [i, row] of def.map.entries()) if (row.length !== 30) { console.log(`L${li + 1} row ${i} length ${row.length}`); bad++; }
  const L = C.parseLevel(def, 0);
  const start = C.makePlayer(L);
  const seen = new Set(), q = [[start.x, start.y]];
  const edges = new Map(), good = new Set();   // edges: state -> successor states; good: states with a route to the portal
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
      const from = Math.round(x * 2) / 2 + '|' + y;
      const k = Math.round(p.x * 2) / 2 + '|' + p.y;
      if (pt) good.add(from);
      if (!edges.has(from)) edges.set(from, new Set());
      edges.get(from).add(k);
      if (!seen.has(k)) { seen.add(k); q.push([p.x, p.y]); }
    }
  }
  // soft-lock check: every place you can stand must still have a way to the portal
  const rev = new Map();
  for (const [a, bs] of edges) for (const b of bs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
  const stack = [...good];
  while (stack.length) { const k = stack.pop(); for (const a of rev.get(k) || []) if (!good.has(a)) { good.add(a); stack.push(a); } }
  const traps = [...seen].filter(k => !good.has(k));
  if (traps.length) {
    bad++;
    const cells = [...new Set(traps.map(k => { const [x, y] = k.split('|').map(Number); return `col ${Math.floor((x + 7) / 8)} row ${(y + C.PH) / 8}`; }))];
    console.log(`L${li + 1} TRAPPED: ${traps.length} reachable positions with no way back to the portal, around ${cells.slice(0, 6).join('; ')}`);
  }
  const missing = L.hills.map((h, i) => hills.has(i) ? null : `(${h.c},${h.r})`).filter(Boolean);
  const okAll = !missing.length && portal && L.portal;
  if (!okAll) bad++;
  console.log(`L${li + 1} ${def.name}: hills ${hills.size}/${L.hills.length}${missing.length ? ' MISSING ' + missing.join(' ') : ''} portal ${portal ? 'ok' : 'UNREACHABLE'} states ${seen.size}`);
});
process.exit(bad ? 1 : 0);
