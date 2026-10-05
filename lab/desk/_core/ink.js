// ink.js — печать и рельеф §7.4, типографика §8, чарты §7.9 (общие для desk и ledger).
// Иерархия: рельеф = каркас (вырезан в материале), печать = данные (чернила), акцент = решение.
// Доноры устройства: chart-3d (niceStep, band-шкала, пилюли подписей), sunburst (разбиение дуг,
// labelMin), radial (радиальные столбцы, большой номер с подписью), pitch-composer (одна шкала K,
// число к подписи ≈ 5:1, подпись моно). Их свет и тени не взяты: тени только из relief.js.
(function () {
  'use strict';
  const R = window.RELIEF, TAU = R.TAU;
  // шкала ×1,2 от 14 (§8): t1..t8, крупные числа t9..t11
  const TS = [0, 11.67, 14, 16.8, 20.16, 24.19, 29.03, 34.84, 41.8, 50.2, 60.2, 72.2];
  function track(px) { return px < 13 ? 0.02 : px <= 20.5 ? 0 : px < 50 ? -0.01 : -0.02; }
  function font(g, F, step, o) {
    o = o || {};
    const px = Math.max(o.min || 8, (typeof step === 'number' && step < 12 ? TS[step] : step) * F.ui * (o.k || 1));
    g.font = (o.weight || (o.mono ? 400 : 400)) + ' ' + px.toFixed(2) + 'px ' + (o.mono ? '"Geist Mono", ui-monospace, monospace' : 'Geist, system-ui, sans-serif');
    const tr = o.caps ? 0.07 : track(px);
    if ('letterSpacing' in g) g.letterSpacing = (tr * px).toFixed(2) + 'px';
    return px;
  }
  function text(g, F, s, x, y, o) {
    o = o || {};
    const px = font(g, F, o.size || 2, o);
    g.fillStyle = o.color || 'black';
    g.textAlign = o.align || 'left';
    g.textBaseline = o.base || 'alphabetic';
    g.fillText(o.caps ? String(s).toUpperCase() : s, x, y);
    return px;
  }
  function measure(g, F, s, o) { font(g, F, o.size || 2, o); return g.measureText(o.caps ? String(s).toUpperCase() : s).width; }

  // числа: моно, табличные (Geist Mono равноширинный)
  function eur(v, d) {
    const a = Math.abs(v);
    if (a >= 1e9) return '€' + (v / 1e9).toFixed(d == null ? 2 : d) + 'B';
    if (a >= 1e6) return '€' + (v / 1e6).toFixed(d == null ? 1 : d) + 'M';
    if (a >= 1e3) return '€' + (v / 1e3).toFixed(d == null ? 0 : d) + 'k';
    return '€' + v.toFixed(0);
  }
  const pct = (v, d) => (v * 100).toFixed(d == null ? 1 : d) + '%';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthOf = s => MON[(+s.slice(5, 7)) - 1];

  // niceStep донора chart-3d: первый из [1,2,5,10]·10^k не меньше raw
  function niceStep(span, n) {
    const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
    return 10 * p;
  }
  function niceScale(lo, hi, n) {
    const st = niceStep(hi - lo, n);
    const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st;
    const ticks = []; for (let v = a; v <= b + st * 1e-6; v += st) ticks.push(+v.toFixed(10));
    return { lo: a, hi: b, step: st, ticks };
  }

  // цвета чернил в токенах сцены
  function inks(ctx) {
    const T = ctx.tok;
    return {
      ink: R.rgba(T.ink), ink2: R.rgba(T.ink2), ink3: R.rgba(T.ink3),
      line: R.rgba(T.ink, ctx.theme === 'night' ? 0.26 : 0.22),
      acc: R.rgba(T.acc[ctx.P.accent] || T.acc.terracotta),
      accC: T.acc[ctx.P.accent] || T.acc.terracotta,
      a: (k, al) => R.rgba(T[k], al)
    };
  }
  // рельефная линия: тёмный штрих ink2 α .45 и светлый lightTint α .55 со сдвигом −0.75·l_xy
  function relief(g, ctx, F, L, path, on) {
    const T = ctx.tok;
    g.save();
    g.lineWidth = F.lineW; g.lineCap = 'butt';
    if (on === false) {
      g.strokeStyle = R.rgba(T.ink, ctx.theme === 'night' ? 0.26 : 0.22);
      path(g, 0, 0); g.stroke(); g.restore(); return;
    }
    g.strokeStyle = R.rgba(T.ink2, ctx.theme === 'night' ? 0.5 : 0.45);
    path(g, 0, 0); g.stroke();
    g.strokeStyle = R.rgba(L.lightTint, ctx.theme === 'night' ? 0.16 : 0.55);
    path(g, -0.75 * L.lxy[0], -0.75 * L.lxy[1]); g.stroke();
    g.restore();
  }
  function hline(x0, x1, y) { return (g, ox, oy) => { g.beginPath(); g.moveTo(x0 + ox, y + oy); g.lineTo(x1 + ox, y + oy); }; }
  function vline(x, y0, y1) { return (g, ox, oy) => { g.beginPath(); g.moveTo(x + ox, y0 + oy); g.lineTo(x + ox, y1 + oy); }; }

  // ── рука §6.9: штрих perfect-freehand (если вклеен) вокруг ключевого числа ──
  function handRing(g, ctx, F, cx, cy, rx, ry, rand) {
    const PF = window.PerfectFreehand; if (!PF) return;
    const pts = [], n = 44, a0 = -2.2 + rand() * 0.4, turn = TAU * 1.08;
    for (let i = 0; i <= n; i++) {
      const a = a0 + turn * i / n, j = 1 + (rand() - 0.5) * 0.05;
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j, 0.5]);
    }
    const out = PF.getStroke(pts, { size: 1.6 * Math.max(1, F.ui * 1.4), thinning: 0.5, smoothing: 0.6, streamline: 0.5 });
    if (!out.length) return;
    g.save();
    g.fillStyle = R.rgba(ctx.tok.ink2, 0.75);
    g.beginPath(); g.moveTo(out[0][0], out[0][1]);
    for (let i = 1; i < out.length; i++) g.lineTo(out[i][0], out[i][1]);
    g.closePath(); g.fill();
    g.restore();
  }

  window.RINK = { TS, font, text, measure, eur, pct, monthOf, MON, niceStep, niceScale, inks, relief, hline, vline, handRing };
})();
