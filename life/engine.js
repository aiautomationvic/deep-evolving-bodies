/* LIFE engine: open-ended soft-body evolution. No DOM. */
(function (root) {
'use strict';
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
let _s = 1;
function seedRng(s) { _s = (s >>> 0) || 1; }
function rnd() { _s = (_s + 0x6D2B79F5) >>> 0; let t = _s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function gauss() { return (rnd() + rnd() + rnd() - 1.5) * 2; }
const pick = a => a[(rnd() * a.length) | 0];

const WS = 3000, GW = 60, CS = WS / GW, SUB = 2, ITER = 3;
const CT = 0.012, CN = 0.06;
const MAXNODES = 100;

/* ---------------- genome ---------------- */
// continuous genes [lo,hi]
const CG = {
  size: [3.5, 30], sl: [.8, 2.2], wpk: [0, 1], wsp: [.12, .7], wbase: [.2, 1], curl: [-1, 1],
  mus: [0, 1], xm: [0, 1], freq: [.5, 2.2], wave: [0, 1.6], stiff: [.3, 1],
  cilia: [0, 1], filter: [0, 1], photo: [0, 1], bite: [0, 1], armor: [0, 1],
  sense: [.15, 1], instinct: [0, 1], eyes: [0, 1], glow: [0, 1], pat: [0, 1], hue: [0, 360], hue2: [0, 360]
};
const AG = { at: [0, 1], ang: [-.5, 1], seg: [.6, 2], th: [.25, 1.5], mus: [0, 1], ph: [0, 1], wv: [0, 1.5] };

function baseGenome() {
  return {
    n: 1, size: 5, sl: 1.1, wpk: .5, wsp: .35, wbase: .6, curl: 0,
    mus: .15, xm: 0, freq: 1.2, wave: .5, stiff: .7,
    cilia: .6, filter: .75, photo: .3, bite: 0, armor: 0, sense: .4, instinct: .8, eyes: 0, glow: .4, pat: .3,
    hue: 180, hue2: 120, ap: []
  };
}
function randAp(type) {
  return {
    at: rnd(), sym: pick([0, 0, 1, 2]), cnt: 3 + ((rnd() * 5) | 0), len: 2 + ((rnd() * 4) | 0),
    seg: .8 + rnd() * .8, ang: .1 + rnd() * .7, th: .4 + rnd() * .6, type: type == null ? pick([0, 1, 2, 3]) : type,
    mus: rnd() * .7, ph: rnd(), wv: rnd()
  };
}
function founder() {
  const g = baseGenome();
  g.hue = rnd() * 360; g.hue2 = (g.hue + 30 + rnd() * 120) % 360;
  g.size = 4 + rnd() * 3; g.n = rnd() < .3 ? 2 : 1;
  g.filter = .4 + rnd() * .6; g.photo = rnd() * .7; g.cilia = .3 + rnd() * .6;
  g.mus = rnd() * .5; g.freq = .7 + rnd() * 1; g.wave = rnd() * 1.2; g.sl = .9 + rnd() * .6;
  g.bite = rnd() < .3 ? .12 + rnd() * .35 : 0; g.instinct = .6 + rnd() * .35; g.sense = .25 + rnd() * .4; g.glow = rnd(); g.pat = rnd();
  return g;
}
function cloneG(g) { const c = Object.assign({}, g); c.ap = g.ap.map(a => Object.assign({}, a)); return c; }
function mutG(g, rate) {
  const c = cloneG(g), r = rate;
  for (const k in CG) {
    if (rnd() < .3) {
      const [lo, hi] = CG[k];
      if (k === 'size') c.size = clamp(c.size * Math.exp(gauss() * .1 * r), lo, hi);
      else if (k === 'hue' || k === 'hue2') c[k] = (c[k] + gauss() * 14 * r + 360) % 360;
      else c[k] = clamp(c[k] + gauss() * (hi - lo) * .06 * r, lo, hi);
    }
  }
  if (rnd() < .012 * r) { c.size = clamp(c.size * (1.4 + rnd() * .5), CG.size[0], CG.size[1]); c.n = clamp(c.n + 1 + ((rnd() * 3) | 0), 1, 18); }
  if (rnd() < .1 * r) c.n = clamp(c.n + (rnd() < .6 ? 1 : -1), 1, 18);
  for (const a of c.ap) {
    for (const k in AG) if (rnd() < .25) { const [lo, hi] = AG[k]; a[k] = clamp(a[k] + gauss() * (hi - lo) * .08 * r, lo, hi); }
    if (rnd() < .07 * r) a.len = clamp(a.len + (rnd() < .5 ? 1 : -1), 1, 10);
    if (rnd() < .012 * r) a.type = pick([0, 1, 2, 3]);
    if (rnd() < .008 * r) a.sym = pick([0, 1, 2]);
    if (rnd() < .03 * r) a.cnt = clamp(a.cnt + (rnd() < .5 ? 1 : -1), 3, 10);
  }
  if (rnd() < .035 * r && c.ap.length < 3) c.ap.push(randAp());
  if (rnd() < .012 * r && c.ap.length) c.ap.splice((rnd() * c.ap.length) | 0, 1);
  if (rnd() < .01 * r && c.ap.length && c.ap.length < 3) c.ap.push(Object.assign({}, pick(c.ap), { at: rnd(), ph: rnd() })); // duplication
  return c;
}
function gdist(a, b) {
  let d = Math.abs(Math.log(a.size / b.size)) * 1.6 + Math.abs(a.n - b.n) * .22;
  d += Math.abs(a.ap.length - b.ap.length) * .9;
  const m = Math.min(a.ap.length, b.ap.length);
  for (let i = 0; i < m; i++) d += (a.ap[i].type !== b.ap[i].type) * .5 + (a.ap[i].sym !== b.ap[i].sym) * .5 + Math.abs(a.ap[i].len - b.ap[i].len) * .08;
  const dh = Math.abs(a.hue - b.hue); d += Math.min(dh, 360 - dh) / 360 * 1.4;
  d += Math.abs(a.filter - b.filter) * .5 + Math.abs(a.photo - b.photo) * .5 + Math.abs(a.bite - b.bite) * 1.2 + Math.abs(a.mus - b.mus) * .4 + Math.abs(a.curl - b.curl) * .4;
  return d;
}

/* ---------------- development: genome -> body graph ---------------- */
function develop(g) {
  const S = g.size, M = clamp(g.n | 0, 1, 18) + 1;
  const nd = [], ed = [], flaps = [], chains = [], L = [], R = [];
  const nn = (x, y, r, t, bn) => { nd.push({ x, y, r, t, bn: !!bn }); return nd.length - 1; };
  const ee = (a, b, k, kind, o) => {
    const A = nd[a], B = nd[b];
    const e = { a, b, k, kind, L0: Math.hypot(A.x - B.x, A.y - B.y), side: 0, seg: 0, th: A.r + B.r };
    if (o) Object.assign(e, o); ed.push(e); return e;
  };
  const sL = S * g.sl * (M === 2 ? .7 : 1), Th = g.curl * 2.4;
  const cenX = [], cenY = [], angs = [];
  let cx = 0, cy = 0;
  for (let i = 0; i < M; i++) {
    const a = PI + Th * ((i + .5) / M - .5);
    angs.push(a); cenX.push(cx); cenY.push(cy);
    cx += Math.cos(a) * sL; cy += Math.sin(a) * sL;
  }
  const stiffK = .5 + .4 * g.stiff;
  for (let i = 0; i < M; i++) {
    const t = M > 1 ? i / (M - 1) : g.wpk;
    const w = Math.max(S * .16, S * .62 * (g.wbase + (1 - g.wbase) * Math.exp(-Math.pow((t - g.wpk) / g.wsp, 2))));
    const r = clamp(w * .5, S * .1, S * .5), a = angs[i];
    const lx = Math.sin(a), ly = -Math.cos(a);
    L.push(nn(cenX[i] + lx * w, cenY[i] + ly * w, r, 0, i === 0));
    R.push(nn(cenX[i] - lx * w, cenY[i] - ly * w, r, 0, i === 0));
    ee(L[i], R[i], .85, g.xm > .03 ? 2 : 0, { seg: i, th: 0 });
    if (i > 0) {
      ee(L[i - 1], L[i], stiffK, g.mus > .03 ? 1 : 0, { side: 1, seg: i });
      ee(R[i - 1], R[i], stiffK, g.mus > .03 ? 1 : 0, { side: -1, seg: i });
      ee(L[i - 1], R[i], .3 * stiffK + .1, 0, { th: 0 }); ee(R[i - 1], L[i], .3 * stiffK + .1, 0, { th: 0 });
    }
  }
  const hubAt = (s) => {
    const A = nd[L[s]], B = nd[R[s]];
    const h = nn((A.x + B.x) / 2, (A.y + B.y) / 2, Math.max(S * .1, (A.r + B.r) / 2), 0, false);
    ee(h, L[s], .9, 0, { th: 0 }); ee(h, R[s], .9, 0, { th: 0 }); return h;
  };
  const tissue = [1, 2, 3, 4];
  function chain(root, dx, dy, ap, sg, phExtra) {
    const type = ap.type, sl = S * ap.seg * .9, r0 = Math.max(S * .08, S * ap.th * .32) * (type === 0 ? 1.5 : 1);
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const rt = nd[root]; const ids = [root]; let prev = root;
    for (let i = 1; i <= ap.len; i++) {
      const f = i / ap.len;
      const r = Math.max(S * .05, r0 * (type === 2 ? 1 - .6 * f : 1 - .4 * f));
      const id = nn(rt.x + dx * sl * i, rt.y + dy * sl * i, r, tissue[type], type === 2 && i === ap.len);
      const k = type === 2 ? .75 : .95;
      ee(prev, id, k, 0, { th: (nd[prev].r + r) * (type === 0 ? 2.2 : 1) });
      if (i >= 2) ee(ids[i - 2], id, type === 2 ? .03 : type === 3 ? .7 : .35, 0, { th: 0 });
      ids.push(id); prev = id;
    }
    chains.push({ ni: ids, type, root });
    if (ap.mus > .04 && type !== 3) flaps.push({ root, ni: ids.slice(1), amp: ap.mus, ph: ap.ph + (phExtra || 0), wv: ap.wv, sg });
  }
  for (const ap of g.ap) {
    const s = clamp(Math.round(ap.at * (M - 1)), 0, M - 1);
    if (ap.sym === 0) {
      const a = PI / 2 + ap.ang * PI / 2;
      chain(L[s], Math.cos(a), Math.sin(a), ap, 1, 0);
      chain(R[s], Math.cos(a), -Math.sin(a), ap, -1, 0);
    } else if (ap.sym === 1) {
      const h = hubAt(ap.at < .5 ? 0 : M - 1);
      if (ap.at < .5) chain(h, 1, 0, ap, 1, 0); else chain(h, Math.cos(angs[M - 1]), Math.sin(angs[M - 1]), ap, 1, 0);
    } else {
      const h = hubAt(s), K = clamp(ap.cnt | 0, 3, 10);
      for (let j = 0; j < K; j++) { const a = j * TAU / K; chain(h, Math.cos(a), Math.sin(a), ap, 1, ap.wv * j / K); }
    }
  }
  if (nd.length > MAXNODES) return null;
  return { nd, ed, flaps, chains, L, R, M };
}

/* ---------------- naming ---------------- */
const SYL = ['ka', 'vel', 'nu', 'thar', 'o', 'mi', 'rax', 'ly', 'sen', 'dro', 'qua', 'zil', 'bel', 'ur', 'fen', 'ix', 'ora', 'pel', 'sha', 'nem'];
function epithet() { return SYL[(rnd() * SYL.length) | 0] + SYL[(rnd() * SYL.length) | 0]; }
function formOf(g) {
  const M = g.n + 1, L = M * g.size * g.sl, ap = g.ap;
  const ring = ap.find(a => a.sym === 2), pair = ap.filter(a => a.sym === 0), single = ap.filter(a => a.sym === 1);
  const fins = pair.filter(a => a.type === 0), legs = pair.filter(a => a.type === 1);
  if (ring && M <= 6) return ring.type === 2 ? 'Bell' : ring.type === 0 ? 'Wheel' : 'Star';
  if (L > 280 && (fins.length || single.length) && M >= 5) return 'Leviathan';
  if (ring && M > 6) return 'Squid';
  if (legs.length && M >= 3) return 'Crawler';
  if (fins.length && single.length && M >= 4) return 'Torpedo';
  if (fins.length && fins[0].len >= 3 && M <= 6) return 'Ray';
  if (fins.length || single.length) return M >= 4 ? 'Swimmer' : 'Fluke';
  if (M >= 9) return 'Serpent';
  if (M >= 4) return 'Worm';
  if (ap.length) return 'Sprout';
  return g.size > 12 ? 'Giant cell' : 'Cell';
}
function roleOf(g) {
  if (g.bite > .35) return 'hunter';
  if (g.photo > .45 && g.photo > g.filter) return 'light';
  if (g.bite > .12) return 'omni';
  return 'grazer';
}

/* ---------------- brain ---------------- */
const NI = 15, NH = 8, NO = 5, BW = NI * NH + NH * NH + NO * NH + NH + NO;
function randBrain() { const w = new Float32Array(BW); for (let i = 0; i < BW; i++) w[i] = gauss() * .5; return w; }
function mutBrain(w, r) { const o = new Float32Array(w); for (let i = 0; i < BW; i++) if (rnd() < .08 * r) o[i] += gauss() * .35; return o; }

/* ---------------- sim ---------------- */
const sim = {
  T: 0, cs: [], species: [], nextId: 1, nextSp: 1, maxGen: 0, births: 0, deaths: 0, log: [],
  N: new Float32Array(GW * GW), cap: new Float32Array(GW * GW), cap1: new Float32Array(GW * GW), cap2: new Float32Array(GW * GW), L: null, capMul: 1, mutMul: 1, popCap: 200, events: [], zones: [],
  WS, GW, CS, develop, formOf, roleOf, founder, mutG, cloneG, gdist, randBrain, lightAt, fieldAt, seedRng, rnd
};
function lightAt(y) { return Math.exp(-3 * clamp(y / WS, 0, 1)); }
function cellOf(x, y) { return clamp((y / CS) | 0, 0, GW - 1) * GW + clamp((x / CS) | 0, 0, GW - 1); }
function fieldAt(x, y) { return sim.N[cellOf(x, y)]; }
function foodFor(c, i) { const L = sim.L, e = c.eff; return L[0][i] * e[0] + L[1][i] * e[1] * 1.5 + L[2][i] * e[2] * 2.2; }
function say(msg, col) { sim.log.push({ t: sim.T, msg, col: col || '#8fd' }); if (sim.log.length > 40) sim.log.shift(); }
sim.say = say;

function buildCap(T) {
  const bl = sim.blobs, vents = sim.vents, season = 1 + .3 * Math.sin(T / 5000 * TAU), C0 = sim.cap, C1 = sim.cap1, C2 = sim.cap2;
  for (let gy = 0; gy < GW; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = (gx + .5) * CS, y = (gy + .5) * CS, yn = y / WS, i = gy * GW + gx;
    let c = .4 * (.3 + .7 * lightAt(y)), c1 = .12 * Math.exp(-Math.pow((yn - .45) / .25, 2)), c2 = .05 * clamp((yn - .4) * 2, 0, 1);
    for (let k = 0; k < bl.length; k++) {
      const b = bl[k], bx = b.x + Math.cos(T * b.w + b.p) * 220, by = b.y + Math.sin(T * b.w + b.p) * 220, d2 = ((x - bx) ** 2 + (y - by) ** 2) / (b.r * b.r), v = Math.exp(-d2);
      if (k < 7) c += b.a * v; else if (k < 11) c1 += (b.a + .55) * 2.2 * v * Math.exp(-Math.pow((yn - .45) / .35, 2)); else c2 += (b.a + .6) * 2.6 * v * clamp((yn - .35) * 2.5, 0, 1);
    }
    for (const v of vents) { const q = Math.exp(-((x - v.x) ** 2 + (y - v.y) ** 2) / (230 * 230)); c += 1.1 * q; c2 += 1.2 * q; }
    C0[i] = clamp(c, .04, 1.6) * season; C1[i] = clamp(c1, 0, 1.6) * season; C2[i] = clamp(c2, 0, 1.8) * season;
  }
}
function genWorld() {
  sim.blobs = []; for (let i = 0; i < 16; i++) sim.blobs.push({ x: rnd() * WS, y: rnd() * WS, r: 250 + rnd() * 450, a: -.2 + rnd() * .65, w: (.4 + rnd()) * .0003, p: rnd() * TAU });
  sim.vents = []; for (let i = 0; i < 4; i++) sim.vents.push({ x: rnd() * WS, y: WS * (.7 + rnd() * .25) });
  buildCap(0); for (let i = 0; i < sim.N.length; i++) { sim.N[i] = sim.cap[i] * .7; sim.L[1][i] = sim.cap1[i] * .7; sim.L[2][i] = sim.cap2[i] * .7; }
}
function deposit(x, y, amt) {
  const gx = clamp((x / CS) | 0, 0, GW - 1), gy = clamp((y / CS) | 0, 0, GW - 1);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const X = gx + i, Y = gy + j; if (X < 0 || Y < 0 || X >= GW || Y >= GW) continue;
    sim.N[Y * GW + X] = Math.min(2, sim.N[Y * GW + X] + amt / 9);
  }
}

function newSpecies(g, parent, c) {
  const sp = { id: sim.nextSp++, g: cloneG(g), parent: parent ? parent.id : 0, form: formOf(g), name: '', born: sim.T, count: 0, peak: 0, hue: g.hue, role: roleOf(g) };
  sp.name = epithet(); sp.name = sp.name[0].toUpperCase() + sp.name.slice(1) + ' ' + sp.form.toLowerCase();
  sim.species.push(sp);
  if (sim.T > 1) say('New form: ' + sp.name + (parent ? ' (from ' + parent.name + ')' : ''), 'hsl(' + g.hue + ',70%,70%)');
  return sp;
}
function assignSpecies(g, parent) {
  let best = null, bd = 1e9;
  const cand = parent && gdist(g, parent.g) < 1.3 ? parent : null;
  if (cand) return cand;
  for (const s of sim.species) { if (s.count <= 0 && sim.T - s.born > 3000) continue; const d = gdist(g, s.g); if (d < bd) { bd = d; best = s; } }
  if (best && bd < 1.3) return best;
  return newSpecies(g, parent);
}

function spawn(g, X, Y, E, brain, parentSp, gen, psi) {
  const bd = develop(g); if (!bd) return null;
  const n = bd.nd.length, ne = bd.ed.length;
  const c = {
    id: sim.nextId++, g, bd, n, ne, gen: gen || 0, age: 0, E: 0, sp: null,
    x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n),
    ox: new Float64Array(n), oy: new Float64Array(n), m: new Float64Array(n), r: new Float64Array(n),
    eLc: new Float64Array(ne), w: brain || randBrain(), h: new Float32Array(NH), h2: new Float32Array(NH), out: new Float32Array(NO),
    inp: new Float32Array(NI), phase: rnd() * TAU, hx: 1, hy: 0, cx: X, cy: Y, spd: 0, fwd: 0, thr: 0, steer: 0, atk: 0, flash: 0, dmg: 0,
    mass: 0, sumR: 0, role: roleOf(g), tgt: null, reward: 0, lastE: 0, fed: 0
  };
  const ps = psi == null ? rnd() * TAU : psi, cs = Math.cos(ps), sn = Math.sin(ps);
  for (let i = 0; i < n; i++) {
    const p = bd.nd[i];
    c.x[i] = X + p.x * cs - p.y * sn; c.y[i] = Y + p.x * sn + p.y * cs; c.ox[i] = c.x[i]; c.oy[i] = c.y[i];
    c.r[i] = p.r; c.m[i] = Math.max(.2, p.r * p.r); c.mass += c.m[i]; c.sumR += p.r;
  }
  for (let e = 0; e < ne; e++) c.eLc[e] = bd.ed[e].L0;
  c.Emax = 4 + 2.5 * Math.pow(c.mass, .7); c.mk = morphKey(g); { const sc = Math.sqrt(c.mass); c.eff = [clamp(1.3 - sc / 10, .05, 1), clamp((sc - 3) / 6, 0, 1), clamp((sc - 10) / 20, 0, 1)]; }
  c.E = E == null ? c.Emax * .5 : Math.min(E, c.Emax);
  let nMus = 0; for (const e of bd.ed) if (e.kind) nMus++;
  c.upkeep = .0045 * Math.pow(c.mass, .55) + .00012 * nMus * (g.mus + g.xm) * g.freq * (1 + c.mass * .02) + .0002 * g.sense + .0004 * g.eyes
    + .0006 * g.cilia * c.sumR + .0005 * g.bite * Math.sqrt(c.mass) + .0003 * g.armor * Math.sqrt(c.mass) + .0002 * g.photo * c.sumR;
  for (const f of bd.flaps) c.upkeep += .00025 * f.amp * f.ni.length * Math.sqrt(c.m[f.ni[0]]);
  c.maxAge = 9000 + 1500 * Math.sqrt(c.mass);
  c.sp = assignSpecies(g, parentSp);
  sim.cs.push(c); sim.births++; sim.maxGen = Math.max(sim.maxGen, c.gen);
  updHeading(c); return c;
}
function updHeading(c) {
  const bd = c.bd; let hx = 0, hy = 0, cx = 0, cy = 0, M = 0;
  for (let i = 0; i < bd.M; i++) {
    const a = bd.L[i], b = bd.R[i], dx = c.x[b] - c.x[a], dy = c.y[b] - c.y[a], d = Math.hypot(dx, dy) || 1;
    hx += -dy / d; hy += dx / d;
  }
  const d = Math.hypot(hx, hy) || 1; c.hx = hx / d; c.hy = hy / d;
  let tm = 0; for (let i = 0; i < c.n; i++) { cx += c.x[i] * c.m[i]; cy += c.y[i] * c.m[i]; tm += c.m[i]; }
  const ncx = cx / tm, ncy = cy / tm;
  c.fwd = (ncx - c.cx) * c.hx + (ncy - c.cy) * c.hy; c.spd = Math.hypot(ncx - c.cx, ncy - c.cy);
  c.cx = ncx; c.cy = ncy;
}

function morphKey(g) {
  const sb = Math.floor(Math.log2(g.size / 3.5) * 1.3), nb = g.n <= 1 ? 0 : g.n <= 3 ? 1 : g.n <= 7 ? 2 : 3;
  return sb + '|' + nb + '|' + g.ap.map(a => a.type + '' + a.sym + (a.len > 4 ? 'L' : 's')).sort().join('') + '|' + (Math.abs(g.curl) > .5 ? 'c' : '') + (g.bite > .3 ? 'h' : g.photo > .5 ? 'p' : 'f');
}
sim.morph = {};
function isKin(a, b) { return a.sp === b.sp && Math.abs(a.g.bite - b.g.bite) < .3; }
/* ---------------- perception & brain ---------------- */
let chash = [], CH = 10, CHS = WS / 10;
function buildCHash() {
  chash = []; for (let i = 0; i < CH * CH; i++) chash.push([]);
  for (const c of sim.cs) chash[clamp((c.cy / CHS) | 0, 0, CH - 1) * CH + clamp((c.cx / CHS) | 0, 0, CH - 1)].push(c);
}
function nearest(c, R) {
  let best = null, bd = R * R; const gx = clamp((c.cx / CHS) | 0, 0, CH - 1), gy = clamp((c.cy / CHS) | 0, 0, CH - 1);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const X = gx + i, Y = gy + j; if (X < 0 || Y < 0 || X >= CH || Y >= CH) continue;
    for (const o of chash[Y * CH + X]) { if (o === c) continue; const d = (o.cx - c.cx) ** 2 + (o.cy - c.cy) ** 2; if (d < bd) { bd = d; best = o; } }
  }
  return best;
}
function think(c) {
  const g = c.g, I = c.inp, hx = c.hx, hy = c.hy, lx = -hy, ly = hx;
  const d = Math.max(36, g.size * 3), hxp = c.x[c.bd.L[0]] * .5 + c.x[c.bd.R[0]] * .5, hyp = c.y[c.bd.L[0]] * .5 + c.y[c.bd.R[0]] * .5;
  const F = (x, y) => foodFor(c, cellOf(x, y)), f = F(hxp + hx * d, hyp + hy * d), b = F(hxp - hx * d, hyp - hy * d), l = F(hxp + lx * d, hyp + ly * d), r = F(hxp - lx * d, hyp - ly * d);
  I[0] = (f - b) / (f + b + .05); I[1] = (l - r) / (l + r + .05); I[2] = clamp(F(hxp, hyp), 0, 1.5);
  const li = lightAt(c.cy); I[3] = -hy * li; I[4] = -hx * li;
  const R = 90 + 260 * g.sense; const t = nearest(c, R); c.tgt = t;
  let tf = 0, tl = 0, kin = 0, dang = 0, prey = 0;
  if (t) {
    const dx = t.cx - c.cx, dy = t.cy - c.cy, dist = Math.hypot(dx, dy) + 1e-6;
    tf = (dx * hx + dy * hy) / dist; tl = (dx * lx + dy * ly) / dist;
    I[5] = tf; I[6] = tl; I[7] = 1 - dist / R; I[8] = clamp(Math.log(t.mass / c.mass) / 2, -1, 1);
    kin = isKin(c, t) ? 1 : 0; I[9] = kin; I[10] = t.g.bite * 2 - 1;
    dang = (!kin && t.g.bite > .2 && t.mass > c.mass * .4) ? 1 : 0;
    prey = (!kin && g.bite > .12 && t.mass < c.mass * 2.5) ? 1 : 0;
  } else { I[5] = I[6] = I[7] = I[8] = I[9] = 0; I[10] = -1; }
  I[11] = c.E / c.Emax; I[12] = clamp(c.fwd * 3, -1, 1);
  const wx = (c.cx < 120 ? 1 : c.cx > WS - 120 ? -1 : 0), wy = (c.cy < 120 ? 1 : c.cy > WS - 120 ? -1 : 0);
  I[13] = wx * hx + wy * hy; I[14] = wx * lx + wy * ly;
  // recurrent net
  const w = c.w, h = c.h, h2 = c.h2; let o1 = NH * NI, o2 = o1 + NH * NH, o3 = o2 + NO * NH, ob = o3 + NH * 0, b1 = o2 + NO * NH, b2 = b1 + NH;
  for (let j = 0; j < NH; j++) {
    let s = w[b1 + j];
    for (let i = 0; i < NI; i++) s += w[j * NI + i] * I[i];
    for (let k = 0; k < NH; k++) s += w[o1 + j * NH + k] * h[k];
    h2[j] = Math.tanh(s);
  }
  for (let j = 0; j < NH; j++) h[j] = h2[j];
  const out = c.out;
  for (let m = 0; m < NO; m++) { let s = w[b2 + m]; for (let j = 0; j < NH; j++) s += w[o2 + m * NH + j] * h[j]; out[m] = Math.tanh(s); }
  // instinct helper
  let dx = I[0] * 1.2, dy = I[1] * 1.2;
  if (g.photo > .4) { dx += I[3] * g.photo * .6; dy += I[4] * g.photo * .6; }
  if (prey) { dx += tf * 2.5; dy += tl * 2.5; }
  if (dang) { dx -= tf * 3; dy -= tl * 3; }
  dx += I[13] * 2; dy += I[14] * 2;
  const mag = Math.hypot(dx, dy);
  let si, ti;
  if (mag < .08) { si = c.out[1] * .6 + gauss() * .3; ti = .55; } else { si = clamp(Math.atan2(dy, dx) / 1.3, -1, 1); ti = clamp(.55 + .5 * mag + (dang ? .5 : 0) + (prey ? .3 : 0), .3, 1.5); }
  const ins = g.instinct;
  c.steer = lerp(out[1], si, ins); c.thr = clamp(lerp((out[0] + 1) * .65, ti, ins), 0, 1.6);
  c.fq = out[2] * .25;
  c.atk = (prey || out[3] > 0.2 && g.bite > .1) ? 1 : 0;
}

