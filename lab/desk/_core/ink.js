// ink.js — печать для организмов desk и ledger: текст (Geist, Geist Mono, трекинг по кеглю по
// adaptive-typography), числа, мягкие кривые стеблей и щупалец одной толщины (L7), рельефная линия.
// Цвета только из R.tokens (src/tokens.scene.js): хексов здесь нет.
(function () {
  'use strict';
  var R = window.RELIEF;
  var TAU = Math.PI * 2;
  // шкала ×1,2 от 14 (§8): t1..t8, крупные числа t9..t11
  var TS = [0, 11.67, 14, 16.8, 20.16, 24.19, 29.03, 34.84, 41.8, 50.2, 60.2, 72.2];
  // трекинг по кеглю: мелкое в плюс, 14–20 ноль, крупное в минус; капс +0.07em
  function track(px, caps) { return caps ? 0.07 : px < 13 ? 0.02 : px <= 20.5 ? 0 : px < 50 ? -0.01 : -0.02; }
  function px(F, step, k) { return (step < 12 && step === Math.floor(step) ? TS[step] : step) * F.ui * (k || 1); }
  function font(g, F, o) {
    var p = Math.max(o.min || 8, o.px || px(F, o.size || 2, o.k));
    g.font = (o.weight || 400) + ' ' + p.toFixed(2) + 'px ' + (o.mono ? '"Geist Mono", ui-monospace, monospace' : 'Geist, system-ui, sans-serif');
    if ('letterSpacing' in g) g.letterSpacing = (track(p, o.caps) * p).toFixed(2) + 'px';
    return p;
  }
  function text(g, F, s, x, y, o) {
    o = o || {};
    var p = font(g, F, o);
    g.fillStyle = o.color;
    g.textAlign = o.align || 'left';
    g.textBaseline = o.base || 'alphabetic';
    g.fillText(o.caps ? String(s).toUpperCase() : String(s), x, y);
    return p;
  }
  function measure(g, F, s, o) { font(g, F, o || {}); return g.measureText(o && o.caps ? String(s).toUpperCase() : String(s)).width; }
  // самый крупный кегль, при котором строка влезает в ширину w и высоту h
  function fit(g, F, s, w, h, o) {
    var w100 = measure(g, F, s, Object.assign({}, o, { px: 100, min: 1 })) / 100;
    return Math.max(o.min || 8, Math.min(w / Math.max(0.01, w100), h));
  }

  function eur(v, d) {
    var a = Math.abs(v);
    if (a >= 1e9) return '€' + (v / 1e9).toFixed(d == null ? 2 : d) + 'B';
    if (a >= 1e6) return '€' + (v / 1e6).toFixed(d == null ? 1 : d) + 'M';
    if (a >= 1e3) return '€' + (v / 1e3).toFixed(d == null ? 0 : d) + 'k';
    return '€' + v.toFixed(0);
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function month(s) { return MON[(+s.slice(5, 7)) - 1]; }

  // палитра кадра: чернила и акцент из токенов
  function inks(F) {
    var T = F.T, C = R.color;
    return {
      ink: C.css(T.ink), ink2: C.css(T.ink2), ink3: C.css(T.ink3), acc: C.css(T.accent),
      line: C.css(T.ink, T.lineA), a: function (k, al) { return C.css(T[k], al); }
    };
  }

  // мягкая кривая с натяжением: кубика a → b, касательные ta, tb (единичные), длина ручек ∝ расстоянию
  function curve(g, a, b, ta, tb, tension) {
    var d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = d * (0.25 + 0.3 * (1 - (tension == null ? 0.5 : tension)));
    g.moveTo(a[0], a[1]);
    g.bezierCurveTo(a[0] + ta[0] * k, a[1] + ta[1] * k, b[0] - tb[0] * k, b[1] - tb[1] * k, b[0], b[1]);
  }
  // рельефная линия (структура вырезана, §7.4): тёмный штрих и светлый со сдвигом −0.75·l_xy
  function relief(g, F, path, al) {
    var T = F.T, C = R.color, night = T.theme === 'night', l = F.L.l, n = Math.hypot(l[0], l[1]) || 1;
    al = al == null ? 1 : al;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = C.css(T.ink2, (night ? 0.2 : 0.42) * al); g.beginPath(); path(g, 0, 0); g.stroke();
    g.strokeStyle = C.css(F.tn.light, (night ? 0.1 : 0.6) * al); g.beginPath(); path(g, -0.75 * l[0] / n, -0.75 * l[1] / n); g.stroke();
    g.restore();
  }
  // печатная линия данных
  function stroke(g, F, path, color, al) {
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha = al == null ? 1 : al; g.strokeStyle = color; g.beginPath(); path(g); g.stroke(); g.restore();
  }
  function dot(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

  window.RINK = { TS: TS, px: px, font: font, text: text, measure: measure, fit: fit, eur: eur, pct: pct, month: month, MON: MON,
    inks: inks, curve: curve, relief: relief, stroke: stroke, dot: dot, TAU: TAU };
})();
