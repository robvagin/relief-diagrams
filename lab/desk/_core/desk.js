// desk.js — сцена 02 `desk`: дашборд как стол. Плашки-виджеты на разной высоте, тени друг на друга,
// ритм дробления §7.6 A. Раскладка = чистая функция (widgets, rect, params, rand) → layout (L12).
// От донора pitch-composer: одна шкала кадра (здесь uiScale), число к подписи ≈ 5:1 с подписью моно,
// вход плашек по порядку чтения с шагом, диагональ «число внизу слева → акцент вверху справа».
// Дробления в доноре нет: деление по долям {0.5, 0.382, 0.618} написано здесь по §7.6 A.
(function () {
  'use strict';
  const R = window.RELIEF, K = window.RINK, TAU = R.TAU;
  const RATIOS = [0.5, 0.382, 0.618];

  // ── виджеты: вес = площадь на столе, kind = чем печатается ─────────────
  const WIDGETS = [
    { id: 'kpi', w: 3.0, title: 'Exposure' },
    { id: 'cascade', w: 2.6, title: 'Book by stage' },
    { id: 'gate', w: 2.4, title: 'Check before action' },
    { id: 'ledger', w: 2.0, title: 'Exposure, 12 months' },
    { id: 'npl', w: 1.5, title: 'NPL share' },
    { id: 'glyph', w: 1.3, title: 'Agents' },
    { id: 'rule', w: 1.1, title: 'Rule' },
    { id: 'counts', w: 1.0, title: 'Model of record' }
  ];

  // ритм «крупный · мелкий · средний · мелкий»: по убыванию веса, затем чередование с хвоста
  function rhythm(items) {
    const s = items.slice().sort((a, b) => b.w - a.w || (a.tie - b.tie));
    const out = []; let i = 0, j = s.length - 1, big = true;
    while (i <= j) { out.push(big ? s[i++] : s[j--]); big = !big; }
    return out;
  }

  // ── §7.6 A · дробление ──────────────────────────────────────────────────
  // рекурсивно по длинной стороне; доля разреза из {0.5, 0.382, 0.618} по сумме весов каждой стороны
  function subdivide(rect, items, depth, gap, out) {
    if (items.length === 1) { out.push(Object.assign({ r: rect }, items[0])); return; }
    const long = rect.w >= rect.h;
    if (depth <= 0) {
      // глубина кончилась: полоса по длинной стороне пропорционально весам
      const tot = items.reduce((a, b) => a + b.w, 0); let acc = 0;
      items.forEach(it => {
        const k0 = acc / tot, k1 = (acc + it.w) / tot; acc += it.w;
        const r = long ? { x: rect.x + rect.w * k0, y: rect.y, w: rect.w * (k1 - k0), h: rect.h }
                       : { x: rect.x, y: rect.y + rect.h * k0, w: rect.w, h: rect.h * (k1 - k0) };
        out.push(Object.assign({ r: inset(r, gap / 2, long) }, it));
      });
      return;
    }
    const tot = items.reduce((a, b) => a + b.w, 0);
    let best = null;
    for (let k = 1; k < items.length; k++) {
      const a = items.slice(0, k).reduce((s, b) => s + b.w, 0) / tot;
      RATIOS.forEach(rr => { const e = Math.abs(a - rr); if (!best || e < best.e - 1e-9) best = { e, k, rr }; });
    }
    const A = items.slice(0, best.k), B = items.slice(best.k), cut = best.rr;
    let ra, rb;
    if (long) {
      const wa = (rect.w - gap) * cut;
      ra = { x: rect.x, y: rect.y, w: wa, h: rect.h }; rb = { x: rect.x + wa + gap, y: rect.y, w: rect.w - wa - gap, h: rect.h };
    } else {
      const ha = (rect.h - gap) * cut;
      ra = { x: rect.x, y: rect.y, w: rect.w, h: ha }; rb = { x: rect.x, y: rect.y + ha + gap, w: rect.w, h: rect.h - ha - gap };
    }
    subdivide(ra, A, depth - 1, gap, out);
    subdivide(rb, B, depth - 1, gap, out);
  }
  function inset(r, d, long) {
    return long ? { x: r.x + d, y: r.y, w: Math.max(1, r.w - 2 * d), h: r.h } : { x: r.x, y: r.y + d, w: r.w, h: Math.max(1, r.h - 2 * d) };
  }

  // воздух: пустые листья с общим весом под цель air
  function withAir(widgets, air, rand) {
    const tot = widgets.reduce((a, b) => a + b.w, 0);
    const airW = tot * air / Math.max(0.05, 1 - air);
    const n = air > 0.5 ? 4 : air > 0.38 ? 3 : 2;
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(0.6 + rand() * 0.8);
    const ps = parts.reduce((a, b) => a + b, 0);
    return widgets.concat(parts.map((p, i) => ({ id: 'air' + i, air: true, w: airW * p / ps, tie: 10 + i })));
  }

  // сетка: 12 колонок, пролёты из {3,4,6,8,12}
  function gridLayout(rect, items, gap, air) {
    const cols = 12, cw = (rect.w - gap * (cols - 1)) / cols;
    const spanOf = it => it.hero ? 8 : it.w >= 2.4 ? 6 : it.w >= 1.4 ? 4 : 3;
    const rows = []; let row = [], used = 0;
    items.filter(it => !it.air).forEach(it => {
      const s = spanOf(it);
      if (used + s > cols) { rows.push({ cells: row, used }); row = []; used = 0; }
      row.push({ it, s }); used += s;
    });
    if (row.length) rows.push({ cells: row, used });
    // высота ряда по весу; пустые колонки = воздух
    const rw = rows.map(r => Math.max.apply(null, r.cells.map(c => c.it.w)) + 0.6);
    const tot = rw.reduce((a, b) => a + b, 0);
    const hAvail = rect.h - gap * (rows.length - 1);
    const out = []; let y = rect.y;
    rows.forEach((r, ri) => {
      const h = hAvail * rw[ri] / tot;
      // воздух: колонка-пауза в начале нечётных рядов, если ряд неполный
      let c0 = (ri % 2 === 1 && r.used < cols) ? cols - r.used : 0;
      r.cells.forEach(c => {
        const x = rect.x + c0 * (cw + gap), w = c.s * cw + (c.s - 1) * gap;
        const hh = c.it.hero ? h : h * (1 - 0.18 * air * (c.s <= 3 ? 1 : 0));
        out.push(Object.assign({ r: { x, y, w, h: hh } }, c.it));
        c0 += c.s;
      });
      y += h + gap;
    });
    return out;
  }

  // нахлёст героя на соседа: не больше overlap площади нижней плашки
  function heroOverlap(lay, overlap, gap) {
    const hero = lay.find(l => l.hero); if (!hero || overlap <= 0) return;
    let best = null;
    lay.forEach(o => {
      if (o === hero || o.air) return;
      const a = hero.r, b = o.r;
      const vy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const vx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (vy > 0 && Math.abs(b.x - (a.x + a.w) - gap) < 2) best = best || { o, side: 'r', len: vy };
      else if (vy > 0 && Math.abs(a.x - (b.x + b.w) - gap) < 2) best = best || { o, side: 'l', len: vy };
      else if (vx > 0 && Math.abs(b.y - (a.y + a.h) - gap) < 2) best = best || { o, side: 'b', len: vx };
    });
    if (!best) return;
    const b = best.o.r, A = b.w * b.h;
    const d = best.side === 'b' ? Math.min(overlap * b.h, overlap * A / Math.max(1, best.len)) : Math.min(overlap * b.w, overlap * A / Math.max(1, best.len));
    if (best.side === 'r') hero.r = Object.assign({}, hero.r, { w: hero.r.w + gap + d });
    if (best.side === 'l') hero.r = Object.assign({}, hero.r, { x: hero.r.x - gap - d, w: hero.r.w + gap + d });
    if (best.side === 'b') hero.r = Object.assign({}, hero.r, { h: hero.r.h + gap + d });
    hero.overOn = best.o.id;
  }

  // уровни: герой z3; 2–4 второстепенных z2 (по весу); остальные z1
  function levels(lay, nZ2) {
    const ws = lay.filter(l => !l.air && !l.hero && !l.flat).sort((a, b) => b.w - a.w || a.tie - b.tie);
    lay.forEach(l => { l.z = l.air ? 0 : l.hero ? 3 : 1; });
    ws.slice(0, nZ2).forEach(l => { l.z = 2; });
  }

  // ── метрики P-R1 §7.6 A: считаются на кадре и печатаются в мете студии ──
  function metrics(lay, rect, u) {
    const area = rect.w * rect.h;
    const plates = lay.filter(l => !l.air);
    const cov = plates.reduce((a, l) => a + l.r.w * l.r.h, 0);
    let pairs = 0;
    for (let i = 0; i < plates.length; i++) for (let j = i + 1; j < plates.length; j++) {
      const a = plates[i].r, b = plates[j].r;
      if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5) pairs++;
    }
    return {
      air: 1 - cov / area, z3: plates.filter(l => l.z === 3).length, z2: plates.filter(l => l.z === 2).length,
      overlapPairs: pairs, minSideU: Math.min.apply(null, plates.map(l => Math.min(l.r.w, l.r.h))) / u
    };
  }

  // ── печать виджетов: всё на верхе плашки, клип по плашке ───────────────
  function pad(F) { return Math.max(6, 14 * F.ui); }
  function head(g, ctx, F, I, r, title, sub) {
    const p = pad(F);
    K.text(g, F, title, r.x + p, r.y + p + 9 * F.ui, { size: 1, color: I.ink3, caps: true, weight: 500, min: 7 });
    if (sub) K.text(g, F, sub, r.x + r.w - p, r.y + p + 9 * F.ui, { size: 1, color: I.ink3, mono: true, align: 'right', min: 7 });
  }
  const D = () => window.RELIEF_DATA;

  const PRINT = {
    kpi(g, ctx, F, L, I, r, it) {
      const k = D().kpi, s = D().series, p = pad(F);
      head(g, ctx, F, I, r, 'Exposure', 'as of 30 Sep 2026');
      const big = Math.min(it.hero ? 11 : 9, 4 + Math.floor(Math.min(r.w / (150 * F.ui), r.h / (60 * F.ui))));
      const num = K.eur(k.exposure);
      const by = r.y + r.h * (it.hero ? 0.56 : 0.6);
      const px = K.text(g, F, num, r.x + p, by, { size: big, mono: true, weight: 500, color: I.ink });
      const d = s.exposure[11] / s.exposure[0] - 1;
      K.text(g, F, '+' + K.pct(d) + ' in 12 months', r.x + p, by + px * 0.42 + 6 * F.ui, { size: 2, mono: true, color: I.ink2, min: 7 });
      // спарклайн печатью снизу
      const sy0 = r.y + r.h - p, sh = Math.min(r.h * 0.16, 40 * F.ui), sx0 = r.x + p, sw = r.w - 2 * p;
      if (sh > 8) {
        const lo = Math.min.apply(null, s.exposure), hi = Math.max.apply(null, s.exposure);
        g.beginPath();
        s.exposure.forEach((v, i) => { const x = sx0 + sw * i / 11, y = sy0 - sh * (v - lo) / (hi - lo); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.strokeStyle = I.ink2; g.lineWidth = F.lineW; g.stroke();
        g.fillStyle = I.acc; g.beginPath(); g.arc(sx0 + sw, sy0 - sh, Math.max(2.5, 4 * F.ui), 0, TAU); g.fill();
      }
      if (ctx.P.hand) K.handRing(g, ctx, F, r.x + p + px * 2.2, by - px * 0.36, px * 2.6, px * 0.78, ctx.randPal);
    },
    cascade(g, ctx, F, L, I, r) {
      const b = D().breakdown, p = pad(F);
      head(g, ctx, F, I, r, 'Book by stage', String(b.count) + ' loans');
      const kids = b.children, vmax = kids[0].value;
      const ih = r.h - 2 * p - 22 * F.ui, iw = r.w - 2 * p;
      const rmax = Math.min(ih * 0.42, iw / 4.6);
      const cy = r.y + p + 22 * F.ui + ih * 0.48;
      let x = r.x + p + rmax;
      kids.forEach((c, i) => {
        const rr = Math.max(3, rmax * Math.sqrt(c.value / vmax));
        // структура: ветка рельефом от корня-полосы
        if (i) K.relief(g, ctx, F, L, K.hline(x - rr - 10 * F.ui, x - rr - 2 * F.ui, cy));
        g.beginPath(); g.arc(x, cy, rr, 0, TAU);
        g.fillStyle = c.label === 'non-performing' ? I.a('ink', 0.18) : c.label === 'watch' ? I.a('ink', 0.09) : I.a('ink', 0.04); g.fill();
        g.lineWidth = F.lineW; g.strokeStyle = I.a('ink', 0.35); g.stroke();
        K.text(g, F, c.label, x, cy + rr + 14 * F.ui, { size: 1, color: I.ink2, align: 'center', min: 7 });
        K.text(g, F, K.eur(c.value), x, cy + rr + 28 * F.ui, { size: 1, mono: true, color: I.ink3, align: 'center', min: 7 });
        if (c.label === 'non-performing') { g.fillStyle = I.acc; g.beginPath(); g.arc(x, cy, Math.max(2.5, 4 * F.ui), 0, TAU); g.fill(); }
        x += rr + (i < kids.length - 1 ? Math.max(14 * F.ui, rmax * Math.sqrt(kids[i + 1].value / vmax) + 16 * F.ui) : 0);
      });
    },
    gate(g, ctx, F, L, I, r) {
      const d = D().decisions[0], p = pad(F);
      head(g, ctx, F, I, r, 'Check before action', d.id);
      const rows = d.checks, y0 = r.y + p + 34 * F.ui, lh = Math.min((r.h - (y0 - r.y) - p - 26 * F.ui) / rows.length, 30 * F.ui);
      K.text(g, F, d.action, r.x + p, y0, { size: 3, color: I.ink, weight: 500, min: 8 });
      rows.forEach((c, i) => {
        const y = y0 + (i + 1) * lh + 6 * F.ui;
        K.relief(g, ctx, F, L, K.hline(r.x + p, r.x + r.w - p, y - lh + 8 * F.ui));
        K.text(g, F, c.ref, r.x + p, y, { size: 2, color: I.ink2, min: 7 });
        const ok = c.result === 'pass';
        const rx = r.x + r.w - p;
        if (ok) { K.text(g, F, '✓', rx, y, { size: 2, color: I.ink, align: 'right', min: 7 }); }
        else if (c.result === 'missing') {
          g.fillStyle = I.acc; g.beginPath(); g.arc(rx - 4 * F.ui, y - 4 * F.ui, Math.max(2.5, 4 * F.ui), 0, TAU); g.fill();
          K.text(g, F, 'missing', rx - 14 * F.ui, y, { size: 1, mono: true, color: I.ink2, align: 'right', min: 7 });
        } else K.text(g, F, c.result, rx, y, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
      });
      K.text(g, F, 'BLOCKED · ' + d.checks[2].ref + ' approval', r.x + p, r.y + r.h - p, { size: 1, mono: true, color: I.ink, caps: true, weight: 500, min: 7 });
    },
    ledger(g, ctx, F, L, I, r) {
      const s = D().series, p = pad(F);
      head(g, ctx, F, I, r, 'Exposure, 12 months', '€M');
      const x0 = r.x + p, x1 = r.x + r.w - p, y1 = r.y + r.h - p - 12 * F.ui, y0 = r.y + p + 26 * F.ui;
      const sc = K.niceScale(Math.min.apply(null, s.exposure) * 0.96, Math.max.apply(null, s.exposure), 3);
      sc.ticks.forEach(t => {
        const y = y1 - (y1 - y0) * (t - sc.lo) / (sc.hi - sc.lo);
        K.relief(g, ctx, F, L, K.hline(x0, x1, y), ctx.P.relief !== 0);
      });
      const n = s.exposure.length, bw = (x1 - x0) / n;
      s.exposure.forEach((v, i) => {
        const h = (y1 - y0) * (v - sc.lo) / (sc.hi - sc.lo);
        g.fillStyle = i === n - 1 ? I.a('ink', 0.55) : I.a('ink', 0.18);
        g.fillRect(x0 + i * bw + 1, y1 - h, bw - 2, h);
      });
      K.text(g, F, K.monthOf(s.months[0]), x0, y1 + 12 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
      K.text(g, F, K.monthOf(s.months[n - 1]), x1, y1 + 12 * F.ui, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
    },
    npl(g, ctx, F, L, I, r) {
      const s = D().series, p = pad(F), v = s.nplShareByCount;
      head(g, ctx, F, I, r, 'NPL share', 'by count');
      K.text(g, F, K.pct(v[11]), r.x + p, r.y + p + 42 * F.ui, { size: 6, mono: true, weight: 500, color: I.ink, min: 9 });
      const x0 = r.x + p, x1 = r.x + r.w - p, y1 = r.y + r.h - p, y0 = r.y + p + 54 * F.ui;
      if (y1 - y0 < 8) return;
      const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
      K.relief(g, ctx, F, L, K.hline(x0, x1, y1));
      g.beginPath();
      v.forEach((q, i) => { const x = x0 + (x1 - x0) * i / 11, y = y1 - (y1 - y0) * (q - lo) / (hi - lo || 1); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = I.ink; g.lineWidth = F.lineW; g.stroke();
    },
    glyph(g, ctx, F, L, I, r, it, tsec) {
      const A = D().agents, p = pad(F);
      head(g, ctx, F, I, r, 'Agents', 'one model');
      const states = ['work', 'idle', 'idle', 'wait', 'done'];
      const n = A.length, cw = (r.w - 2 * p) / n, cy = r.y + r.h * 0.58;
      const s = Math.max(5, Math.min(cw * 0.22, r.h * 0.18));
      A.forEach((a, i) => {
        const cx = r.x + p + cw * (i + 0.5), st = states[i];
        g.save();
        if (st === 'idle') {
          for (let k = 0; k < 3; k++) { g.fillStyle = I.a('ink', 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(TAU * 0.2 * tsec + k))); g.beginPath(); g.arc(cx + (k - 1) * s * 0.7, cy, s * 0.2, 0, TAU); g.fill(); }
        } else if (st === 'work') {
          for (let k = 0; k < 5; k++) { const a0 = TAU * (k / 5 + 0.8 * tsec / 5); g.fillStyle = I.a('ink', 0.3 + 0.12 * k); g.beginPath(); g.arc(cx + Math.cos(a0) * s * 0.6, cy + Math.sin(a0) * s * 0.6, s * 0.16, 0, TAU); g.fill(); }
        } else if (st === 'wait') {
          g.strokeStyle = I.ink2; g.lineWidth = F.lineW; g.beginPath(); g.arc(cx, cy, s * 0.55, 0, TAU); g.stroke();
        } else {
          g.fillStyle = I.ink; g.beginPath(); g.arc(cx, cy, s * 0.4, 0, TAU); g.fill();
        }
        g.restore();
        K.text(g, F, a.id, cx, cy + s + 12 * F.ui, { size: 1, mono: true, color: I.ink2, align: 'center', min: 7 });
        K.text(g, F, a.name, cx, cy + s + 25 * F.ui, { size: 1, color: I.ink3, align: 'center', min: 7 });
      });
    },
    rule(g, ctx, F, L, I, r) {
      const ru = D().rules[0], p = pad(F);
      head(g, ctx, F, I, r, 'Rule', ru.id);
      // перенос строк по ширине
      const words = ru.text.split(' '), lines = []; let cur = '';
      K.font(g, F, 3, { weight: 500 });
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > r.w - 2 * p && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur);
      const lh = 16.8 * 1.2 * F.ui;
      lines.forEach((l, i) => K.text(g, F, l, r.x + p, r.y + p + 38 * F.ui + i * lh, { size: 3, weight: 500, color: I.ink, min: 8 }));
    },
    counts(g, ctx, F, L, I, r) {
      const k = D().kpi, p = pad(F);
      head(g, ctx, F, I, r, 'Model of record', '');
      const rows = [['Loans', k.loans], ['Borrowers', k.borrowers], ['Collateral', k.collateral], ['Rules', D().rules.length]];
      const lh = Math.min((r.h - 2 * p - 24 * F.ui) / rows.length, 26 * F.ui);
      rows.forEach((rw, i) => {
        const y = r.y + p + 30 * F.ui + (i + 0.7) * lh;
        K.text(g, F, rw[0], r.x + p, y, { size: 2, color: I.ink2, min: 7 });
        K.text(g, F, String(rw[1]), r.x + r.w - p, y, { size: 2, mono: true, color: I.ink, align: 'right', min: 7 });
      });
    }
  };

  // ── композиции вариантов ────────────────────────────────────────────────
  // v1 · дробление всего поля; v2 · колонка героя (золотая доля) + дробление остатка;
  // v3 · лотки: группы на плашках z1, виджеты на лотках, герой поверх стыка лотков
  const GROUPS = [
    { id: 'book', title: 'Book', ids: ['kpi', 'ledger', 'npl', 'counts'] },
    { id: 'checks', title: 'Checks', ids: ['gate', 'rule'] },
    { id: 'agents', title: 'Agents', ids: ['glyph', 'cascade'] }
  ];
  function layoutOf(ctx, F, compose) {
    const P = ctx.P, rand = ctx.rand, u = F.u, gap = u;
    const items = WIDGETS.map((w, i) => Object.assign({}, w, { tie: i + rand() * 0.01, hero: w.id === P.hero }));
    items.forEach(it => { if (it.hero) it.w *= 1.8; });
    let rect = Object.assign({}, F.content);
    // шапка листа печатается на полу: резерв сверху
    const headH = 34 * F.ui;
    rect = { x: rect.x, y: rect.y + headH, w: rect.w, h: rect.h - headH };
    let lay = [];
    if (compose === 'column') {
      const hero = items.find(i => i.hero), rest = items.filter(i => !i.hero);
      const colW = (rect.w - gap) * 0.382;
      const heroR = { x: rect.x, y: rect.y, w: colW, h: rect.h * 0.618 };
      lay.push(Object.assign({ r: heroR }, hero));
      // под героем воздух и подпись листа: печатный столбец z0
      const right = { x: rect.x + colW + gap, y: rect.y, w: rect.w - colW - gap, h: rect.h };
      lay = lay.concat(place(P, right, rest, gap, rand, u, Math.max(0.1, P.air - 0.12)));
    } else if (compose === 'trays') {
      const gs = GROUPS.map((gr, i) => ({ id: gr.id, title: gr.title, w: gr.ids.reduce((a, id) => a + items.find(x => x.id === id).w, 0), tie: i, grp: gr }));
      const trays = place(P, rect, gs, gap * 1.6, rand, u, P.air, true);
      trays.filter(t => !t.air).forEach(t => {
        lay.push({ id: 'tray-' + t.id, tray: true, title: t.title, r: t.r, z: 1, w: t.w, tie: t.tie });
        const inner = { x: t.r.x + gap, y: t.r.y + gap + 18 * F.ui, w: t.r.w - 2 * gap, h: t.r.h - 2 * gap - 18 * F.ui };
        const its = t.grp.ids.map(id => items.find(x => x.id === id));
        place(P, inner, its, gap * 0.8, rand, u, 0, true).forEach(l => { l.onTray = t.id; lay.push(l); });
      });
    } else {
      lay = place(P, rect, items, gap, rand, u, P.air);
    }
    if (P.layout === 'drift') lay.forEach(l => { if (!l.air) { l.r = Object.assign({}, l.r, { x: l.r.x + (rand() - 0.5) * u, y: l.r.y + (rand() - 0.5) * u }); } });
    else rand(), rand();
    if (compose !== 'trays') heroOverlap(lay, P.overlap, gap);
    if (compose === 'trays') {
      lay.forEach(l => { if (l.tray) return; l.z = l.hero ? 3 : 0; });
      const ws = lay.filter(l => !l.tray && !l.hero && !l.air).sort((a, b) => b.w - a.w || a.tie - b.tie);
      ws.slice(0, 3).forEach(l => { l.z = 2; });
      // остальные виджеты печатаются прямо на лотке (z1 + печать)
    } else levels(lay, P.layout === 'grid' ? 3 : 2 + Math.round(P.air * 2));
    return { lay, rect, headH, m: metrics(lay.filter(l => !l.tray), rect, u) };
  }
  function place(P, rect, items, gap, rand, u, air, noAirOrder) {
    const withA = air > 0 ? withAir(items, air, rand) : items.slice();
    if (P.layout === 'grid' && !noAirOrder) return gridLayout(rect, rhythm(withA), gap, air);
    const out = [];
    subdivide(rect, rhythm(withA), Math.round(P.depth) + (withA.length > 8 ? 1 : 0), gap, out);
    return out;
  }

  // ── сцена ───────────────────────────────────────────────────────────────
  function sceneDef(opt) {
    const compose = opt.compose;
    return {
      id: 'desk', title: 'desk', blurb: 'Dashboard as a desk: widget plates at meaningful heights',
      rows: {
        scene: [['hero', 'Герой', ['kpi', 'gate', 'cascade'], opt.hero || 'kpi', ['Число', 'Проверка', 'Каскад']]],
        rhythm: [
          ['layout', 'Раскладка', ['grid', 'split', 'drift'], opt.layout || 'split', ['Сетка', 'Дробление', 'Сдвиг']],
          ['depth', 'Глубина дробления', 2, 5, 1, opt.depth || 4],
          ['air', 'Воздух', 0.3, 0.65, 0.01, opt.air || 0.45],
          ['overlap', 'Нахлёст', 0, 0.25, 0.01, opt.overlap != null ? opt.overlap : 0.12]
        ]
      },
      draw: function (ctx) { draw(ctx, compose); }
    };
  }

  const STATE = { hover: null, hoverF: 0, lift: {} };
  function draw(ctx, compose) {
    const g = ctx.g, P = ctx.P, F = R.frameOf(ctx), L = R.lightOf(ctx, F), I = K.inks(ctx);
    const tsec = ctx.reduced ? 1e4 : R.tsecOf(ctx);
    // порядок потоков фиксирован: фазы, неровность, потом раскладка (кеш не сдвигает потоки)
    const PH = R.phases(ctx, 24);
    const un = []; for (let i = 0; i < 49; i++) un.push(ctx.randNoise());
    const gox = Math.floor(ctx.randNoise() * 128), goy = Math.floor(ctx.randNoise() * 128);
    const LY = layoutOf(ctx, F, compose);
    const lay = LY.lay;
    // порядок чтения для сборки: h, затем y, затем x
    const plates = lay.filter(l => !l.air && (l.z > 0 || l.tray));
    const ord = plates.slice().sort((a, b) => (a.tray ? 0 : a.z) - (b.tray ? 0 : b.z) || a.r.y - b.r.y || a.r.x - b.r.x);
    ord.forEach((l, i) => { l.order = i; });
    const tEnd = R.assembleEnd(P, ord.length);
    const pt = ctx.pointer;
    const hovered = pt ? plates.filter(l => !l.tray && pt.x >= l.r.x && pt.x <= l.r.x + l.r.w && pt.y >= l.r.y && pt.y <= l.r.y + l.r.h).sort((a, b) => b.z - a.z)[0] : null;
    const rad = P.radius * F.ui;
    const out = [];
    plates.forEach((l, idx) => {
      const hz = F.Z[l.tray ? 1 : l.z] + (l.onTray && l.z > 0 ? F.Z[1] : 0);
      const k = R.assembleK(P, ctx.reduced, l.order, tsec);
      // проверенное оседает: герой z3 (решение принято) замирает после сборки
      let env = ctx.reduced ? 0 : 1;
      if (l.z === 3 && !ctx.reduced) env = R.settleEnv(P, tEnd + 1.2, tsec);
      const fl = R.floatOf(P, F, PH[idx % PH.length], l.r.w, l.r.h, hz, env * k, tsec);
      // подъём при наведении: пружина ζ = 1 (lift §6.4)
      let lift = 0;
      if (!l.tray) {
        const on = hovered === l;
        const st = STATE.lift[l.id] || (STATE.lift[l.id] = { on: false, f: 0, from: 0 });
        const fps = R.FPS.v;
        const cur = R.spring(st.from, st.on ? 1 : 0, (window.__FRAMES - st.f) / fps);
        if (on !== st.on) { st.from = cur; st.on = on; st.f = window.__FRAMES; }
        lift = R.spring(st.from, st.on ? 1 : 0, (window.__FRAMES - st.f) / fps) * (F.Z[2] - F.Z[1]) * 0.5;
      }
      const h = Math.max(0, (hz + fl.dh + lift) * k);
      const s = { kind: 'rect', x: l.r.x + fl.dx, y: l.r.y + fl.dy, w: l.r.w, h: l.r.h, rad };
      const pl = { id: l.id, s, h, rot: fl.rot, order: l.order };
      const r = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (l.tray) pl.print = (gg) => {
        K.text(gg, F, l.title, r.x + F.u, r.y + F.u + 10 * F.ui, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
        // виджеты, печатаемые прямо на лотке (z0 относительно лотка)
        lay.filter(w => w.onTray === l.id && w.z === 0).forEach(w => {
          const wr = { x: w.r.x + fl.dx, y: w.r.y + fl.dy, w: w.r.w, h: w.r.h };
          K.relief(gg, ctx, F, L, (q, ox, oy) => { q.beginPath(); if (q.roundRect) q.roundRect(wr.x + ox, wr.y + oy, wr.w, wr.h, rad); else q.rect(wr.x + ox, wr.y + oy, wr.w, wr.h); }, P.relief !== 0);
          gg.save(); gg.beginPath(); gg.rect(wr.x, wr.y, wr.w, wr.h); gg.clip();
          PRINT[w.id](gg, ctx, F, L, I, wr, w, tsec); gg.restore();
        });
      };
      else pl.print = (gg) => PRINT[l.id](gg, ctx, F, L, I, r, l, tsec);
      out.push(pl);
    });
    R.render(g, ctx, F, L, out, {
      tsec, uneven: un, gox, goy,
      floor: (gg) => {
        // шапка листа печатью на полу (pitch-composer: заголовок крупно, мета моно)
        const c = F.content;
        K.text(gg, F, 'Loan book', c.x, c.y + 20 * F.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
        const tw = K.measure(gg, F, 'Loan book', { size: 5, weight: 600, min: 10 });
        K.text(gg, F, 'desk · ' + (compose === 'column' ? 'hero column' : compose === 'trays' ? 'trays' : 'split') + ' · ' + P.layout, c.x + tw + 14 * F.ui, c.y + 20 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
        K.text(gg, F, 'Fictional data', c.x + c.w, c.y + c.h + F.m * 0.55, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
        if (ctx.mode === 'studio' && !ctx.capture) {
          const M = LY.m;
          K.text(gg, F, 'air ' + M.air.toFixed(2) + ' · z3 ' + M.z3 + ' · z2 ' + M.z2 + ' · overlaps ' + M.overlapPairs + ' · min side ' + M.minSideU.toFixed(1) + 'u',
            c.x, c.y + c.h + F.m * 0.55, { size: 1, mono: true, color: I.ink3, min: 7 });
        }
        // в колонке героя: подпись к герою печатью под ним (число к подписи ≈ 5:1)
        if (compose === 'column') {
          const hero = lay.find(l => l.hero);
          if (hero) {
            const y = hero.r.y + hero.r.h + 28 * F.ui;
            K.text(gg, F, 'One number, pulled out.', hero.r.x, y, { size: 3, weight: 500, color: I.ink2, min: 8 });
            K.text(gg, F, 'Every other plate is context.', hero.r.x, y + 22 * F.ui, { size: 2, color: I.ink3, min: 7 });
          }
        }
      }
    });
    window.__DESK_METRICS = LY.m;
  }

  window.DESK = {
    WIDGETS, subdivide, rhythm, metrics, layoutOf,
    run: function (opt) { RELIEF_APP.run(sceneDef(opt), { variant: opt.variant, name: opt.name }); }
  };
})();