/* ---------------- physics ---------------- */
function cur(x, y, t) { const q = sim.curAmp; return [(Math.sin(y * .0021 + t * .0004) * .06 + Math.sin(x * .0013 - t * .0003) * .03) * q, Math.cos(x * .0019 + t * .00035) * .05 * q]; }
function pulse(psi, asym) { const u = ((psi % 1) + 1) % 1, p = lerp(.5, .22, asym); return u < p ? Math.sin(PI * u / p) : 0; }
function stepC(c, dt) {
  const bd = c.bd, n = c.n, ne = c.ne, g = c.g, X = c.x, Y = c.y, VX = c.vx, VY = c.vy, M = c.m;
  const T = sim.T, ph = c.phase, thr = c.thr, A = g.mus * sim.AGAIN * thr, Ax = g.xm * .5 * thr, bias = c.steer * .22 * g.mus * 1.0;
  const gw = g.wave * TAU / Math.max(1, bd.M - 1) * 1.1;
  // actuation targets
  for (let e = 0; e < ne; e++) {
    const E = bd.ed[e];
    if (E.kind === 1) c.eLc[e] += (E.L0 * (1 + E.side * (A * Math.sin(ph - gw * E.seg) - bias)) - c.eLc[e]) * .5;
    else if (E.kind === 2) c.eLc[e] += (E.L0 * (1 - Ax * pulse(ph / TAU - E.seg * g.wave * .05, .6)) - c.eLc[e]) * .5;
  }
  // drag (resistive force theory) relative to water
  const eds = bd.ed;
  for (let e = 0; e < ne; e++) {
    const E = eds[e], a = E.a, b = E.b; if (E.th <= 0) continue;
    let tx = X[b] - X[a], ty = Y[b] - Y[a]; const len = Math.hypot(tx, ty); if (len < 1e-6) continue; tx /= len; ty /= len;
    const mx = (X[a] + X[b]) * .5, my = (Y[a] + Y[b]) * .5, u = cur(mx, my, T);
    const vmx = (VX[a] + VX[b]) * .5 - u[0], vmy = (VY[a] + VY[b]) * .5 - u[1];
    const vt = vmx * tx + vmy * ty, vnx = vmx - vt * tx, vny = vmy - vt * ty, ar = len * E.th * dt;
    const fx = -(CT * vt * tx + CN * vnx) * ar, fy = -(CT * vt * ty + CN * vny) * ar;
    let k = .5 / M[a]; let ax = fx * k, ay = fy * k; const lim = Math.hypot(VX[a], VY[a]) * .6 + .02, am = Math.hypot(ax, ay); if (am > lim) { ax *= lim / am; ay *= lim / am; } VX[a] += ax; VY[a] += ay;
    k = .5 / M[b]; ax = fx * k; ay = fy * k; const lim2 = Math.hypot(VX[b], VY[b]) * .6 + .02, am2 = Math.hypot(ax, ay); if (am2 > lim2) { ax *= lim2 / am2; ay *= lim2 / am2; } VX[b] += ax; VY[b] += ay;
  }
  // flapping appendages (reaction on root)
  for (const f of bd.flaps) {
    const amp = f.amp * thr * sim.FG, root = f.root; let rfx = 0, rfy = 0;
    for (let q = 0; q < f.ni.length; q++) {
      const i = f.ni[q], p = q === 0 ? root : f.ni[q - 1];
      let nx = -(Y[i] - Y[p]), ny = X[i] - X[p]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const s = Math.sin(ph + (f.ph + f.wv * q * .6) * TAU) * f.sg * amp * Math.sqrt(M[i]) * (.5 + q * .25);
      VX[i] += nx * s / M[i] * 3; VY[i] += ny * s / M[i] * 3; rfx -= nx * s; rfy -= ny * s;
    }
    VX[root] += rfx / M[root] * 3; VY[root] += rfy / M[root] * 3;
  }
  // cilia thrust
  if (g.cilia > .02) {
    const a = c.steer * .8, ca = Math.cos(a), sa = Math.sin(a), dx = c.hx * ca - c.hy * sa, dy = c.hx * sa + c.hy * ca, f = g.cilia * .014 * (.3 + thr) * dt * Math.pow(clamp(5 / g.size, .04, 1), 1.6);
    for (let i = 0; i < n; i++) { VX[i] += dx * f; VY[i] += dy * f; }
  }
  // integrate
  for (let i = 0; i < n; i++) {
    const sp = Math.hypot(VX[i], VY[i]); if (sp > 6) { VX[i] *= 6 / sp; VY[i] *= 6 / sp; }
    c.ox[i] = X[i]; c.oy[i] = Y[i]; X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
  }
  for (let it = 0; it < ITER; it++) for (let e = 0; e < ne; e++) {
    const E = eds[e], a = E.a, b = E.b; let dx = X[b] - X[a], dy = Y[b] - Y[a]; const d = Math.hypot(dx, dy); if (d < 1e-9) continue;
    const wa = 1 / M[a], wb = 1 / M[b], s = E.k * (d - c.eLc[e]) / d / (wa + wb);
    X[a] += dx * s * wa; Y[a] += dy * s * wa; X[b] -= dx * s * wb; Y[b] -= dy * s * wb;
  }
  const lo = 20, hi = WS - 20;
  for (let i = 0; i < n; i++) {
    if (X[i] < lo) X[i] = lo; else if (X[i] > hi) X[i] = hi; if (Y[i] < lo) Y[i] = lo; else if (Y[i] > hi) Y[i] = hi;
    VX[i] = (X[i] - c.ox[i]) / dt; VY[i] = (Y[i] - c.oy[i]) / dt;
  }
}

