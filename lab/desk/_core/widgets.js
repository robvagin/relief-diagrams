// widgets.js — печать данных книги на листах и дисках (координаты листа: центр в 0, ширина w, высота h).
// Основа — hero из desk v2 «Loan book», принятый владельцем: одно число вынесено крупно, подпись моно
// ≈ 1:5 к числу (донор pitch-composer), спарклайн печатью, акцент одной точкой на дате.
// Данные: выдержка data/portfolio.json (сид relief-01, выдумано). Текст на экране по-английски.
(function () {
  'use strict';
  var K = window.RINK, TAU = Math.PI * 2;
  var D = function () { return window.RELIEF_DATA; };
  function pad(F, w, h) { return Math.max(6, Math.min(16 * F.ui, Math.min(w, h) * 0.09)); }
  function head(g, F, I, w, h, title, sub) {
    var p = pad(F, w, h), y = -h / 2 + p + 9 * F.ui;
    K.text(g, F, title, -w / 2 + p, y, { size: 1, caps: true, weight: 500, color: I.ink3, min: 7 });
    if (sub && w > 150 * F.ui) K.text(g, F, sub, w / 2 - p, y, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
    return y;
  }
  function wrap(g, F, s, maxW, o) {
    var words = String(s).split(' '), out = [], cur = '';
    K.font(g, F, o);
    words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = wd; } else cur = t; });
    if (cur) out.push(cur);
    return out;
  }
  function spark(g, F, I, v, x0, y0, w, h, acc) {
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    K.stroke(g, F, function (q) { v.forEach(function (q2, i) { var x = x0 + w * i / (v.length - 1), y = y0 - h * (q2 - lo) / (hi - lo || 1); i ? q.lineTo(x, y) : q.moveTo(x, y); }); }, I.ink2);
    if (acc) K.dot(g, x0 + w, y0 - h * (v[v.length - 1] - lo) / (hi - lo || 1), Math.max(2.5, 3.5 * F.ui), I.acc);
  }

  var W = {
    // hero: Exposure, одно число крупно
    hero: function (g, F, I, w, h) {
      var k = D().kpi, s = D().series, p = pad(F, w, h);
      head(g, F, I, w, h, 'Loan book · exposure', 'as of 30 Sep 2026');
      var num = K.eur(k.exposure);
      var px = K.fit(g, F, num, w - 2 * p, h * 0.3, { mono: true, weight: 500, min: 14 });
      var by = -h / 2 + h * 0.52;
      K.text(g, F, num, -w / 2 + p, by, { px: px, mono: true, weight: 500, color: I.ink });
      var d = s.exposure[11] / s.exposure[0] - 1;
      K.text(g, F, '+' + K.pct(d) + ' in 12 months · ' + k.loans + ' loans', -w / 2 + p, by + Math.max(px * 0.36, 14 * F.ui), { size: 2, mono: true, color: I.ink2, min: 7 });
      var sh = Math.min(h * 0.18, 44 * F.ui);
      if (sh > 8) spark(g, F, I, s.exposure, -w / 2 + p, h / 2 - p, w - 2 * p, sh, true);
    },
    gate: function (g, F, I, w, h) {
      var d = D().decisions[0], p = pad(F, w, h);
      var y = head(g, F, I, w, h, 'Check before action', d.id) + 22 * F.ui;
      K.text(g, F, d.action, -w / 2 + p, y, { size: 3, weight: 500, color: I.ink, min: 8 });
      var lh = Math.min((h / 2 - p - 18 * F.ui - y) / d.checks.length, 26 * F.ui);
      d.checks.forEach(function (c, i) {
        var yy = y + (i + 1) * lh + 4 * F.ui;
        K.text(g, F, c.ref, -w / 2 + p, yy, { size: 2, color: I.ink2, min: 7 });
        if (c.result === 'pass') K.text(g, F, '✓', w / 2 - p, yy, { size: 2, color: I.ink, align: 'right', min: 7 });
        else if (c.result === 'missing') { K.dot(g, w / 2 - p - 4 * F.ui, yy - 4 * F.ui, Math.max(2.5, 3.5 * F.ui), I.acc); K.text(g, F, 'missing', w / 2 - p - 14 * F.ui, yy, { size: 1, mono: true, color: I.ink2, align: 'right', min: 7 }); }
        else K.text(g, F, c.result, w / 2 - p, yy, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
      });
      K.text(g, F, 'Blocked · director approval', -w / 2 + p, h / 2 - p, { size: 1, mono: true, caps: true, weight: 500, color: I.ink, min: 7 });
    },
    // столбцы 12 месяцев: печатные пилюли целиком скруглённые, сетка под ними рельефом
    bars: function (g, F, I, w, h) {
      var s = D().series, p = pad(F, w, h), v = s.exposure, n = v.length;
      head(g, F, I, w, h, 'Exposure, 12 months', '€M');
      var x0 = -w / 2 + p, x1 = w / 2 - p, y1 = h / 2 - p - 12 * F.ui, y0 = -h / 2 + p + 26 * F.ui;
      if (y1 - y0 < 10) return;
      var hi = Math.ceil(Math.max.apply(null, v) / 5e7) * 5e7;
      [0.25, 0.5, 0.75, 1].forEach(function (f) { var y = y1 - (y1 - y0) * f; K.relief(g, F, function (q, ox, oy) { q.moveTo(x0 + ox, y + oy); q.lineTo(x1 + ox, y + oy); }, 0.7); });
      var bw = (x1 - x0) / n;
      v.forEach(function (q, i) {
        var hh = (y1 - y0) * q / hi, bx = x0 + i * bw + bw * 0.18, ww = bw * 0.64;
        g.fillStyle = i === n - 1 ? I.a('ink', 0.5) : I.a('ink', 0.14);
        g.beginPath(); g.roundRect(bx, y1 - hh, ww, hh, ww / 2); g.fill();
      });
      K.text(g, F, K.month(s.months[0]), x0, y1 + 12 * F.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
      K.text(g, F, K.month(s.months[n - 1]), x1, y1 + 12 * F.ui, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
    },
    npl: function (g, F, I, w, h) {
      var v = D().series.nplShareByCount, p = pad(F, w, h);
      head(g, F, I, w, h, 'NPL share', 'by count');
      var px = K.fit(g, F, K.pct(v[11]), (w - 2 * p) * 0.7, h * 0.24, { mono: true, weight: 500, min: 10 });
      var y = -h / 2 + p + 22 * F.ui + px * 0.85;
      K.text(g, F, K.pct(v[11]), -w / 2 + p, y, { px: px, mono: true, weight: 500, color: I.ink });
      var sh = h / 2 - p - y - 10 * F.ui;
      if (sh > 10) spark(g, F, I, v, -w / 2 + p, h / 2 - p, w - 2 * p, sh, false);
    },
    rule: function (g, F, I, w, h) {
      var ru = D().rules[0], p = pad(F, w, h);
      var y = head(g, F, I, w, h, 'Rule', ru.id);
      var st = 3, lines;
      for (var k = 6; k >= 2; k--) {
        lines = wrap(g, F, ru.text, w - 2 * p, { size: k, weight: 500, min: 7 }); st = k;
        if (lines.length * K.px(F, k) * 1.2 <= (h - 2 * p) * 0.62) break;
      }
      var lh = K.px(F, st) * 1.2;
      lines.forEach(function (l, i) { K.text(g, F, l, -w / 2 + p, y + 14 * F.ui + (i + 0.8) * lh, { size: st, weight: 500, color: I.ink, min: 7 }); });
    },
    counts: function (g, F, I, w, h) {
      var k = D().kpi, p = pad(F, w, h);
      var y = head(g, F, I, w, h, 'Model of record', '');
      var rows = [['Loans', k.loans], ['Borrowers', k.borrowers], ['Collateral', k.collateral], ['Rules', D().rules.length]];
      var lh = Math.min((h / 2 - p - y) / rows.length, 22 * F.ui);
      rows.forEach(function (r, i) {
        var yy = y + (i + 1) * lh + 2 * F.ui;
        K.text(g, F, r[0], -w / 2 + p, yy, { size: 2, color: I.ink2, min: 7 });
        K.text(g, F, String(r[1]), w / 2 - p, yy, { size: 2, mono: true, color: I.ink, align: 'right', min: 7 });
      });
    },
    // диск стадии: подпись и сумма по центру, площадь диска = объём
    stage: function (node) {
      return function (g, F, I, w) {
        var c = node.data, r = w / 2;
        var px = K.fit(g, F, K.eur(c.value), r * 1.3, r * 0.42, { mono: true, weight: 500, min: 8 });
        K.text(g, F, K.eur(c.value), 0, px * 0.32, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
        if (K.measure(g, F, c.label, { size: 1, min: 7 }) < r * 1.6) K.text(g, F, c.label, 0, -px * 0.62, { size: 1, color: I.ink3, align: 'center', min: 7 });
        if (c.label === 'non-performing') K.dot(g, 0, px * 0.32 + 9 * F.ui, Math.max(2.5, 3 * F.ui), I.acc);
      };
    },
    // диск агента: id и состояние топологией (ai-presence-canon §6)
    agent: function (node) {
      return function (g, F, I, w) {
        var a = node.data, r = w / 2, st = node.state || 'idle', s = r * 0.36, t = F.tsec || 0;
        if (st === 'work') for (var k = 0; k < 5; k++) { var a0 = TAU * (k / 5 + 0.16 * t); K.dot(g, Math.cos(a0) * s, -r * 0.12 + Math.sin(a0) * s, s * 0.22, I.a('ink', 0.3 + 0.12 * k)); }
        else if (st === 'wait') { g.strokeStyle = I.ink2; g.lineWidth = F.lineW; g.beginPath(); g.arc(0, -r * 0.12, s * 0.8, 0, TAU); g.stroke(); }
        else if (st === 'done') K.dot(g, 0, -r * 0.12, s * 0.5, I.ink);
        else for (var j = 0; j < 3; j++) K.dot(g, (j - 1) * s * 0.7, -r * 0.12, s * 0.2, I.a('ink', 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(TAU * 0.2 * t + j))));
        K.text(g, F, a.id, 0, r * 0.52, { size: 1, mono: true, weight: 500, color: I.ink2, align: 'center', min: 7 });
      };
    },
    // диск-бусина: одно число и подпись
    bead: function (label, value) {
      return function (g, F, I, w, h, n) {
        var r = w / 2, px = K.fit(g, F, value, r * 1.4, r * 0.5, { mono: true, weight: 500, min: 7 });
        if (n && n.accDot) K.dot(g, 0, px * 0.34 + 8 * F.ui, Math.max(2.5, 3 * F.ui), I.acc);
        K.text(g, F, value, 0, px * 0.34, { px: px, mono: true, weight: 500, color: I.ink, align: 'center' });
        if (label && K.measure(g, F, label, { size: 1, min: 7 }) < r * 1.6) K.text(g, F, label, 0, -px * 0.6, { size: 1, color: I.ink3, align: 'center', min: 7 });
      };
    }
  };

  // каталог виджетов-листов desk: вес (площадь), пропорция w/h
  var SHEETS = [
    { id: 'hero', w: 1.0, ar: 1.25, print: W.hero, info: function () { var k = D().kpi; return ['Exposure', K.eur(k.exposure), k.loans + ' loans', 'EL ' + K.eur(k.expectedLoss)]; } },
    { id: 'gate', w: 0.62, ar: 1.2, print: W.gate, info: function () { return ['D-7781 · blocked', 'R-104 needs approval', 'Director missing']; } },
    { id: 'bars', w: 0.55, ar: 1.35, print: W.bars, info: function () { var s = D().series; return ['Exposure Sep 2026', K.eur(s.exposure[11]), 'Oct 2025 ' + K.eur(s.exposure[0])]; } },
    { id: 'npl', w: 0.42, ar: 0.95, print: W.npl, info: function () { var v = D().series.nplShareByCount; return ['NPL share', K.pct(v[11]) + ' Sep', K.pct(v[0]) + ' Oct']; } },
    { id: 'rule', w: 0.4, ar: 1.05, print: W.rule, info: function () { return ['R-104', 'threshold €10,000']; } },
    { id: 'counts', w: 0.36, ar: 0.95, print: W.counts, info: function () { var k = D().kpi; return ['Model of record', k.loans + ' loans', k.borrowers + ' borrowers']; } }
  ];

  window.WIDGETS = { W: W, SHEETS: SHEETS, D: D };
})();
