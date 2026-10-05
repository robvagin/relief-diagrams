// charts.js — сцена 07 `ledger`: обычные графики в языке рельефа (§7.9).
// Столбцы = плашки z1 на базовой линии z0; линия данных печатная, сетка и ось рельефные;
// маркеры-диски ≥ 8 px; одна ось (несколько серий = индекс к первому месяцу, двойных осей нет);
// подписи выборочно, легенда при ≥ 2 сериях; текст в чернилах, акцент метит одну сущность;
// подсказка = маленькая плашка z3 с числами Geist Mono, перекрестие волосяной линией; вид таблицей (T).
// Доноры: chart-3d (niceStep, band-шкала, gap), sunburst (разбиение дуг по сумме, labelMin 0.22 рад),
// radial (радиальные столбцы r0 → r0 + v/max·(R − r0), подпись по стороне cos), radial gauge (число + подпись).
(function () {
  'use strict';
  const R = window.RELIEF, K = window.RINK, TAU = R.TAU;
  const D = () => window.RELIEF_DATA;

  // ── серии: 1 = €M; ≥ 2 = индекс Oct 2025 = 100 на одной оси ─────────────
  function seriesOf(n) {
    const s = D().series;
    const avg3 = s.recovered.map((v, i) => { const a = s.recovered.slice(Math.max(0, i - 2), i + 1); return a.reduce((x, y) => x + y, 0) / a.length; });
    const all = [
      { id: 'exposure', name: 'Exposure', v: s.exposure, fmt: v => K.eur(v) },
      { id: 'recovered', name: 'Recovered', v: s.recovered, fmt: v => K.eur(v) },
      { id: 'npl', name: 'NPL share', v: s.nplShareByCount, fmt: v => K.pct(v) },
      { id: 'rec3', name: 'Recovered, 3-mo avg', v: avg3, fmt: v => K.eur(v) }
    ].slice(0, Math.max(1, Math.min(4, Math.round(n))));
    const idx = all.length > 1;
    all.forEach(se => { se.y = idx ? se.v.map(v => 100 * v / se.v[0]) : se.v.slice(); });
    return { list: all, months: s.months, indexed: idx, unit: idx ? 'Index, Oct 2025 = 100' : 'Exposure, €M',
      yfmt: idx ? (v => v.toFixed(0)) : (v => (v / 1e6).toFixed(0)) };
  }
  const GRAYS = [0, 0.12, 0.26, 0.4];       // серая лестница серий: светлое → тёмное
  const DASH = [[], [6, 3], [2, 3], [8, 3, 2, 3]];

  // ── оси: сетка и база рельефом, подписи моно ───────────────────────────
  function axes(g, ctx, F, L, I, box, sc, S, opt) {
    const relief = ctx.P.relief !== 0;
    sc.ticks.forEach((t, i) => {
      const y = box.y + box.h - box.h * (t - sc.lo) / (sc.hi - sc.lo);
      K.relief(g, ctx, F, L, K.hline(box.x, box.x + box.w, y), relief);
      if (ctx.P.labelsL !== 'none' || i === 0 || i === sc.ticks.length - 1)
        K.text(g, F, S.yfmt(t), box.x - 8 * F.ui, y + 4 * F.ui, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
    });
    K.text(g, F, S.unit, box.x - 8 * F.ui, box.y - 14 * F.ui, { size: 1, color: I.ink3, min: 7 });
    if (!opt.compact) legend(g, ctx, F, I, S, box.x - 8 * F.ui + K.measure(g, F, S.unit, { size: 1, min: 7 }) + 28 * F.ui, box.y - 14 * F.ui, opt.kind);
    const n = S.months.length;
    S.months.forEach((m, i) => {
      const all = ctx.P.labelsL === 'all';
      if (!(all || i === 0 || i === n - 1 || i % 3 === 0)) return;
      const x = opt.xOf(i);
      const al = opt.edge && i === 0 ? 'left' : opt.edge && i === n - 1 ? 'right' : 'center';
      K.text(g, F, K.monthOf(m) + (i === 0 || m.slice(5) === '01' ? ' ' + m.slice(2, 4) : ''), x, box.y + box.h + 16 * F.ui, { size: 1, mono: true, color: I.ink3, align: al, min: 7 });
    });
  }
  function legend(g, ctx, F, I, S, x, y, kind) {
    if (S.list.length < 2) return;
    let cx = x;
    S.list.forEach((se, i) => {
      if (kind === 'line') {
        g.save(); g.strokeStyle = i ? I.ink3 : I.ink; g.lineWidth = F.lineW; g.setLineDash(DASH[i].map(v => v * F.ui));
        g.beginPath(); g.moveTo(cx, y - 4 * F.ui); g.lineTo(cx + 18 * F.ui, y - 4 * F.ui); g.stroke(); g.restore();
      } else {
        g.fillStyle = R.rgba(R.mix(ctx.tok.plate, ctx.tok.ink, GRAYS[i] + 0.04)); g.fillRect(cx, y - 9 * F.ui, 10 * F.ui, 10 * F.ui);
      }
      K.text(g, F, se.name, cx + 24 * F.ui, y, { size: 1, color: I.ink2, min: 7 });
      cx += 24 * F.ui + K.measure(g, F, se.name, { size: 1, min: 7 }) + 18 * F.ui;
    });
  }

  // ── формы: каждая отдаёт {plates, floor, top} в своём прямоугольнике ────
  // plate: {id, s, z (уровень), lift (доп. высота), fill?, print?}
  function plotBox(F, r, opt) {
    const lp = (opt.compact ? 34 : 52) * F.ui, bp = 26 * F.ui, tp = (opt.compact ? 20 : 34) * F.ui;
    return { x: r.x + lp, y: r.y + tp, w: r.w - lp - 8 * F.ui, h: r.h - tp - bp };
  }
  function bars(ctx, F, L, I, r, opt) {
    const S = seriesOf(ctx.P.series), n = S.months.length, k = S.list.length;
    const box = plotBox(F, r, opt);
    const hi = Math.max.apply(null, S.list.map(se => Math.max.apply(null, se.y)));
    const sc = K.niceScale(0, hi, opt.compact ? 3 : 5);
    const band = box.w / n, pad = 0.28, gap = 2;
    const bw = (band * (1 - pad) - gap * (k - 1)) / k;
    const xOf = i => box.x + band * (i + 0.5);
    const plates = [];
    S.list.forEach((se, si) => se.y.forEach((v, i) => {
      const h = box.h * (v - sc.lo) / (sc.hi - sc.lo);
      const x = box.x + band * i + band * pad / 2 + si * (bw + gap);
      plates.push({ id: 'b' + si + '-' + i, z: 1, s: { kind: 'rect', x, y: box.y + box.h - h, w: bw, h: Math.max(1, h), rad: Math.min(ctx.P.radius * F.ui, bw / 2, 3 * F.ui) },
        fill: si ? R.mix(ctx.tok.plate, ctx.tok.ink, GRAYS[si]) : null, val: { si, i } });
    }));
    // ключевая сущность: последний месяц первой серии
    const key = plates.find(p => p.val.si === 0 && p.val.i === n - 1);
    key.mark = true;
    return {
      plates, S, box, xOf,
      floor(g) {
        axes(g, ctx, F, L, I, box, sc, S, { xOf, compact: opt.compact, kind: 'bars' });
        if (ctx.P.labelsL !== 'none') {
          const se = S.list[0], v = se.v[n - 1], x = xOf(n - 1);
          const y = box.y + box.h - box.h * (se.y[n - 1] - sc.lo) / (sc.hi - sc.lo);
          K.text(g, F, se.fmt(v), x + band * 0.1, y - 16 * F.ui, { size: opt.compact ? 1 : 2, mono: true, weight: 500, color: I.ink, align: 'right', min: 7 });
        }
      },
      hover: hoverOf(ctx, F, I, S, box, xOf, n)
    };
  }
  function line(ctx, F, L, I, r, opt) {
    const S = seriesOf(ctx.P.series), n = S.months.length;
    const box = plotBox(F, r, opt);
    if (S.list.length > 1 && !opt.compact && ctx.P.labelsL !== 'none') box.w -= 110 * F.ui;
    let lo = Infinity, hi = -Infinity;
    S.list.forEach(se => se.y.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    const sc = K.niceScale(lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08, opt.compact ? 3 : 5);
    const xOf = i => box.x + box.w * (i / (n - 1));
    const yOf = v => box.y + box.h - box.h * (v - sc.lo) / (sc.hi - sc.lo);
    const plates = [];
    const mr = Math.max(4, 5 * F.ui);
    S.list[0].y.forEach((v, i) => plates.push({ id: 'm' + i, z: 1, s: { kind: 'circle', x: xOf(i), y: yOf(v), r: mr }, mark: i === n - 1 }));
    return {
      plates, S, box, xOf,
      floor(g) {
        axes(g, ctx, F, L, I, box, sc, S, { xOf, compact: opt.compact, edge: true, kind: 'line' });
        // линии печатью: первая чернилами, прочие ink3 и пунктиром (форма, а не цвет)
        S.list.slice().reverse().forEach((se) => {
          const si = S.list.indexOf(se);
          g.save(); g.lineJoin = 'round';
          g.strokeStyle = si ? I.ink3 : I.ink; g.lineWidth = F.lineW; g.setLineDash(DASH[si].map(v => v * F.ui));
          g.beginPath(); se.y.forEach((v, i) => { i ? g.lineTo(xOf(i), yOf(v)) : g.moveTo(xOf(i), yOf(v)); }); g.stroke();
          g.restore();
          // прямые подписи на конце (до 4 серий)
          if (ctx.P.labelsL !== 'none' && S.list.length > 1 && !opt.compact)
            K.text(g, F, se.name, xOf(n - 1) + 10 * F.ui, yOf(se.y[n - 1]) + 4 * F.ui, { size: 1, color: si ? I.ink3 : I.ink2, min: 7 });
        });
        if (ctx.P.labelsL !== 'none') {
          const se = S.list[0];
          K.text(g, F, se.fmt(se.v[n - 1]), xOf(n - 1), yOf(se.y[n - 1]) - 14 * F.ui, { size: opt.compact ? 1 : 2, mono: true, weight: 500, color: I.ink, align: 'right', min: 7 });
          if (ctx.P.labelsL === 'all') K.text(g, F, se.fmt(se.v[0]), xOf(0), yOf(se.y[0]) - 14 * F.ui, { size: 1, mono: true, color: I.ink2, align: 'left', min: 7 });
        }
      },
      hover: hoverOf(ctx, F, I, S, box, xOf, n)
    };
  }
  // кольцо: разбиение дуг по сумме (sunburst), уровни = серии (стадия → сегмент → страна)
  function donut(ctx, F, L, I, r, opt) {
    const b = D().breakdown, depth = Math.max(1, Math.min(3, Math.round(ctx.P.series)));
    const cx = opt.center ? opt.center[0] : r.x + r.w / 2, cy = opt.center ? opt.center[1] : r.y + r.h / 2 + (opt.compact ? 6 : 10) * F.ui;
    const Rr = opt.center ? opt.center[2] : Math.min(r.w, r.h - 40 * F.ui) * 0.42, r0 = Rr * (opt.ring0 || 0.5), ring = (Rr - r0) / depth;
    const plates = [], pad = 1.5;
    function walk(node, a0, a1, d, path) {
      if (d > depth) return;
      const kids = node.children || [];
      let a = a0;
      kids.forEach((c, i) => {
        const span = (a1 - a0) * c.value / node.value;
        const npl = path.concat(c.label).indexOf('non-performing') >= 0 && d === 1;
        plates.push({ id: 'a' + d + '-' + path.join('/') + '/' + c.label, z: npl && !opt.flat ? 2 : 1,
          s: { kind: 'arc', cx, cy, r0: r0 + (d - 1) * ring + (d > 1 ? 1 : 0), r1: r0 + d * ring, a0: a, a1: a + span, pad },
          fill: d > 1 ? R.mix(ctx.tok.plate, ctx.tok.ink, GRAYS[Math.min(3, d - 1)] * 0.6) : null,
          node: c, depth: d, mark: npl, span });
        walk(c, a, a + span, d + 1, path.concat(c.label));
        a += span;
      });
    }
    walk(b, -Math.PI / 2, -Math.PI / 2 + TAU, 1, []);
    return {
      plates, box: { x: cx - Rr, y: cy - Rr, w: 2 * Rr, h: 2 * Rr },
      floor(g) {
        K.relief(g, ctx, F, L, (q, ox, oy) => { q.beginPath(); q.arc(cx + ox, cy + oy, r0 - 6 * F.ui, 0, TAU); }, ctx.P.relief !== 0);
        const s = Math.max(1, Math.min(9, Rr / (opt.compact ? 70 : 52) / F.ui * 6));
        K.text(g, F, K.eur(b.value), cx, cy + 4 * F.ui, { size: opt.compact ? 3 : Math.min(8, s), mono: true, weight: 500, color: I.ink, align: 'center', min: 8 });
        K.text(g, F, 'Book · ' + b.count + ' loans', cx, cy + (opt.compact ? 20 : 30) * F.ui, { size: 1, color: I.ink3, align: 'center', min: 7 });
        if (ctx.P.labelsL === 'none' || opt.noLabels) return;
        // подписи: ключевые = стадии; все = любые дуги шире 0.22 рад (labelMin донора sunburst)
        plates.filter(p => p.depth === 1 || (ctx.P.labelsL === 'all' && p.span >= 0.22)).forEach(p => {
          const a = (p.s.a0 + p.s.a1) / 2, rr = p.depth === depth ? Rr + 16 * F.ui : (p.s.r0 + p.s.r1) / 2;
          if (p.depth < depth && p.depth !== 1) return;
          const outer = p.depth === 1 && depth > 1 ? Rr + 16 * F.ui : rr;
          const x = cx + Math.cos(a) * outer, y = cy + Math.sin(a) * outer;
          const al = Math.cos(a) > 0.05 ? 'left' : Math.cos(a) < -0.05 ? 'right' : 'center';
          if (p.depth === 1 && depth > 1) {
            g.save(); g.strokeStyle = I.line; g.lineWidth = F.lineW; g.beginPath();
            g.moveTo(cx + Math.cos(a) * (p.s.r1 + 3), cy + Math.sin(a) * (p.s.r1 + 3)); g.lineTo(cx + Math.cos(a) * (Rr + 10 * F.ui), cy + Math.sin(a) * (Rr + 10 * F.ui)); g.stroke(); g.restore();
          }
          if (opt.compact && p.depth > 1) return;
          K.text(g, F, p.node.label, x, y, { size: 1, color: I.ink2, align: al, min: 7 });
          K.text(g, F, K.eur(p.node.value) + ' · ' + K.pct(p.node.value / b.value, 0), x, y + 13 * F.ui, { size: 1, mono: true, color: I.ink3, align: al, min: 7 });
        });
      }
    };
  }
  // таблица: лист z1, шапка, строки моно; строка «на дату» метится точкой акцента
  function table(ctx, F, L, I, r, opt) {
    const S = seriesOf(Math.max(ctx.P.series, opt.compact ? 1 : 3));
    const cols = S.list.slice(0, opt.compact ? 2 : 4), n0 = S.months.length;
    const from = opt.compact ? n0 - 6 : 0, n = n0 - from;
    const months = S.months.slice(from);
    const sheet = { id: 'sheet', z: 1, s: { kind: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, rad: ctx.P.radius * F.ui } };
    sheet.print = (g, p) => {
      const q = p.s, pd = 14 * F.ui, rh = (q.h - 2 * pd) / (n + 1.6);
      const cw = (q.w - 2 * pd) / (cols.length + 1);
      const hy = q.y + pd + rh * 0.8;
      K.text(g, F, 'Month', q.x + pd, hy, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
      cols.forEach((c, j) => K.text(g, F, c.name, q.x + pd + cw * (j + 2), hy, { size: 1, caps: true, weight: 500, color: I.ink3, align: 'right', min: 7 }));
      K.relief(g, ctx, F, L, K.hline(q.x + pd, q.x + q.w - pd, q.y + pd + rh * 1.25), ctx.P.relief !== 0);
      const fs = Math.max(1, Math.min(2, rh / (17 * F.ui)));
      months.forEach((m, i) => {
        const y = q.y + pd + rh * (i + 2.15);
        if (i % 3 === 2 && i < n - 1) K.relief(g, ctx, F, L, K.hline(q.x + pd, q.x + q.w - pd, y + rh * 0.42), false);
        K.text(g, F, K.monthOf(m) + ' ' + m.slice(0, 4), q.x + pd, y, { size: fs, mono: true, color: I.ink2, min: 7 });
        cols.forEach((c, j) => K.text(g, F, c.fmt(c.v[from + i]), q.x + pd + cw * (j + 2), y, { size: fs, mono: true, color: i === n - 1 ? I.ink : I.ink2, weight: i === n - 1 ? 500 : 400, align: 'right', min: 7 }));
        if (i === n - 1) { g.fillStyle = I.acc; g.beginPath(); g.arc(q.x + pd - 7 * F.ui, y - 4 * F.ui, Math.max(2.5, 3.5 * F.ui), 0, TAU); g.fill(); }
      });
    };
    return { plates: [sheet], box: r, floor() {} };
  }
  // число: ключевая плашка z2 и до трёх соседних z1 (по числу серий), спарклайн печатью
  function kpi(ctx, F, L, I, r, opt) {
    const S = seriesOf(ctx.P.series), k = S.list.length, gap = F.u;
    const plates = [];
    const ws = k === 1 ? [0.618] : [0.382 * 1.6].concat(new Array(k - 1).fill((1 - 0.382 * 1.6) / (k - 1)));
    let x = r.x;
    const h = Math.min(r.h, Math.max(r.w * 0.36, 160 * F.ui));
    const y = r.y + (r.h - h) / 2;
    S.list.forEach((se, i) => {
      const w = (r.w - gap * (k - 1)) * ws[i];
      const s = { kind: 'rect', x, y: i ? y + h * 0.18 : y, w, h: i ? h * 0.64 : h, rad: ctx.P.radius * F.ui };
      plates.push({ id: 'k' + i, z: i ? 1 : 2, s, print: (g, p) => kpiPrint(g, ctx, F, L, I, p.s, se, i === 0, opt) });
      x += w + gap;
    });
    return { plates, box: r, floor() {} };
  }
  function kpiPrint(g, ctx, F, L, I, q, se, key, opt) {
    const pd = Math.max(8, 16 * F.ui), n = se.v.length;
    K.text(g, F, se.name, q.x + pd, q.y + pd + 10 * F.ui, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
    if (q.w > K.measure(g, F, se.name + ' Sep 2026', { size: 1, caps: true, min: 7 }) + 2 * pd + 16 * F.ui)
      K.text(g, F, 'Sep 2026', q.x + q.w - pd, q.y + pd + 10 * F.ui, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
    const num = se.fmt(se.v[n - 1]);
    const w100 = K.measure(g, F, num, { size: 100 / F.ui, mono: true, weight: 500, min: 1 }) / 100;
    const px = Math.max(12, Math.min((q.w - 2 * pd) * (key ? 0.8 : 0.7) / Math.max(0.01, w100), q.h * 0.34));
    const by = q.y + q.h * 0.52;
    K.text(g, F, num, q.x + pd, by, { size: px / F.ui, mono: true, weight: 500, color: I.ink, min: 8 });
    const d = se.v[n - 1] / se.v[0] - 1;
    K.text(g, F, (d >= 0 ? '+' : '−') + K.pct(Math.abs(d)) + ' vs Oct 2025', q.x + pd, by + px * 0.36 + 8 * F.ui, { size: key ? 2 : 1, mono: true, color: I.ink2, min: 7 });
    const sy0 = q.y + q.h - pd, sh = Math.min(q.h * 0.18, 44 * F.ui), sw = q.w - 2 * pd;
    if (sh > 8) {
      const lo = Math.min.apply(null, se.v), hi = Math.max.apply(null, se.v);
      g.beginPath(); se.v.forEach((v, i) => { const x = q.x + pd + sw * i / (n - 1), y = sy0 - sh * (v - lo) / (hi - lo || 1); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = I.ink2; g.lineWidth = F.lineW; g.stroke();
      if (key) { g.fillStyle = I.acc; g.beginPath(); g.arc(q.x + pd + sw, sy0 - sh * (se.v[n - 1] - lo) / (hi - lo || 1), Math.max(3, 4 * F.ui), 0, TAU); g.fill(); }
    }
    if (key && ctx.P.hand) K.handRing(g, ctx, F, q.x + pd + px * 2.0, by - px * 0.36, px * 2.4, px * 0.72, ctx.randPal);
  }

  // подсказка: перекрестие волосяной линией + плашка z3 с числами (Geist Mono)
  function hoverOf(ctx, F, I, S, box, xOf, n) {
    return function () {
      const pt = ctx.pointer;
      if (!pt || pt.x < box.x - 10 || pt.x > box.x + box.w + 10 || pt.y < box.y || pt.y > box.y + box.h) return null;
      let best = 0, bd = 1e9;
      for (let i = 0; i < n; i++) { const d = Math.abs(xOf(i) - pt.x); if (d < bd) { bd = d; best = i; } }
      const x = xOf(best);
      const lines = [K.monthOf(S.months[best]) + ' ' + S.months[best].slice(0, 4)].concat(S.list.map(se => se.name + '  ' + se.fmt(se.v[best])));
      const w = 18 * F.ui + Math.max.apply(null, lines.map(l => l.length)) * 7.4 * F.ui, h = (14 + 16 * lines.length) * F.ui;
      const tx = x + 14 * F.ui + w > box.x + box.w ? x - 14 * F.ui - w : x + 14 * F.ui;
      return {
        x, i: best,
        plate: { id: 'tip', z: 3, s: { kind: 'rect', x: tx, y: box.y + 8 * F.ui, w, h, rad: 4 * F.ui },
          print: (g, p) => lines.forEach((l, j) => K.text(g, F, l, p.s.x + 9 * F.ui, p.s.y + (20 + 16 * j) * F.ui, { size: 1, mono: true, color: j ? I.ink2 : I.ink, weight: j ? 400 : 500, min: 7 })) },
        cross: (g) => { g.save(); g.strokeStyle = I.line; g.lineWidth = Math.max(1 / (window.devicePixelRatio || 1), 0.75); g.beginPath(); g.moveTo(x, box.y); g.lineTo(x, box.y + box.h); g.stroke(); g.restore(); }
      };
    };
  }

  // печать формы плоско: на листе-плашке малые виды не поднимаются, их плашки печатаются тоном
  function printFlat(g, ctx, F, comp) {
    comp.floor(g);
    comp.plates.forEach(p => {
      g.save();
      if (p.print) {
        K.relief(g, ctx, F, null, (q, ox, oy) => R.shapePath(q, p.s, ox, oy), false);
        R.shapePath(g, p.s); g.clip(); p.print(g, p);
      } else {
        R.shapePath(g, p.s);
        g.fillStyle = R.rgba(ctx.tok.ink, p.z > 1 ? 0.18 : 0.08 + (p.fill ? 0.06 : 0)); g.fill();
      }
      g.restore();
      if (p.mark) markOn(g, ctx, F, p);
    });
  }

  const FORMS = { bars, line, donut, table, kpi };
  const FORM_NAMES = { bars: 'Bars', line: 'Line', donut: 'Ring', table: 'Table', kpi: 'Number' };
  const TITLES = {
    bars: 'Exposure by month', line: 'Exposure and recoveries', donut: 'Book by stage',
    table: 'Monthly ledger', kpi: 'Key numbers'
  };

  // ── анимация плашек: сборка, плавание, оседание (общая для вариантов) ──
  function animate(ctx, F, plates, tsec, PH) {
    const P = ctx.P;
    const ord = plates.slice().sort((a, b) => a.z - b.z || shapeY(a) - shapeY(b) || shapeX(a) - shapeX(b));
    ord.forEach((p, i) => { p.order = i; });
    const tEnd = R.assembleEnd(P, Math.min(ord.length, 16));
    return plates.map((p, idx) => {
      const hz = F.Z[p.z] + (p.lift || 0);
      const k = R.assembleK(P, ctx.reduced, Math.min(p.order, 15) * (16 / Math.max(16, ord.length)) * (ord.length > 16 ? 1 : 1), tsec);
      let env = ctx.reduced ? 0 : 1;
      if ((p.z === 3 || p.mark) && !ctx.reduced && p.id !== 'tip') env = R.settleEnv(P, tEnd + 1.2, tsec);
      const b = R.shapeBox(p.s);
      const fl = R.floatOf(P, F, PH[idx % PH.length], b.w, b.h, hz, env * k, tsec);
      const s = R.moved(p.s, fl.dx, fl.dy);
      const out = { id: p.id, s, h: Math.max(0, (hz + fl.dh) * k), rot: p.s.kind === 'rect' ? fl.rot : 0, order: p.order, fill: p.fill };
      if (p.print) out.print = (g, q) => p.print(g, q);
      if (p.mark) out.over = (g, q) => markOn(g, ctx, F, q);
      return out;
    });
  }
  function shapeY(p) { return R.shapeBox(p.s).y; }
  function shapeX(p) { return R.shapeBox(p.s).x; }
  function markOn(g, ctx, F, q) {
    const c = R.shapeCenter(q.s), I = K.inks(ctx);
    let x = c[0], y = c[1];
    if (q.s.kind === 'rect') { x = q.s.x + q.s.w / 2; y = q.s.y + Math.min(q.s.h / 2, 9 * F.ui); }
    g.fillStyle = I.acc; g.beginPath(); g.arc(x, y, Math.max(2.5, Math.min(4 * F.ui, (q.s.w || 99) / 3)), 0, TAU); g.fill();
  }

  // ── сцена ───────────────────────────────────────────────────────────────
  function sceneDef(opt) {
    return {
      id: 'ledger', title: 'ledger', blurb: 'Ordinary charts in the relief language: bars, line, ring, table, number',
      rows: {
        scene: [['chart', 'Форма', ['bars', 'line', 'donut', 'table', 'kpi'], opt.chart || 'bars', ['Столбцы', 'Линия', 'Кольцо', 'Таблица', 'Число']]],
        data: [
          ['series', 'Серий', 1, 4, 1, opt.series || 1],
          ['relief', 'Рельеф', 0, 1, 1, 1, 'Структура вырезана, данные напечатаны'],
          ['labelsL', 'Подписи', ['none', 'key', 'all'], 'key', ['Нет', 'Ключевые', 'Все']]
        ]
      },
      hotkeys: {
        // T: вид таблицей и обратно
        t: function (ctx) { const was = ctx.P.chart; Scene.set('chart', was === 'table' ? (ctx._prevChart || 'bars') : 'table'); ctx._prevChart = was === 'table' ? ctx._prevChart : was; }
      },
      draw: function (ctx) { draw(ctx, opt); }
    };
  }

  function header(g, ctx, F, I, title, sub) {
    const c = F.content;
    K.text(g, F, title, c.x, c.y + 20 * F.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
    const tw = K.measure(g, F, title, { size: 5, weight: 600, min: 10 });
    K.text(g, F, sub, c.x + tw + 14 * F.ui, c.y + 20 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
    K.text(g, F, 'Fictional data · as of 30 Sep 2026', c.x + c.w, c.y + c.h + F.m * 0.55, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
  }

  function draw(ctx, opt) {
    const g = ctx.g, P = ctx.P, F = R.frameOf(ctx), L = R.lightOf(ctx, F), I = K.inks(ctx);
    const tsec = ctx.reduced ? 1e4 : R.tsecOf(ctx);
    const PH = R.phases(ctx, 40);
    const un = []; for (let i = 0; i < 49; i++) un.push(ctx.randNoise());
    const gox = Math.floor(ctx.randNoise() * 128), goy = Math.floor(ctx.randNoise() * 128);
    const c = F.content, headH = 44 * F.ui;
    const body = { x: c.x, y: c.y + headH, w: c.w, h: c.h - headH };
    const comp = opt.compose(ctx, F, L, I, body, FORMS);
    let plates = comp.plates;
    let hov = null;
    if (comp.hover) { hov = comp.hover(); if (hov) plates = plates.concat([hov.plate]); }
    const anim = animate(ctx, F, plates, tsec, PH);
    R.render(g, ctx, F, L, anim, {
      tsec, uneven: un, gox, goy,
      floor: (gg) => {
        header(gg, ctx, F, I, comp.title || (P.chart === 'line' && P.series < 2 ? 'Exposure' : TITLES[P.chart]), 'ledger · ' + opt.name + ' · ' + FORM_NAMES[P.chart]);
        comp.floor(gg);
        if (hov) hov.cross(gg);
      }
    });
  }

  window.LEDGER = {
    FORMS, FORM_NAMES, TITLES, seriesOf, kpiPrint, printFlat, markOn, header,
    run: function (opt) { RELIEF_APP.run(sceneDef(opt), { variant: opt.variant, name: opt.name }); }
  };
})();