/* ---------------- collisions & predation ---------------- */
const GC = 40, GN = Math.ceil(WS / GC);
let head = new Int32Array(GN * GN), nxt = new Int32Array(4096), nC = [], nI = [];
function collide() {
  head.fill(-1); nC.length = 0; nI.length = 0; let k = 0;
  for (const c of sim.cs) for (let i = 0; i < c.n; i++) {
    if (k >= nxt.length) { const t = new Int32Array(nxt.length * 2); t.set(nxt); nxt = t; }
    nC[k] = c; nI[k] = i; const cell = clamp((c.y[i] / GC) | 0, 0, GN - 1) * GN + clamp((c.x[i] / GC) | 0, 0, GN - 1);
    nxt[k] = head[cell]; head[cell] = k; k++;
  }
  for (let a = 0; a < k; a++) {
    const A = nC[a], ia = nI[a], ax = A.x[ia], ay = A.y[ia], ra = A.r[ia];
    const gx = clamp((ax / GC) | 0, 0, GN - 1), gy = clamp((ay / GC) | 0, 0, GN - 1);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = gx + i, Y = gy + j; if (X < 0 || Y < 0 || X >= GN || Y >= GN) continue;
      for (let b = head[Y * GN + X]; b >= 0; b = nxt[b]) {
        if (b <= a) continue; const B = nC[b]; if (B === A) continue; const ib = nI[b];
        let dx = B.x[ib] - ax, dy = B.y[ib] - ay; const rr = ra + B.r[ib] + 1, d2 = dx * dx + dy * dy; if (d2 > rr * rr) continue;
        const d = Math.sqrt(d2) || .01, ov = rr - d; dx /= d; dy /= d;
        const wa = 1 / A.m[ia], wb = 1 / B.m[ib], f = ov * .35 / (wa + wb);
        A.x[ia] -= dx * f * wa; A.y[ia] -= dy * f * wa; B.x[ib] += dx * f * wb; B.y[ib] += dy * f * wb;
        if (!isKin(A, B)) {
          if (A.atk && A.bd.nd[ia].bn && A.g.bite > .05) bite(A, B, ib);
          if (B.atk && B.bd.nd[ib].bn && B.g.bite > .05) bite(B, A, ia);
        }
      }
    }
  }
}
function bite(A, B, ib) {
  let amt = A.g.bite * .5 * Math.sqrt(clamp(A.mass / B.mass, .15, 4));
  const arm = B.g.armor * (B.bd.nd[ib].t === 4 ? 1 : .55); amt *= 1 - .85 * arm;
  amt = Math.min(amt, B.E + .5); B.E -= amt; B.flash = 6; B.dmg += amt; A.E = Math.min(A.Emax, A.E + amt * .85); A.reward = 1;
}

