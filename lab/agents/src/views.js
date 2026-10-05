/* views.js · пять взглядов A1–A5 на одни и те же займы (README §7.6 C), без осей и сеток:
   точка = займ, id общие во всех видах. Разложение рождает правило (L12): филлотаксис 137,5°
   для групп, логарифм для риска, спираль для просрочки. Каждая функция чистая:
   (займы, прямоугольник, единицы) → {pos: Map id → [x, y, форма], marks: печать подписей}. */
(function () {
  'use strict';
  var R = window.RELIEF, TAU = Math.PI * 2, GOLD = 137.508 * Math.PI / 180;
  function money(v) { return v >= 1e6 ? '€' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '€' + Math.round(v / 1e3) + 'k' : '€' + Math.round(v); }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  // филлотаксис: k-я точка на радиусе c·√k под углом k·137,5° — плотный круг без сетки
  function phyllo(ids, cx, cy, c, shape, out) {
    ids.forEach(function (l, k) {
      var r = c * Math.sqrt(k + 0.5), a = k * GOLD;
      out.set(l.id, [cx + r * Math.cos(a), cy + r * Math.sin(a), typeof shape === 'function' ? shape(l) : shape]);
    });
    return c * Math.sqrt(ids.length + 0.5);
  }
  function cellFor(n, rc) { return Math.max(1.7, Math.sqrt(rc[2] * rc[3] / Math.max(1, n)) * 0.42); }
  // группы кругами вдоль мягкой дуги: площадь круга = число займов, между семьями воздух
  function clusters(groups, rc, F, shapeOf) {
    var pos = new Map(), total = groups.reduce(function (s, g) { return s + g.items.length; }, 0);
    var c = cellFor(total, rc) * 0.72, rads = groups.map(function (g) { return c * Math.sqrt(g.items.length + 0.5) + 6 * F.ui; });
    var span = rads.reduce(function (s, r) { return s + 2 * r; }, 0), k = Math.min(1, (rc[2] * 0.94) / Math.max(1, span));
    var x = rc[0] + (rc[2] - span * k) / 2, labels = [];
    groups.forEach(function (g, i) {
      var r = rads[i] * k, cx = x + r, t = (cx - rc[0]) / rc[2] - 0.5, cy = rc[1] + rc[3] * 0.5 + rc[3] * 0.16 * (4 * t * t - 0.33);
      phyllo(g.items, cx, cy, c * k, shapeOf ? function (l) { return shapeOf(l, i); } : 'dot', pos);
      labels.push([cx, i % 2 ? cy - r - 4 * F.ui : cy + r + 4 * F.ui, g.label + ' ' + g.items.length, i % 2 ? 'bottom' : 'top']);
      x += 2 * r;
    });
    return { pos: pos, r: Math.max(1.1 * F.ui, c * k * 0.42), labels: labels };
  }
  function labelMarks(labels) {
    return function (g, F, alpha) {
      labels.forEach(function (L) { R.ink.text(g, F, L[2], L[0], L[1], { s: 0, mono: true, tone: 'ink3', align: 'center', base: L[3], alpha: alpha }); });
    };
  }

  var VIEWS = {
    // A1 Monitor: риск PD × exposure, обе шкалы логарифмом, без осей; помеченные кольцом
    A1: function (loans, rc, F) {
      var pos = new Map(), lx0 = Math.log10(4000), lx1 = Math.log10(2e7), ly0 = Math.log10(0.003);
      loans.forEach(function (l) {
        var u = (Math.log10(l.exposure) - lx0) / (lx1 - lx0), v = (Math.log10(Math.max(0.003, l.pd)) - ly0) / (0 - ly0);
        pos.set(l.id, [rc[0] + u * rc[2], rc[1] + (1 - v) * rc[3], l.views.A1.flag ? 'ring' : 'dot']);
      });
      return { pos: pos, r: Math.max(1.1 * F.ui, cellFor(loans.length, rc) * 0.3), caption: 'PD × exposure · ring = flagged',
        marks: function (g, FF, alpha) {
          R.ink.text(g, FF, '↑ higher PD', rc[0], rc[1] + rc[3] + 3 * FF.ui, { s: 0, mono: true, tone: 'ink3', base: 'top', alpha: alpha });
          R.ink.text(g, FF, 'larger →', rc[0] + rc[2], rc[1] + rc[3] + 3 * FF.ui, { s: 0, mono: true, tone: 'ink3', align: 'right', base: 'top', alpha: alpha });
        } };
    },
    // A2 Diligence: пакет покупки тремя семьями pass · review · fail и вне пакета
    A2: function (loans, rc, F) {
      var keys = ['pass', 'review', 'fail'], shp = { pass: 'dot', review: 'ring', fail: 'square' };
      var groups = keys.map(function (k) { return { label: k, items: loans.filter(function (l) { return l.views.A2.inBatch && l.views.A2.result === k; }) }; });
      groups.push({ label: 'not in batch', items: loans.filter(function (l) { return !l.views.A2.inBatch; }) });
      var v = clusters(groups, rc, F, function (l, i) { return i === 3 ? 'faint' : shp[keys[i]]; });
      v.caption = 'purchase batch · square = fail'; v.marks = labelMarks(v.labels); return v;
    },
    // A3 Onboard: доля перенесённых полей; семьи по доле, полностью перенесённые — самый большой круг
    A3: function (loans, rc, F) {
      var vals = Array.from(new Set(loans.map(function (l) { return Math.round(l.views.A3.mapped * 100); }))).sort(function (a, b) { return a - b; });
      var groups = vals.map(function (v) { return { label: v + '%', items: loans.filter(function (l) { return Math.round(l.views.A3.mapped * 100) === v; }) }; });
      var w = clusters(groups, rc, F, function (l) { return l.views.A3.mapped < 1 ? 'ring' : 'dot'; });
      w.caption = 'fields mapped into the model'; w.marks = labelMarks(w.labels); return w;
    },
    // A4 Servicing: спираль просрочки; текущие — ядро, дальше по √dpd; 90 дней = R-221
    A4: function (loans, rc, F) {
      var pos = new Map(), cx = rc[0] + rc[2] * 0.5, cy = rc[1] + rc[3] * 0.5, R0 = Math.min(rc[2], rc[3]) * 0.5;
      var cur = loans.filter(function (l) { return l.dpd === 0; }), late = loans.filter(function (l) { return l.dpd > 0; }).sort(function (a, b) { return a.dpd - b.dpd || (a.id < b.id ? -1 : 1); });
      var c = R0 * 0.36 / Math.sqrt(cur.length + 0.5);
      var core = phyllo(cur, cx, cy, c, function (l) { return l.views.A4.onTime12m < 12 ? 'ring' : 'dot'; }, pos);
      late.forEach(function (l, i) {
        var r = core + 6 * F.ui + Math.sqrt(l.dpd / 300) * (R0 - core - 8 * F.ui), a = -Math.PI / 2 + i * GOLD * 0.5;
        pos.set(l.id, [cx + r * Math.cos(a), cy + r * Math.sin(a), l.dpd >= 90 ? 'square' : 'dot']);
      });
      var r90 = core + 6 * F.ui + Math.sqrt(90 / 300) * (R0 - core - 8 * F.ui);
      return { pos: pos, r: Math.max(1.1 * F.ui, c * 0.42), caption: 'days past due · core = current',
        marks: function (g, FF, alpha) {
          g.save(); g.setLineDash([1.5 * FF.ui, 3 * FF.ui]); g.lineWidth = FF.lineW; g.strokeStyle = R.color.css(FF.T.ink2, 0.35 * alpha);
          g.beginPath(); g.arc(cx, cy, r90, 0, TAU); g.stroke(); g.restore();
          R.ink.text(g, FF, '90 d · R-221', cx + r90 * 0.72, cy - r90 * 0.72 - 3 * FF.ui, { s: 0, mono: true, tone: 'ink3', base: 'bottom', alpha: alpha });
          R.ink.text(g, FF, 'current ' + cur.length, cx, cy + core + 4 * FF.ui, { s: 0, mono: true, tone: 'ink3', align: 'center', base: 'top', alpha: alpha });
        } };
    },
    // A5 Recovery: семьи по следующему шагу; monitor — большой круг, остальные веером
    A5: function (loans, rc, F) {
      var keys = ['monitor', 'restructure', 'settlement', 'legal route', 'collateral sale'];
      var groups = keys.map(function (k) { return { label: k, items: loans.filter(function (l) { return l.views.A5.action === k; }) }; }).filter(function (g) { return g.items.length; });
      var v = clusters(groups, rc, F, function (l, i) { return i === 0 ? 'dot' : i >= 3 ? 'square' : 'ring'; });
      v.caption = 'next recovery step'; v.marks = labelMarks(v.labels); return v;
    }
  };
  function tipOf(a, l) {
    if (a === 'A1') return 'PD ' + pct(l.pd, 2) + ' · ' + money(l.exposure) + (l.views.A1.flag ? ' · flagged' : '');
    if (a === 'A2') return l.views.A2.inBatch ? 'batch · ' + l.views.A2.result : 'not in batch';
    if (a === 'A3') return pct(l.views.A3.mapped, 0) + ' of fields mapped';
    if (a === 'A4') return l.dpd + ' dpd · ' + l.views.A4.onTime12m + '/12 on time';
    return l.views.A5.action + (l.views.A5.expectedRecovery ? ' · ' + money(l.views.A5.expectedRecovery) : '');
  }
  // интерес агента к займу: вес связи займа с агентом в графе (v3) и признак «агент его видит»
  function interest(a, l) {
    if (a === 'A1') return l.views.A1.flag ? 1 : 0;
    if (a === 'A2') return l.views.A2.inBatch ? (l.views.A2.result === 'fail' ? 1 : l.views.A2.result === 'review' ? 0.6 : 0.25) : 0;
    if (a === 'A3') return l.views.A3.mapped < 1 ? 0.4 + (1 - l.views.A3.mapped) * 3 : 0;
    if (a === 'A4') return l.dpd > 0 ? Math.min(1, 0.3 + l.dpd / 120) : 0;
    return l.views.A5.action !== 'monitor' ? 1 : 0;
  }
  function shapeDraw(g, x, y, r, shape, color, F) {
    g.beginPath();
    if (shape === 'square') { g.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); g.fillStyle = color; g.fill(); return; }
    if (shape === 'ring') { g.arc(x, y, r * 0.85, 0, TAU); g.strokeStyle = color; g.lineWidth = Math.max(0.8, r * 0.45); g.stroke(); return; }
    g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill();
  }
  window.AVIEWS = { VIEWS: VIEWS, tipOf: tipOf, interest: interest, money: money, pct: pct, shapeDraw: shapeDraw, phyllo: phyllo, AG: ['A1', 'A2', 'A3', 'A4', 'A5'] };
})();
