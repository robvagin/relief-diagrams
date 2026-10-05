/* ink.js · печать: линии, рельефные линии, связи, текст (README §7.4, §7.9, L7, L9).
   Одна толщина линии на сцену (F.lineW); глубина только альфой. Рельеф = каркас (вырезано),
   печать = данные (чернила), акцент = решение. Текст Geist / Geist Mono, табличные цифры, шкала ×1,2. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var SIZES = [11.67, 14, 16.8, 20.16, 24.19, 29.03, 34.84, 41.8, 50.2, 60.2, 72.2];

  function stroke(g, pts, closed) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
    g.stroke();
  }

  /* печатная линия данных: чернила ink | ink2 | accent, альфа по глубине */
  function print(g, F, pts, o) {
    o = o || {};
    var c = F.T[o.tone || 'ink'] || F.T.ink;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = R.color.css(c, o.alpha == null ? 1 : o.alpha);
    stroke(g, pts, o.closed); g.restore();
  }

  /* рельефная линия (структура вырезана): тёмный штрих ink2 α .45 и светлый lightTint α .55 со сдвигом −0.75·l_xy */
  function relief(g, F, pts, o) {
    o = o || {};
    var l = F.L.mode === 'lamp' ? R.light.toLight(F.L, pts[0][0], pts[0][1], 0) : F.L.l, n = Math.hypot(l[0], l[1]) || 1;
    var sx = -0.75 * l[0] / n * F.ui, sy = -0.75 * l[1] / n * F.ui;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = R.color.css(F.T.ink2, 0.45 * (o.alpha == null ? 1 : o.alpha)); stroke(g, pts, o.closed);
    g.translate(sx, sy);
    g.strokeStyle = R.color.css(F.tn.light, 0.55 * (o.alpha == null ? 1 : o.alpha)); stroke(g, pts, o.closed);
    g.restore();
  }

  /* связь: квадратичная кривизна d = c·|P2 − P0|, зазор у узлов (gap px), одна толщина */
  function link(g, F, a, b, o) {
    o = o || {};
    var gap = (o.gap == null ? 3 : o.gap) * F.ui, ra = (o.ra || 0) + gap, rb = (o.rb || 0) + gap;
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    var p0 = [a[0] + ux * ra, a[1] + uy * ra], p2 = [b[0] - ux * rb, b[1] - uy * rb];
    var c = o.curve || 0, mx = (p0[0] + p2[0]) / 2 - uy * c * L, my = (p0[1] + p2[1]) / 2 + ux * c * L;
    var tone = F.T[o.tone || 'ink2'] || F.T.ink2;
    g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(tone, o.alpha == null ? 0.6 : o.alpha);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(mx, my, p2[0], p2[1]); g.stroke(); g.restore();
  }

  /* текст: ступень шкалы s (0 = t1 … 10), вес, моно; трекинг по размеру (adaptive-typography) */
  function text(g, F, str, x, y, o) {
    o = o || {};
    var px = SIZES[o.s == null ? 1 : o.s] * F.ui, fam = o.mono ? '"Geist Mono", ui-monospace, monospace' : '"Geist", system-ui, sans-serif';
    var track = px < 13 ? 0.02 : px <= 20.2 ? 0 : px < 50 ? -0.01 : -0.02;
    if (o.caps) track = 0.07;
    g.save();
    g.font = (o.w || 400) + ' ' + px.toFixed(2) + 'px ' + fam;
    try { g.letterSpacing = (track * px).toFixed(2) + 'px'; g.fontVariantNumeric = 'tabular-nums'; } catch (e) { }
    g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    g.fillStyle = R.color.css(F.T[o.tone || 'ink'] || F.T.ink, o.alpha == null ? 1 : o.alpha);
    g.fillText(o.caps ? String(str).toUpperCase() : String(str), x, y);
    var w = g.measureText(o.caps ? String(str).toUpperCase() : String(str)).width;
    g.restore();
    return w;
  }

  /* подпись «Fictional data» мелким в углу кадра (§6.6) */
  function fictional(g, F) {
    var m = Math.min(F.W, F.H) * 0.06;
    text(g, F, 'Fictional data', F.W - m * 0.5, F.H - m * 0.4, { s: 0, mono: true, tone: 'ink3', align: 'right' });
  }

  R.ink = { print: print, relief: relief, link: link, text: text, fictional: fictional, SIZES: SIZES };
})();