const FW = [1, .3, 1, 2.6, 0], VAL = [1, 1.5, 2.2];
/* ---------------- main tick ---------------- */
function reproduceCheck(c, births) {
  if (c.E > c.Emax * .75 && c.age > 100 && sim.cs.length + births.length < sim.popCap) {
    let g = mutG(c.g, sim.mutMul); let tries = 0;
    while (!develop(g) && tries++ < 4) g = mutG(c.g, sim.mutMul * .5);
    if (tries >= 5) g = cloneG(c.g);
    const share = c.E * .46; c.E -= share + c.Emax * .04;
    const tailI = c.bd.R[c.bd.M - 1], bx = c.x[tailI] - c.hx * c.g.size * 2, by = c.y[tailI] - c.hy * c.g.size * 2;
    births.push({ g, x: clamp(bx, 40, WS - 40), y: clamp(by, 40, WS - 40), E: share, brain: mutBrain(c.w, sim.mutMul), sp: c.sp, gen: c.gen + 1, psi: Math.atan2(c.hy, c.hx) + gauss() * .6 });
  }
}
let regrowT = 0;
sim.tick = function () {
  sim.T++; const T = sim.T;
  if (T % 400 === 0) buildCap(T);
  if (T % 4 === 0) {
    const caps = [sim.cap, sim.cap1, sim.cap2], cm = sim.capMul, tmp = sim.tmp || (sim.tmp = new Float32Array(GW * GW));
    for (let q = 0; q < 3; q++) {
      const N = sim.L[q], cap = caps[q]; for (let i = 0; i < N.length; i++) N[i] += (cap[i] * cm - N[i]) * sim.REGROW;
      if (T % 16 === 0) {
        for (let y = 0; y < GW; y++) for (let x = 0; x < GW; x++) {
          const i = y * GW + x; let s = 0, c = 0;
          if (x > 0) { s += N[i - 1]; c++; } if (x < GW - 1) { s += N[i + 1]; c++; } if (y > 0) { s += N[i - GW]; c++; } if (y < GW - 1) { s += N[i + GW]; c++; }
          tmp[i] = N[i] + (s / c - N[i]) * .08;
        }
        N.set(tmp);
      }
    }
  }
  buildCHash();
  const cs = sim.cs, dt = 1 / SUB;
  for (const c of cs) {
    if ((T + c.id) % 3 === 0) think(c);
    c.phase += TAU * c.g.freq * (1 + c.fq) / 60;
    for (let s = 0; s < SUB; s++) stepC(c, dt);
  }
  collide();
  const births = [], dead = [];
  for (const c of cs) {
    updHeading(c); c.age++; if (c.flash > 0) c.flash--;
    if (!isFinite(c.x[0]) || !isFinite(c.E)) { c.E = -1; dead.push(c); continue; }
    // feeding
    let gain = 0;
    const nf = clamp(1.7 - 2.0 * (sim.morph[c.mk] || 1) / Math.max(40, cs.length), .5, 1.7), spdF = (.5 + Math.min(2, c.spd * 3)) * nf, f = c.g.filter * sim.FEED * spdF;
    if (f > 0) for (let i = 0; i < c.n; i++) {
      const ci = cellOf(c.x[i], c.y[i]), w = f * c.r[i] * FW[c.bd.nd[i].t]; if (w <= 0) continue;
      for (let q = 0; q < 3; q++) {
        const e = c.eff[q]; if (e <= 0) continue; const Nq = sim.L[q], av = Nq[ci]; if (av <= .005) continue;
        const take = Math.min(av * .5, w * e); Nq[ci] -= take; gain += take * 26 * VAL[q];
      }
    }
    if (c.g.photo > 0) gain += c.g.photo * .0011 * c.sumR * lightAt(c.cy) * nf;
    c.E = Math.min(c.Emax, c.E + gain); c.fed = lerp(c.fed, gain, .02);
    c.E -= c.upkeep * (1 + c.thr * .6);
    if (c.E <= 0 || c.age > c.maxAge) { dead.push(c); continue; }
    reproduceCheck(c, births);
  }
  for (const c of dead) {
    const i = cs.indexOf(c); if (i >= 0) cs.splice(i, 1); sim.deaths++;
    deposit(c.cx, c.cy, Math.min(1.5, c.mass * .02) * .6);
  }
  for (const b of births) spawn(b.g, b.x, b.y, b.E, b.brain, b.sp, b.gen, b.psi);
  if (T % 60 === 0) {
    for (const s of sim.species) s.count = 0; sim.morph = {}; for (const c of cs) { c.sp.count++; sim.morph[c.mk] = (sim.morph[c.mk] || 0) + 1; }
    for (const s of sim.species) { s.peak = Math.max(s.peak, s.count); if (s.count === 0 && !s.extinct) { s.extinct = true; } }
    sim.species = sim.species.filter(s => s.count > 0 || T - s.born < 600 || s.keep);
  }
  if (cs.length < 14) { // refugia: new protocells appear from the vents
    const v = sim.vents[(rnd() * sim.vents.length) | 0]; const par = cs.length ? pick(cs) : null;
    const g = par && rnd() < .7 ? mutG(par.g, 1) : founder();
    spawn(g, clamp(v.x + gauss() * 120, 60, WS - 60), clamp(v.y + gauss() * 80, 60, WS - 60), null, par ? mutBrain(par.w, 1) : null, par ? par.sp : null, par ? par.gen : 0);
  }
};

