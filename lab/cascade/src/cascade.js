/* cascade — чарт в языке RELIEF: книга → стадия → сегмент → страна (README §6.1, механика §7.6 B).
   Площадь диска честно под значение (донор magnitude: r = K·√v, один K на весь кадр, поэтому
   (r_i/r_j)² = v_i/v_j точно); дистанция ветви = доля в родителе; высота = уровень (§6.2).
   Три варианта отличаются композицией и раскладкой (RELIEF_VARIANT), не цветом:
     v1 · радиальное дерево: книга в центре, стадии по дуге spread, веер внутри сектора;
     v2 · веер-прибор: книга у левого края, ветви раскрываются вправо одной полудугой, засечки как шкала;
     v3 · мобиль: книга подвешена сверху, уровни висят ярусами, плечи по весу (Calder).
   Раскладка = чистая функция (data, rect, P, rand) → layout (L12): ручных координат нет. */
(function () {
  'use strict';
  const V = window.RELIEF_VARIANT || 'v1';
  const D = window.RELIEF_DATA;
  const { clamp, D2R, TAU, css } = RL;
  const Z = { z0: 0, z1: 4, z2: 12, z3: 28 };
  // ELEVATION (L5): корень и хабы z2, второй уровень и листья z1, ветви и подписи на z0
  const ELEVATION = { root: 'z2', stage: 'z2', segment: 'z1', country: 'z1', branch: 'z0', label: 'z0' };
  window.RELIEF_ELEVATION = ELEVATION;

  const SP = window.RELIEF_PARAMS.scene, VARIANTS = SP.variants;
  const VC = VARIANTS[V] || VARIANTS.v1;

  const fmtEUR = (v) => v >= 1e9 ? '€' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '€' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '€' + Math.round(v / 1e3) + 'K' : '€' + Math.round(v);
  const fmtVal = (n, metric) => metric === 'count' ? n.count + ' loans' : fmtEUR(n.value);
  const LEVEL = ['root', 'stage', 'segment', 'country'];

  // ── дерево из данных: глубина по ручке levels ─────────────────────────
  function tree(P) {
    let id = 0;
    const walk = (n, depth, parent) => {
      const node = { id: id++, label: n.label, value: n.value, count: n.count, depth, parent, kids: [], kind: LEVEL[depth] };
      node.v = P.metric === 'count' ? n.count : n.value;
      if (depth < P.levels && n.children) node.kids = n.children.map((c) => walk(c, depth + 1, node));
      return node;
    };
    const root = walk(D.breakdown, 0, null);
    const all = [];
    (function rec(n) { all.push(n); n.kids.forEach(rec); })(root);
    const leaves = (n) => n.kids.length ? n.kids.reduce((s, c) => s + leaves(c), 0) : 1;
    all.forEach((n) => { n.leaves = leaves(n); n.share = n.parent ? n.v / n.parent.v : 1; });
    return { root, all };
  }

  // ── раскладки ─────────────────────────────────────────────────────────
  // площадь честно: один K на кадр по крупнейшему первого уровня (magnitude: r = K·√v)
  function radii(T, P, S) {
    const v1 = Math.max(...T.root.kids.map((k) => k.v), 1e-9);
    const K = P.rmax * S / Math.sqrt(v1);
    T.all.forEach((n) => { n.r = Math.max(3 * S, K * Math.sqrt(n.v)); });
    T.K = K;
  }
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  // плечи мобиля: братья по весу по убыванию попеременно по обе стороны, |x_i| ∝ 1/w_i, Σ w_i·x_i = 0
  function arms(kids, span) {
    const s = kids.slice().sort((a, b) => b.v - a.v);
    const side = s.map((_, i) => (i % 2 ? -1 : 1));
    const nR = side.filter((x) => x > 0).length, nL = side.length - nR;
    const raw = s.map((k, i) => side[i] / (k.v * (side[i] > 0 ? nR : Math.max(1, nL))));
    const m = Math.max(...raw.map(Math.abs), 1e-12);
    s.forEach((k, i) => { k.arm = (s.length === 1 ? 0 : raw[i] / m * span); });
    return s;
  }

  function radial(T, P, rect, S, u, rand) {
    const cx = V === 'v2' ? rect.x + rect.w * 0.16 : rect.x + rect.w / 2;
    const cy = V === 'v2' ? rect.y + rect.h * 0.56 : rect.y + rect.h / 2;
    const minWH = Math.min(rect.w, rect.h);
    const L1 = (V === 'v2' ? 0.62 : 0.38) * minWH;
    const root = T.root; root.x = cx; root.y = cy; root.a = 0;
    const kids = root.kids, n = kids.length;
    const spread = clamp(P.spread, 30, 360) * D2R;
    const k0 = V === 'v2' ? 0 : Math.floor(rand() * 8);
    const start = V === 'v2' ? (-12 * D2R - spread / 2) : (-90 + 137.5 * k0) * D2R;
    const gap = 7 * D2R, gaps = spread >= TAU - 1e-6 ? n : Math.max(0, n - 1);
    const avail = Math.max(0.1, spread - gap * gaps);
    const W = kids.map((k) => Math.pow(k.leaves, 0.7)), SW = W.reduce((a, b) => a + b, 0);
    let a = start;
    T.links = [];
    kids.forEach((k, i) => {
      const sec = avail * W[i] / SW;
      k.a = a + sec / 2; k.sector = sec; a += sec + gap;
    });
    const place = (p, k, L, along) => {
      const d = dir(k.a);
      const len = p.r + k.r + u + (along != null ? along : L * k.share);
      k.x = p.x + d[0] * len; k.y = p.y + d[1] * len; k.len = len;
    };
    if (P.mode === 'balance') {
      // мобиль по оси корня: каждый хаб на своей оси, его дети на коромысле поперёк оси
      kids.forEach((k) => place(root, k, L1, L1 * 0.55));
    } else kids.forEach((k) => place(root, k, L1));
    kids.forEach((k) => T.links.push({ a: root, b: k, depth: 1 }));
    const rec = (p, depth) => {
      if (!p.kids.length) return;
      const Ld = L1 * Math.pow(0.55, depth - 1);
      if (P.phyllo) {
        // филлотаксис: k-й под углом k·137.508°, радиус ∝ √k вокруг родителя
        p.kids.forEach((c, j) => {
          const ang = p.a + (j + 1) * 137.508 * D2R, rr = p.r + c.r + u + Ld * 0.42 * Math.sqrt(j + 1);
          c.a = ang; c.x = p.x + Math.cos(ang) * rr; c.y = p.y + Math.sin(ang) * rr; c.sector = TAU / p.kids.length;
          T.links.push({ a: p, b: c, depth });
        });
      } else if (P.mode === 'balance') {
        const span = Ld * 0.9, fwd = p.r + Math.max(...p.kids.map((c) => c.r)) + u + Ld * 0.55;
        const d = dir(p.a), pr = [-d[1], d[0]];
        const ord = arms(p.kids, span);
        const bar = { cx: p.x + d[0] * fwd, cy: p.y + d[1] * fwd, pr, xs: [] };
        ord.forEach((c) => {
          c.a = p.a; c.sector = p.sector / p.kids.length;
          const off = c.arm;
          c.x = bar.cx + pr[0] * off + d[0] * (c.r + u * 0.5); c.y = bar.cy + pr[1] * off + d[1] * (c.r + u * 0.5);
          bar.xs.push(off);
          T.links.push({ a: p, b: c, depth, bar });
        });
        T.links.push({ rod: bar, a: p, depth });
      } else {
        const half = Math.min(60 * D2R, (p.sector || TAU) / 2) * 0.92;
        const m = p.kids.length, Wk = p.kids.map((c) => Math.pow(c.leaves, 0.7)), SWk = Wk.reduce((x, y) => x + y, 0);
        let acc = 0;
        p.kids.forEach((c, j) => {
          const f = m === 1 ? 0.5 : (acc + Wk[j] / 2) / SWk; acc += Wk[j];
          c.a = p.a - half + 2 * half * f; c.sector = 2 * half * Wk[j] / SWk;
          place(p, c, Ld);
          T.links.push({ a: p, b: c, depth });
        });
      }
      p.kids.forEach((c) => rec(c, depth + 1));
    };
    kids.forEach((k) => rec(k, 2));
  }

  // v3 · мобиль сверху вниз (Calder): дети на коромысле, коромысло висит в центре масс,
  // поэтому Σ w_i·x_i = 0 точно и тяжёлое ближе к точке подвеса. Порядок на коромысле: по весу
  // по убыванию попеременно справа и слева от центра. Пролёты поддеревьев не наезжают (снизу вверх).
  // share: длина нити = u + Ld·доля (дистанция несёт долю); balance: нити равные, несут только плечи
  function mobile(T, P, rect, S, u) {
    const root = T.root, gap = u * 0.9;
    const Ld0 = rect.h * 0.20;
    const ext = (n) => {
      n.L = -n.r; n.R = n.r;
      if (!n.kids.length) return;
      n.kids.forEach(ext);
      const s = n.kids.slice().sort((a, b) => b.v - a.v), seq = [];
      s.forEach((c, i) => { if (i % 2) seq.unshift(c); else seq.push(c); });
      let x = 0;
      seq.forEach((c, i) => { if (i) x += seq[i - 1].R + gap - c.L; c.rx = x; });
      const W = seq.reduce((t, c) => t + c.v, 0), com = seq.reduce((t, c) => t + c.v * c.rx, 0) / W;
      seq.forEach((c) => { c.rx -= com; n.L = Math.min(n.L, c.rx + c.L); n.R = Math.max(n.R, c.rx + c.R); });
      n.seq = seq;
    };
    ext(root);
    T.links = [];
    root.x = rect.x + rect.w / 2 + (root.L + root.R) / -2; root.y = rect.y + root.r;
    const rec = (p, depth) => {
      if (!p.kids.length) return;
      const Ld = Ld0 * Math.pow(0.62, depth - 1);
      const rodY = p.y + p.r + u + Ld * 0.35;
      p.kids.forEach((c) => {
        c.x = p.x + c.rx;
        const str = P.mode === 'share' ? u + Ld * c.share : u + Ld * 0.45;
        c.y = rodY + str + c.r;
      });
      const xs = p.kids.map((c) => c.rx);
      T.links.push({ hangRod: { y: rodY, x0: p.x + Math.min(0, ...xs), x1: p.x + Math.max(0, ...xs) }, a: p, depth });
      p.kids.forEach((c) => T.links.push({ a: p, b: c, depth, string: rodY }));
      p.kids.forEach((c) => rec(c, depth + 1));
    };
    rec(root, 1);
  }

  // разнос столкновений: угол ветви сохраняется, удлиняется только ветвь младшего (с поддеревом).
  // Доля остаётся читаемой линейкой засечек от края родителя; диск не накрывает соседа
  function relax(T, u) {
    const sub = (n, dx, dy) => { n.x += dx; n.y += dy; n.kids.forEach((c) => sub(c, dx, dy)); };
    const anc = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
    for (let it = 0; it < 120; it++) {
      let moved = false;
      for (let i = 0; i < T.all.length; i++) for (let j = i + 1; j < T.all.length; j++) {
        const a = T.all[i], b = T.all[j];
        const need = a.r + b.r + u * 0.6, d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= need) continue;
        if (b.parent === a || a.parent === b) continue;
        let m = (b.depth > a.depth || (b.depth === a.depth && b.r <= a.r)) ? b : a;
        if (anc(m, m === a ? b : a)) m = m === a ? b : a;
        if (!m.parent) continue;
        const ex = m.x - m.parent.x, ey = m.y - m.parent.y, el = Math.hypot(ex, ey) || 1;
        const step = Math.min(need - d, u * 2) * 0.6 + 0.5;
        sub(m, ex / el * step, ey / el * step);
        moved = true;
      }
      if (!moved) break;
    }
  }

  // вписать в поле: позиции и радиусы одним множителем (пропорции площадей не трогаются)
  function fit(T, rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    T.all.forEach((n) => { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); });
    const pad = 28 * T.S;
    const s = Math.min(1, rect.w / (x1 - x0 + 2 * pad), rect.h / (y1 - y0 + 2 * pad));
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, tx = rect.x + rect.w / 2, ty = rect.y + rect.h / 2;
    T.all.forEach((n) => { n.x = tx + (n.x - bx) * s; n.y = ty + (n.y - by) * s; n.r *= s; });
    T.links.forEach((l) => { if (l.hangRod) { l.hangRod.y = ty + (l.hangRod.y - by) * s; l.hangRod.x0 = tx + (l.hangRod.x0 - bx) * s; l.hangRod.x1 = tx + (l.hangRod.x1 - bx) * s; } if (l.string != null) l.string = ty + (l.string - by) * s; if (l.bar && !l.bar._f) { l.bar._f = 1; l.bar.cx = tx + (l.bar.cx - bx) * s; l.bar.cy = ty + (l.bar.cy - by) * s; l.bar.xs = l.bar.xs.map((x) => x * s); } if (l.rod && !l.rod._f) { l.rod._f = 1; l.rod.cx = tx + (l.rod.cx - bx) * s; l.rod.cy = ty + (l.rod.cy - by) * s; l.rod.xs = l.rod.xs.map((x) => x * s); } });
    T.fitScale = s;
  }

  // подписи §7.6 B: кандидаты по ветви наружу, затем ±90°, первый свободный побеждает
  function labels(g, T, P, S) {
    const boxes = T.all.map((n) => ({ x0: n.x - n.r, y0: n.y - n.r, x1: n.x + n.r, y1: n.y + n.r, disc: n }));
    // заголовок и легенда заняты: подпись туда не садится
    const m = 0.06 * Math.min(T.W, T.H);
    const placed = [{ x0: 0, y0: 0, x1: T.W * 0.62, y1: m + 52 * S }, { x0: 0, y0: T.H - m - 84 * S, x1: m + 340 * S, y1: T.H }, { x0: T.W - m - 120 * S, y0: T.H - m - 24 * S, x1: T.W, y1: T.H }];
    const hit = (b) => boxes.some((q) => (q.disc ? discHit(q.disc, b) : (b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)));
    const out = [];
    T.all.forEach((n) => {
      const big = n.depth <= 1, mid = n.depth === 2, small = n.depth === 3;
      if (small && n.r < 7 * S) return;
      const name = n.depth === 0 ? 'Loan book' : n.label;
      const val = fmtVal(n, P.metric);
      const sz = n.depth === 0 ? 16.8 : n.depth === 1 ? 14 : 11.67;
      const lines = small ? [{ s: name, o: { size: 11.67, mono: true } }]
        : [{ s: name, o: { size: sz * S < 11.67 ? 11.67 : sz, weight: big ? 500 : 400 } }, { s: val, o: { size: 11.67, mono: true } }];
      lines.forEach((l) => { l.o.size = Math.max(11.67, l.o.size * Math.max(0.8, Math.min(1, S * 1.25))); l.w = RL.measure(g, l.s, l.o); });
      const w = Math.max(...lines.map((l) => l.w)), lh = lines.reduce((s2, l) => s2 + l.o.size * 1.2, 0);
      // внутри диска, если помещается (число печатается на плашке)
      if (n.r * 1.6 > w && n.r * 1.4 > lh && big) { out.push({ n, lines, inside: true, x: n.x, y: n.y - lh / 2, w, h: lh }); return; }
      const base = n.parent ? Math.atan2(n.y - n.parent.y, n.x - n.parent.x) : -Math.PI / 2;
      const cand = [base, base + Math.PI / 2, base - Math.PI / 2, base + Math.PI];
      for (const a of cand) {
        const gap = n.r + 6 * S, cxp = n.x + Math.cos(a) * gap, cyp = n.y + Math.sin(a) * gap;
        const ax = Math.cos(a), ay = Math.sin(a);
        const x0 = ax > 0.35 ? cxp : ax < -0.35 ? cxp - w : cxp - w / 2;
        const y0 = ay > 0.35 ? cyp : ay < -0.35 ? cyp - lh : cyp - lh / 2;
        const b = { x0, y0, x1: x0 + w, y1: y0 + lh };
        if (b.x0 < 4 || b.y0 < 4 || b.x1 > T.W - 4 || b.y1 > T.H - 4) continue;
        if (hit(b) || placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
        placed.push(b); out.push({ n, lines, x: x0, y: y0, w, h: lh, box: b }); break;
      }
    });
    return out;
  }
  function discHit(n, b) {
    const qx = clamp(n.x, b.x0, b.x1), qy = clamp(n.y, b.y0, b.y1);
    return Math.hypot(n.x - qx, n.y - qy) < n.r + 1;
  }

  // метрики P-R1 (§7.6 B): три крупнейших попарно ≥ 0,22 диагонали, воздух 40–70 %, пересечений 0
  function metrics(T, labs, rect) {
    const top = T.all.slice().sort((a, b) => b.r - a.r).slice(0, 3);
    const diag = Math.hypot(rect.w, rect.h);
    let minPair = 1e9;
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) minPair = Math.min(minPair, Math.hypot(top[i].x - top[j].x, top[i].y - top[j].y) / diag);
    const ink = T.all.reduce((s, n) => s + Math.PI * n.r * n.r, 0);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    T.all.forEach((n) => { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); });
    const air = 1 - ink / Math.max(1, (x1 - x0) * (y1 - y0));
    const cross = labs.filter((l) => !l.inside && T.all.some((n) => discHit(n, l.box))).length;
    let overlap = 0;
    for (let i = 0; i < T.all.length; i++) for (let j = i + 1; j < T.all.length; j++) { const a = T.all[i], b = T.all[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 0.5) overlap++; }
    return { top3MinPairDiag: +minPair.toFixed(3), air: +air.toFixed(3), labelDiscCross: cross, discOverlaps: overlap, labels: labs.length };
  }

  // ── кеш раскладки: пересборка только при смене ручек раскладки или размера ─
  let CACHE = null;
  const LAYOUT_KEYS = ['mode', 'levels', 'spread', 'phyllo', 'rmax', 'metric'];
  function layout(ctx, g) {
    const P = ctx.P, W = ctx.W, H = ctx.H;
    const key = [W, H, ctx.seed].concat(LAYOUT_KEYS.map((k) => P[k])).join('|');
    if (CACHE && CACHE.key === key) return CACHE;
    const S = clamp(Math.min(W / 1440, H / 900), 0.34, 1.6), u = Math.min(W, H) / 48;
    const m = 0.06 * Math.min(W, H);
    const rect = { x: m, y: m + 28 * S, w: W - 2 * m, h: H - 2 * m - 56 * S };
    const T = tree(P); T.S = S; T.W = W; T.H = H;
    radii(T, P, S);
    if (V === 'v3') mobile(T, P, rect, S, u); else radial(T, P, rect, S, u, ctx.rand);
    if (V !== 'v3') relax(T, u);
    fit(T, rect);
    const labs = labels(g, T, P, S);
    T.labs = labs; T.rect = rect; T.u = u;
    T.metrics = metrics(T, labs, rect);
    window.__METRICS = T.metrics;
    T.key = key;
    CACHE = T;
    return T;
  }

  function draw(ctx) {
    const g = ctx.g, P = ctx.P, S = clamp(Math.min(ctx.W / 1440, ctx.H / 900), 0.34, 1.6);
    const ph = RL.phases(ctx, 64);        // фазы первыми: число вызовов rand не зависит от окна
    const T = layout(ctx, g);
    const zs = P.zscale * S;
    const order = T.all.slice().sort((a, b) => (Z[ELEVATION[b.kind]] - Z[ELEVATION[a.kind]]) || (a.y - b.y) || (a.x - b.x));
    const tEnd = RL.assembleEnd(ctx, order.length);
    const acc = RL.tokens(ctx.theme).acc[P.accent] || RL.tokens(ctx.theme).acc.terracotta;
    const focus = T.all.find((n) => n.kind === 'stage' && n.label === 'non-performing');
    // живые позиции: плавание, оседание хабов после сборки, подъём сборкой
    const live = new Map();
    order.forEach((n, k) => {
      const h0 = Z[ELEVATION[n.kind]] * zs;
      const hub = n.depth <= 1;
      const env = hub ? RL.settle(ctx, tEnd + 0.4) : (ctx.reduced ? 0 : 1);
      const f = RL.float(ctx, ph[n.id % ph.length], 2 * n.r, h0, env);
      const up = RL.assemble(ctx, k);
      live.set(n.id, { x: n.x + f.dx, y: n.y + f.dy, h: Math.max(0, (h0 + f.dh) * up) });
    });
    const at = (n) => live.get(n.id);

    const plates = T.all.map((n) => {
      const q = at(n);
      return {
        id: n.id, kind: 'disc', x: q.x, y: q.y, r: n.r, h: q.h, flatPlate: true,
        print: (gg, L) => {
          if (n === focus) { gg.fillStyle = css(acc); gg.beginPath(); gg.arc(q.x + n.r * 0.42, q.y - n.r * 0.42, Math.max(3, 3.5 * S), 0, TAU); gg.fill(); }
        }
      };
    });

    const floor = (gg, L) => {
      // ветви: структура вырезана в материале (рельефная линия), зазор у узла 3 px (Joint gap)
      const gap = 3 * S;
      T.links.forEach((l) => {
        if (l.rod) {
          const b = l.rod, a = at(l.a), dx = a.x - l.a.x, dy = a.y - l.a.y;
          const lo = Math.min(0, ...b.xs), hi = Math.max(0, ...b.xs);
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(b.cx + b.pr[0] * lo + dx + ox, b.cy + b.pr[1] * lo + dy + oy); gg.lineTo(b.cx + b.pr[0] * hi + dx + ox, b.cy + b.pr[1] * hi + dy + oy); });
          // нить от родителя к коромыслу
          const ex = b.cx + dx - a.x, ey = b.cy + dy - a.y, el = Math.hypot(ex, ey) || 1;
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(a.x + ex / el * (l.a.r + gap) + ox, a.y + ey / el * (l.a.r + gap) + oy); gg.lineTo(b.cx + dx + ox, b.cy + dy + oy); });
          return;
        }
        if (l.hangRod) {
          const r = l.hangRod, a = at(l.a);
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(r.x0 + ox, r.y + oy); gg.lineTo(r.x1 + ox, r.y + oy); });
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(a.x + ox, a.y + l.a.r + gap + oy); gg.lineTo(a.x + ox, r.y + oy); });
          return;
        }
        const a = at(l.a), b = at(l.b);
        if (l.string != null) {
          const sx = l.a.x + l.b.rx * T.fitScale;
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(sx + ox, l.string + oy); gg.lineTo(b.x + ox, b.y - l.b.r - gap + oy); });
          if (P.ticks && P.mode === 'share') ticks(gg, L, sx, l.string, b.x, b.y - l.b.r, l.b.share, T.rect.h * 0.20 * Math.pow(0.62, l.depth - 1) * T.fitScale, S, true);
          return;
        }
        if (l.bar) {
          const bar = l.bar, dx = a.x - l.a.x, dy = a.y - l.a.y;
          const sx = bar.cx + bar.pr[0] * l.b.arm + dx, sy = bar.cy + bar.pr[1] * l.b.arm + dy;
          const ex = b.x - sx, ey = b.y - sy, el = Math.hypot(ex, ey) || 1;
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(sx + ox, sy + oy); gg.lineTo(b.x - ex / el * (l.b.r + gap) + ox, b.y - ey / el * (l.b.r + gap) + oy); });
          return;
        }
        if (l.elbow) {
          const my = (a.y + l.a.r + b.y - l.b.r) / 2;
          RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(a.x + ox, a.y + l.a.r + gap + oy); gg.lineTo(a.x + ox, my + oy); gg.lineTo(b.x + ox, my + oy); gg.lineTo(b.x + ox, b.y - l.b.r - gap + oy); });
          if (P.ticks && P.mode === 'share') ticks(gg, L, b.x, my, b.x, b.y - l.b.r, l.b.share, T.rect.h * 0.30 * Math.pow(0.62, l.depth - 1) * T.fitScale, S, true);
          return;
        }
        const ex = b.x - a.x, ey = b.y - a.y, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el;
        const x0 = a.x + ux * (l.a.r + gap), y0 = a.y + uy * (l.a.r + gap), x1 = b.x - ux * (l.b.r + gap), y1 = b.y - uy * (l.b.r + gap);
        RL.relief(gg, L, (ox, oy) => { gg.beginPath(); gg.moveTo(x0 + ox, y0 + oy); gg.lineTo(x1 + ox, y1 + oy); });
        if (P.ticks && P.mode === 'share' && !P.phyllo) {
          const L1 = (V === 'v2' ? 0.62 : 0.38) * Math.min(T.rect.w, T.rect.h) * Math.pow(0.55, l.depth - 1) * T.fitScale;
          ticks(gg, L, x0, y0, x0 + ux * L1 * l.b.share, y0 + uy * L1 * l.b.share, l.b.share, L1, S, false);
        }
      });
      // подписи на z0 вне дисков: чернила, моноширинные числа
      T.labs.forEach((lb) => {
        if (lb.inside) return;
        const q = at(lb.n), dx = q.x - lb.n.x, dy = q.y - lb.n.y;
        let y = lb.y + dy;
        lb.lines.forEach((ln, i) => {
          y += ln.o.size * (i ? 1.2 : 1.0);
          RL.text(gg, ln.s, lb.x + dx, y, Object.assign({ color: css(i ? L.T.ink3 : (lb.n.depth <= 1 ? L.T.ink : L.T.ink2)) }, ln.o));
        });
      });
      chrome(gg, L, ctx, T, S);
    };
    const over = (gg, L) => {
      // числа на плашках крупных дисков: печать поверх света, чтобы тень не съедала контраст
      T.labs.forEach((lb) => {
        if (!lb.inside) return;
        const q = at(lb.n);
        let y = q.y - lb.h / 2;
        lb.lines.forEach((ln, i) => {
          y += ln.o.size * (i ? 1.2 : 1.0);
          RL.text(gg, ln.s, q.x, y, Object.assign({ color: css(i ? L.T.ink3 : L.T.ink), align: 'center' }, ln.o));
        });
      });
      if (P.hand && focus) { const q = at(focus); RL.handRing(gg, L, q.x, q.y, focus.r + 10 * S, focus.r + 8 * S, ctx.randPal); }
    };
    RL.render(ctx, { plates, floor, over });
  }

  // засечки каждые 10 % доли: 3 px, α .35 (прибор, а не украшение)
  function ticks(g, L, x0, y0, x1, y1, share, full, S, vertical) {
    const n = Math.floor(share * 10 + 1e-6); if (n < 1) return;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, px = -uy, py = ux;
    const step = full / 10;
    if (step < 5 * S) return;
    g.save(); g.lineWidth = L.lineW; g.strokeStyle = css(L.T.ink2, 0.35); g.beginPath();
    for (let i = 1; i <= n; i++) {
      const d = i * step; if (d > len + 0.5) break;
      const cx = x0 + ux * d, cy = y0 + uy * d, t = 3 * S;
      g.moveTo(cx - px * t, cy - py * t); g.lineTo(cx + px * t, cy + py * t);
    }
    // конец линейки: доля родителя, засечка вдвое длиннее
    const ex = x0 + ux * share * full, ey = y0 + uy * share * full, te = 6 * S;
    g.moveTo(ex - px * te, ey - py * te); g.lineTo(ex + px * te, ey + py * te);
    g.stroke(); g.restore();
  }

  // заголовок, встроенная легенда «How to read», строка Fictional data
  function chrome(g, L, ctx, T, S) {
    const m = 0.06 * Math.min(ctx.W, ctx.H), P = ctx.P;
    const t1 = Math.max(11.67, 11.67 * Math.min(1.2, S * 1.2)), t3 = Math.max(14, 16.8 * Math.min(1.2, S * 1.2));
    RL.text(g, RL.fit(g, 'Loan book, ' + (P.metric === 'count' ? 'loans' : 'exposure') + ' by stage, segment and country', { size: t3, weight: 500 }, ctx.W - 2 * m), m, m + t3 * 0.4, { size: t3, weight: 500, color: css(L.T.ink) });
    RL.text(g, 'As of ' + D.meta.asOf + ' · ' + fmtVal(T.root, P.metric) + ' · ' + T.root.count + ' loans', m, m + t3 * 0.4 + t1 * 1.6, { size: t1, mono: true, color: css(L.T.ink3) });
    const lines = [
      'HOW TO READ',
      'Area = ' + (P.metric === 'count' ? 'number of loans' : 'exposure, EUR'),
      P.mode === 'share' ? 'Distance = share of parent' : (V === 'v3' ? 'Each rod hangs at its centre of mass' : 'Arm = 1 / weight'),
      P.mode === 'share' && P.ticks ? 'Tick = 10 % of parent' : 'Heavier hangs closer',
      'Height = level: book, stage › segment, country'
    ];
    let y = ctx.H - m - (lines.length - 1) * t1 * 1.35;
    lines.forEach((s, i) => { RL.text(g, s, m, y, { size: t1, mono: i > 0, caps: i === 0, weight: i === 0 ? 500 : 400, color: css(L.T.ink3) }); y += t1 * 1.35; });
    // узкий кадр: строка о данных уходит под заголовок, чтобы не встретиться с легендой
    if (ctx.W < 600) RL.text(g, 'Fictional data', m, m + t3 * 0.4 + t1 * 3.1, { size: t1, mono: true, color: css(L.T.ink3) });
    else RL.text(g, 'Fictional data', ctx.W - m, ctx.H - m, { size: t1, mono: true, align: 'right', color: css(L.T.ink3) });
  }

  RL.boot({
    variant: V,
    head: { title: VC.title, sub: VC.sub },
    values: VC.values,
    scene: {
      id: 'cascade',
      title: 'Cascade · ' + V,
      blurb: SP.blurb,
      draw,
      structural: function () { CACHE = null; }
    },
    groups: SP.groups
  });
})();