sim.init = function (seed, count) {
  seedRng(seed || 1); sim.T = 0; sim.cs = []; sim.species = []; sim.nextId = 1; sim.nextSp = 1; sim.maxGen = 0; sim.births = 0; sim.deaths = 0; sim.log = []; sim.capMul = 1;
  genWorld(); count = count || 60;
  for (let i = 0; i < count; i++) spawn(founder(), 1000 + rnd() * 1000, 500 + rnd() * 900, null, null, null, 0);
  sim.T = 1; say('Life begins as simple cells', '#8fd');
};
sim.event = function (name) {
  const cs = sim.cs;
  if (name === 'famine') { sim.capMul = .3; sim.eventUntil = sim.T + 2400; say('Famine: plankton collapses', '#f96'); }
  else if (name === 'bloom') { for (let i = 0; i < sim.N.length; i++) sim.N[i] = Math.min(2, sim.N[i] + sim.cap[i] * 1.2); sim.capMul = 1.6; sim.eventUntil = sim.T + 1800; say('Plankton bloom', '#6f9'); }
  else if (name === 'meteor') { const x = rnd() * WS, y = rnd() * WS * .8, R = 650; let k = 0; for (const c of cs) if (Math.hypot(c.cx - x, c.cy - y) < R) { c.E = -1; k++; } say('Impact: ' + k + ' creatures lost', '#f66'); sim.impact = { x, y, t: sim.T }; }
  else if (name === 'storm') { sim.mutMul = 3; sim.eventUntil = sim.T + 2400; say('Radiation storm: mutation surge', '#c9f'); }
  else if (name === 'hunters') { for (let i = 0; i < 6 && cs.length; i++) { const p = pick(cs), g = mutG(p.g, 1.5); g.bite = Math.max(g.bite, .6); g.instinct = Math.max(g.instinct, .8); g.filter *= .4; g.size = Math.min(30, g.size * 1.6); if (g.n < 3) g.n = 3; spawn(g, rnd() * WS, rnd() * WS * .7, null, null, p.sp, p.gen); } say('Hunters appear', '#f66'); }
};
const _tick = sim.tick;
sim.tick = function () { _tick(); if (sim.eventUntil && sim.T > sim.eventUntil) { sim.capMul = 1; sim.mutMul = sim.userMut; sim.eventUntil = 0; say('Conditions normalise', '#9bd'); } };
sim.spawn = spawn;
sim.userMut = 1.3; sim.mutMul = 1.3; sim.curAmp = 1; sim.AGAIN = .55; sim.FEED = .0006; sim.REGROW = .0002; sim.FG = .4;
sim.deposit = deposit;
sim.L = [sim.N, new Float32Array(GW * GW), new Float32Array(GW * GW)];
root.LIFE = sim;
if (typeof module !== 'undefined') module.exports = sim;
})(typeof window !== 'undefined' ? window : globalThis);
