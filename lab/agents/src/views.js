/* RELIEF lab · agents: пять агентов на одной модели (README §6.1 №06, механика §7.6 C).
   Общая часть трёх вариантов: пять взглядов A1–A5 на одни и те же займы (id общие),
   след займа (кольцо акцентом во всех видах + печатная ломаная на модели), морф с
   сохранением идентичности точек, сходимость линий в узел займа по донору 04-converge:
     1. линии входят в собирающую дугу ВНУТРИ узла (радиус 0.45 от радиуса узла);
     2. углы входа монотонны по порядку источников, поэтому линии не пересекаются;
     3. старт и приход по одной оси у всех (вертикаль или горизонталь), плечи асимметричны.
   Вариант задаёт только раскладку: AGENTS.make({layout}). */
(function () {
  'use strict';
  var R = window.RELIEF, TAU = Math.PI * 2;
  var GROUPS = {
    'Сцена': [
      ['view', 'Вид', ['row', 'morph'], 'row', ['Ряд', 'Морф']],
      ['trace', 'Связь займа', 0, 1, 1, 1]
    ],
    'Ритм': [['spacing', 'Шаг плашек', 0, 48, 1, 16]],
    'Данные': [['dots', 'Займов', 60, 240, 10, 240]]
  };
  var AG = ['A1', 'A2', 'A3', 'A4', 'A5'];

  function money(v) {
    if (v >= 1e6) return '€' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '€' + Math.round(v / 1e3) + 'k';
    return '€' + Math.round(v);
  }
  function pct(v, d) { return (v * 100).toFixed(d === undefined ? 1 : d) + '%'; }

  // ── пять взглядов: чистые функции (займы, прямоугольник, единицы) → позиции ─
  // каждая возвращает {pos: Map id → [x, y, shape], marks: [печать осей и подписей]}
  function dotR(rect, n, U) { return R.clamp(Math.sqrt(rect[2] * rect[3] / Math.max(1, n)) * 0.16, 1.3 * U.ui, 3 * U.ui); }
  function gridFill(ids, x, y, w, h, cell, out, shapeOf, align) {
    var cols = Math.max(1, Math.floor(w / cell)), rows = Math.ceil(ids.length / cols);
    var x0 = align === 'center' ? x + (w - Math.min(cols, ids.length) * cell) / 2 : x;
    ids.forEach(function (l, i) {
      var c = i % cols, r = Math.floor(i / cols);
      out.set(l.id, [x0 + c * cell + cell / 2, y + r * cell + cell / 2, shapeOf(l)]);
    });
    return rows * cell;
  }
  function fitCell(groups, w, h, r) {   // общий шаг сетки: все группы влезают
    var cell = 2 * r + 1.6;
    for (var k = 0; k < 30; k++) {
      var cols = Math.max(1, Math.floor(w / cell)), need = 0;
      groups.forEach(function (n) { need += Math.ceil(n / cols) * cell; });
      if (need <= h) return cell;
      cell *= 0.93;
    }
    return cell;
  }
  var VIEWS = {
    // A1 Monitor: разброс PD × exposure, обе оси логарифмом; помеченные кольцом
    A1: function (loans, rc, U) {
      var pos = new Map(), r = dotR(rc, loans.length, U), lab = U.fs(1) * 1.7;
      var x0 = rc[0] + lab * 1.6, y0 = rc[1], w = rc[2] - lab * 1.6, h = rc[3] - lab;
      var lx0 = Math.log10(4000), lx1 = Math.log10(2e7), ly0 = Math.log10(0.003), ly1 = 0;
      loans.forEach(function (l) {
        var x = x0 + (Math.log10(l.exposure) - lx0) / (lx1 - lx0) * w;
        var y = y0 + h - (Math.log10(Math.max(0.003, l.pd)) - ly0) / (ly1 - ly0) * h;
        pos.set(l.id, [x, y, l.views.A1.flag ? 'ring' : 'dot']);
      });
      var ticksX = [[1e4, '€10k'], [1e5, '€100k'], [1e6, '€1M'], [1e7, '€10M']].map(function (t) { return [x0 + (Math.log10(t[0]) - lx0) / (lx1 - lx0) * w, t[1]]; });
      var ticksY = [[0.01, '1%'], [0.1, '10%'], [1, '100%']].map(function (t) { return [y0 + h - (Math.log10(t[0]) - ly0) / (ly1 - ly0) * h, t[1]]; });
      return { pos: pos, r: r, marks: function (g, T, U2, relief) {
        relief(g, [[x0, y0], [x0, y0 + h], [x0 + w, y0 + h]]);
        R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3);
        g.textBaseline = 'top'; g.textAlign = 'center';
        ticksX.forEach(function (t) { if (t[0] > x0 && t[0] < x0 + w) g.fillText(t[1], t[0], y0 + h + 4 * U2.ui); });
        g.textAlign = 'right'; g.textBaseline = 'middle';
        ticksY.forEach(function (t) { g.fillText(t[1], x0 - 4 * U2.ui, t[0]); });
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }, caption: 'PD × exposure · ring = flagged' };
    },
    // A2 Diligence: пакет покупки по pass · review · fail; вне пакета отдельной полосой
    A2: function (loans, rc, U) {
      var pos = new Map(), r = dotR(rc, loans.length, U), lab = U.fs(1) * 1.6;
      var keys = ['pass', 'review', 'fail'], shp = { pass: 'dot', review: 'ring', fail: 'square' };
      var inB = keys.map(function (k) { return loans.filter(function (l) { return l.views.A2.inBatch && l.views.A2.result === k; }); });
      var out = loans.filter(function (l) { return !l.views.A2.inBatch; });
      var gap = 8 * U.ui, colW = (rc[2] - gap * 2) / 3, topH = rc[3] * 0.56 - lab, botY = rc[1] + rc[3] * 0.56 + lab + gap;
      var cell = Math.min(fitCell([Math.max.apply(null, inB.map(function (a) { return a.length; }))], colW, topH, r),
                          fitCell([out.length], rc[2], rc[1] + rc[3] - botY, r));
      inB.forEach(function (arr, i) { gridFill(arr, rc[0] + i * (colW + gap), rc[1] + lab, colW, topH, cell, pos, function () { return shp[keys[i]]; }); });
      gridFill(out, rc[0], botY, rc[2], rc[1] + rc[3] - botY, cell, pos, function () { return 'dot'; });
      return { pos: pos, r: Math.min(r, cell * 0.4), muted: new Set(out.map(function (l) { return l.id; })), marks: function (g, T, U2, relief) {
        R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'top';
        keys.forEach(function (k, i) { g.fillText(k + ' ' + inB[i].length, rc[0] + i * (colW + gap), rc[1]); });
        relief(g, [[rc[0], botY - lab - gap / 2], [rc[0] + rc[2], botY - lab - gap / 2]]);
        g.fillText('not in batch ' + out.length, rc[0], botY - lab);
        g.textBaseline = 'alphabetic';
      }, caption: 'purchase batch · square = fail' };
    },
    // A3 Onboard: доля перенесённых полей столбиками точек
    A3: function (loans, rc, U) {
      var pos = new Map(), r = dotR(rc, loans.length, U), lab = U.fs(1) * 1.7;
      var vals = Array.from(new Set(loans.map(function (l) { return Math.round(l.views.A3.mapped * 100); }))).sort(function (a, b) { return a - b; });
      var bins = vals.map(function (v) { return loans.filter(function (l) { return Math.round(l.views.A3.mapped * 100) === v; }); });
      var gap = 6 * U.ui, colW = (rc[2] - gap * (bins.length - 1)) / Math.max(1, bins.length), h = rc[3] - lab;
      var cell = fitCell([Math.max.apply(null, bins.map(function (b) { return b.length; }))], colW, h, r);
      bins.forEach(function (b, i) {
        var cols = Math.max(1, Math.floor(colW / cell)), x = rc[0] + i * (colW + gap) + (colW - Math.min(cols, b.length) * cell) / 2;
        b.forEach(function (l, j) {   // столбик растёт снизу вверх
          var c = j % cols, rr = Math.floor(j / cols);
          pos.set(l.id, [x + c * cell + cell / 2, rc[1] + h - rr * cell - cell / 2, l.views.A3.mapped < 1 ? 'ring' : 'dot']);
        });
      });
      return { pos: pos, r: Math.min(r, cell * 0.4), marks: function (g, T, U2, relief) {
        relief(g, [[rc[0], rc[1] + h + 2 * U2.ui], [rc[0] + rc[2], rc[1] + h + 2 * U2.ui]]);
        R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'top'; g.textAlign = 'center';
        vals.forEach(function (v, i) { g.fillText(v + '%', rc[0] + i * (colW + gap) + colW / 2, rc[1] + h + 5 * U2.ui); });
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }, caption: 'fields mapped into the model' };
    },
    // A4 Servicing: рой по дням просрочки; текущие блоком, остальные по √dpd, 90 д = R-221
    A4: function (loans, rc, U) {
      var pos = new Map(), r = dotR(rc, loans.length, U), lab = U.fs(1) * 1.7, h = rc[3] - lab;
      var cur = loans.filter(function (l) { return l.dpd === 0; }), late = loans.filter(function (l) { return l.dpd > 0; }).sort(function (a, b) { return a.dpd - b.dpd || (a.id < b.id ? -1 : 1); });
      var blockW = rc[2] * 0.34, gap = 10 * U.ui, sx = rc[0] + blockW + gap, sw = rc[2] - blockW - gap;
      var cell = fitCell([cur.length], blockW, h, r);
      gridFill(cur, rc[0], rc[1] + Math.max(0, h - Math.ceil(cur.length / Math.max(1, Math.floor(blockW / cell))) * cell), blockW, h, cell, pos, function (l) { return l.views.A4.onTime12m < 12 ? 'ring' : 'dot'; });
      var maxD = 300, mid = rc[1] + h / 2, occ = new Map();
      late.forEach(function (l) {   // однородный рой: колонка по x, этаж вверх-вниз попеременно
        var x = sx + Math.sqrt(l.dpd / maxD) * sw, col = Math.round((x - sx) / cell), k = occ.get(col) || 0;
        occ.set(col, k + 1);
        var off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * cell;
        pos.set(l.id, [Math.min(sx + col * cell, sx + sw - cell / 2), R.clamp(mid + off, rc[1] + cell / 2, rc[1] + h - cell / 2), l.dpd >= 90 ? 'square' : 'dot']);
      });
      var t90 = sx + Math.sqrt(90 / maxD) * sw;
      return { pos: pos, r: Math.min(r, cell * 0.4), marks: function (g, T, U2, relief) {
        relief(g, [[sx, rc[1] + h + 2 * U2.ui], [sx + sw, rc[1] + h + 2 * U2.ui]]);
        relief(g, [[t90, rc[1]], [t90, rc[1] + h + 2 * U2.ui]]);
        R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'top';
        g.fillText('current ' + cur.length, rc[0], rc[1] + h + 5 * U2.ui);
        g.textAlign = 'center'; g.fillText('90 d', t90, rc[1] + h + 5 * U2.ui);
        g.textAlign = 'right'; g.fillText('300 d', sx + sw, rc[1] + h + 5 * U2.ui);
        g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('R-221', t90 + 3 * U2.ui, rc[1] + U2.fs(1) * 1.2);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }, caption: 'days past due · ring = missed' };
    },
    // A5 Recovery: группы по следующему шагу строками, подпись над точками
    A5: function (loans, rc, U) {
      var pos = new Map(), r = dotR(rc, loans.length, U), lab = U.fs(1) * 1.5;
      var keys = ['monitor', 'restructure', 'settlement', 'legal route', 'collateral sale'];
      var grp = keys.map(function (k) { return loans.filter(function (l) { return l.views.A5.action === k; }); });
      if (rc[3] < rc[2] * 0.42) return A5wide(loans, rc, U, keys, grp, r, lab);
      var gap = 6 * U.ui, avail = rc[3] - keys.length * (lab + gap);
      var cell = fitCell(grp.map(function (a) { return Math.max(1, a.length); }), rc[2], avail, r);
      var y = rc[1], rows = [];
      grp.forEach(function (arr, i) {
        rows.push([y, keys[i], arr.length]);
        var hh = gridFill(arr, rc[0], y + lab, rc[2], avail, cell, pos, function () { return i === 0 ? 'dot' : i >= 3 ? 'square' : 'ring'; });
        y += lab + Math.max(hh, cell) + gap;
      });
      return { pos: pos, r: Math.min(r, cell * 0.4), marks: function (g, T, U2, relief) {
        R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'top';
        rows.forEach(function (rw, i) {
          if (i) relief(g, [[rc[0], rw[0] - gap / 2], [rc[0] + rc[2], rw[0] - gap / 2]]);
          g.fillText(rw[1] + ' ' + rw[2], rc[0], rw[0] + 1);
        });
        g.textBaseline = 'alphabetic';
      }, caption: 'next recovery step' };
    }
  };
  // A5 на широкой низкой плашке: группы колонками, ширина колонки по числу займов
  function A5wide(loans, rc, U, keys, grp, r, lab) {
    var pos = new Map(), gap = 10 * U.ui, h = rc[3] - lab, cell = 2 * r + 1.6;
    var minW = keys.map(function (k2, i) { return (k2.length + String(grp[i].length).length + 1) * U.fs(1) * 0.62 + 6 * U.ui; });   // моно: ширина подписи
    for (var k = 0; k < 30; k++) {
      var rows = Math.max(1, Math.floor(h / cell)), tot = 0;
      grp.forEach(function (a, i) { tot += Math.max(minW[i], Math.ceil(a.length / rows) * cell); });
      if (tot + gap * (keys.length - 1) <= rc[2]) break;
      cell *= 0.93;
    }
    var rowsN = Math.max(1, Math.floor(h / cell)), x = rc[0], cols = [];
    grp.forEach(function (arr, i) {
      var nc = Math.max(1, Math.ceil(arr.length / rowsN)), w = Math.max(minW[i], nc * cell);
      arr.forEach(function (l, j) {
        pos.set(l.id, [x + Math.floor(j / rowsN) * cell + cell / 2, rc[1] + lab + (j % rowsN) * cell + cell / 2, i === 0 ? 'dot' : i >= 3 ? 'square' : 'ring']);
      });
      cols.push([x, keys[i], arr.length]); x += w + gap;
    });
    return { pos: pos, r: Math.min(r, cell * 0.4), marks: function (g, T, U2, relief) {
      R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'top';
      cols.forEach(function (c, i) {
        if (i) relief(g, [[c[0] - gap / 2, rc[1]], [c[0] - gap / 2, rc[1] + rc[3]]]);
        g.fillText(c[1] + ' ' + c[2], c[0], rc[1]);
      });
      g.textBaseline = 'alphabetic';
    }, caption: 'next recovery step' };
  }
  function tipOf(a, l) {
    if (a === 'A1') return 'PD ' + pct(l.pd, 2) + ' · ' + money(l.exposure) + (l.views.A1.flag ? ' · flagged' : '');
    if (a === 'A2') return l.views.A2.inBatch ? 'batch · ' + l.views.A2.result : 'not in batch';
    if (a === 'A3') return pct(l.views.A3.mapped, 0) + ' of fields mapped';
    if (a === 'A4') return l.dpd + ' dpd · ' + l.views.A4.onTime12m + '/12 on time';
    return l.views.A5.action + (l.views.A5.expectedRecovery ? ' · ' + money(l.views.A5.expectedRecovery) : '');
  }

  function make(V) {
    var S = { loans: [], byId: new Map(), sel: null, hover: null, hit: [], cache: new Map(), manual: 0, manualAt: -10, manualFrom: 0 };

    function subset(ctx) {
      var all = ctx.data.loans.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var n = R.clamp(Math.round(+ctx.P.dots), 1, all.length), f = ctx.data.focus.loan;
      var pick = all.slice(0, n);
      if (!pick.some(function (l) { return l.id === f; })) { pick[pick.length - 1] = all.filter(function (l) { return l.id === f; })[0]; }
      S.loans = pick; S.byId = new Map(pick.map(function (l) { return [l.id, l]; })); S.cache.clear();
      if (!S.sel || !S.byId.has(S.sel)) S.sel = f;
    }
    function view(a, rect, U) {
      var key = a + '|' + rect.map(function (v) { return Math.round(v); }).join(',') + '|' + S.loans.length;
      var v = S.cache.get(key);
      if (!v) { v = VIEWS[a](S.loans, rect, U); S.cache.set(key, v); if (S.cache.size > 60) S.cache.clear(); }
      return v;
    }
    function inner(rc, U) {   // контент плашки под шапкой
      var pad = 12 * U.ui, head = U.fs(2) * 1.25 + U.fs(1) * 1.4 + 10 * U.ui;
      return [rc[0] + pad, rc[1] + pad + head, rc[2] - pad * 2, rc[3] - pad * 2 - head - U.fs(1) * 0.4];
    }
    function relief(ctx, U) {   // рельефная линия §7.4: тёмный штрих + светлый со сдвигом к свету
      var th = (+ctx.P.az) * Math.PI / 180, ph = (+ctx.P.elev) * Math.PI / 180;
      var lx = Math.cos(ph) * Math.cos(th), ly = -Math.cos(ph) * Math.sin(th);
      return function (g, pts, T) {
        T = T || S.T;
        g.lineWidth = U.lineW;
        [[0, 0, R.rgba(T.ink2, 0.45)], [-0.75 * lx, -0.75 * ly, R.rgba(T.light, 0.55)]].forEach(function (s) {
          g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0] + s[0], p[1] + s[1]); else g.moveTo(p[0] + s[0], p[1] + s[1]); });
          g.strokeStyle = s[2]; g.stroke();
        });
      };
    }
    // морф: текущий вид и переход 900 мс со ступенькой 15 мс по рангу точки
    function morphState(ctx, ts) {
      if (ctx.reduced) return { cur: S.manual, prev: null, tau: 99 };
      if (ctx.P.view === 'morph') {
        var dwell = (+ctx.P.period) / 5, k = Math.floor(ts / dwell);
        return { cur: k % 5, prev: (k + 4) % 5, tau: k === 0 ? 99 : ts - k * dwell };
      }
      return { cur: S.manual, prev: S.manualFrom, tau: ts - S.manualAt };
    }
    function shapeDraw(g, x, y, r, shape, color) {
      g.beginPath();
      if (shape === 'square') { g.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); g.fillStyle = color; g.fill(); return; }
      if (shape === 'ring') { g.arc(x, y, r * 0.85, 0, TAU); g.strokeStyle = color; g.lineWidth = Math.max(0.8, r * 0.45); g.stroke(); return; }
      g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill();
    }
    // печать вида на плашке: оси, точки, кольцо следа; позиции в координатах кадра
    function printView(g, T, U, v, from, mt, ctx, ox, oy, a) {
      var rel = relief(ctx, U), step = 0.015, N = S.loans.length;
      if (!from) v.marks(g, T, U, function (gg, pts) { rel(gg, pts, T); });
      else {
        g.save(); g.globalAlpha = R.clamp((mt - N * step * 0.5) / 0.45, 0, 1); v.marks(g, T, U, function (gg, pts) { rel(gg, pts, T); }); g.restore();
      }
      var r = v.r, selPos = null;
      S.loans.forEach(function (l, i) {
        var p = v.pos.get(l.id); if (!p) return;
        var x = p[0], y = p[1], sh = p[2], rr = r;
        if (from) {
          var q = from.pos.get(l.id), e = R.EASE(R.clamp((mt - i * step) / 0.9, 0, 1));
          if (q) { x = R.mix(q[0], p[0], e); y = R.mix(q[1], p[1], e); sh = e < 0.5 ? q[2] : p[2]; rr = R.mix(from.r, v.r, e); }
        }
        var muted = v.muted && v.muted.has(l.id) && (!from || mt > 0.9 + N * step);
        shapeDraw(g, x, y, rr, sh, R.rgba(T.ink2, muted ? 0.35 : 0.82));
        S.hit.push([x + ox, y + oy, l.id, a]);
        if (l.id === S.sel) selPos = [x, y, rr];
        if (l.id === S.hover) S.hoverAt = [x + ox, y + oy, a];
      });
      if (selPos && +ctx.P.trace) {
        g.beginPath(); g.arc(selPos[0], selPos[1], selPos[2] + 3.5 * U.ui, 0, TAU);
        g.strokeStyle = R.rgba(T.accent); g.lineWidth = U.lineW; g.stroke();
      }
      return selPos;
    }

    function draw(ctx) {
      var U = R.units(ctx), ts = R.tsec(ctx), P = ctx.P;
      if (!S.loans.length) subset(ctx);
      S.T = R.tokens(); S.hit = []; S.hoverAt = null;
      var L = V.layout(ctx, U, P, S), ms = morphState(ctx, ts);
      var morph = P.view === 'morph' || V.single;
      var cards = morph ? [{ a: AG[ms.cur], rect: L.stage, idx: ms.cur }] : L.agents.map(function (rc, i) { return { a: AG[i], rect: rc, idx: i }; });
      // позиции следа: где выбранный займ лежит в каждом виде (для ломаной и сходимости)
      cards.forEach(function (c) {
        c.inner = inner(c.rect, U); c.v = view(c.a, c.inner, U);
        if (morph && ms.tau < 0.9 + S.loans.length * 0.015 && ms.prev !== null && ms.prev !== c.idx) c.from = view(AG[ms.prev], c.inner, U);
        var p = c.v.pos.get(S.sel); c.selLocal = p ? [p[0], p[1]] : null;
      });
      var plates = [];
      plates.push({ id: 'model', kind: 'rect', x: L.model[0], y: L.model[1], w: L.model[2], h: L.model[3], z: U.z(1), env: 0,
        print: function (g, T, U2) { printModel(g, T, U2, ctx, L, cards); } });
      cards.forEach(function (c) {
        plates.push({ id: 'agent/' + (morph ? 'stage' : c.a), kind: 'rect', x: c.rect[0], y: c.rect[1], w: c.rect[2], h: c.rect[3], z: U.z(2),
          print: function (g, T, U2, p) { printAgent(g, T, U2, ctx, c, ms, p); } });
      });
      if (L.hub) plates.push({ id: 'hub', kind: 'disc', x: L.hub[0], y: L.hub[1], r: L.hub[2], z: U.z(2), env: R.settleEnv(ts, 0, +P.settle),
        print: function (g, T, U2, p) { printHub(g, T, U2, ctx, p); } });
      if (V.extra) V.extra(ctx, U, L, S, plates, cards, ms);
      // подсказка z3 со своей тенью
      if (S.hoverAt) {
        var l = S.byId.get(S.hover), tip = [S.hover, tipOf(S.hoverAt[2], l)];
        R.font(ctx.g, U, 1, 500, true);
        var tw = Math.max(ctx.g.measureText(tip[0]).width, ctx.g.measureText(tip[1]).width) + 16 * U.ui, th = U.fs(1) * 2.9;
        var tx = R.clamp(S.hoverAt[0] + 10 * U.ui, 4, ctx.W - tw - 4), ty = R.clamp(S.hoverAt[1] - th - 10 * U.ui, 4, ctx.H - th - 4);
        plates.push({ id: 'tip', kind: 'rect', x: tx, y: ty, w: tw, h: th, z: U.z(3), rad: 4 * U.ui, env: 0, print: function (g, T, U2, p) {
          var x = p.cx - p.dx - p.w / 2 + 8 * U2.ui, y = p.cy - p.dy;
          g.textBaseline = 'middle'; R.font(g, U2, 1, 500, true); g.fillStyle = R.rgba(T.ink); g.fillText(tip[0], x, y - U2.fs(1) * 0.6);
          R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink2); g.fillText(tip[1], x, y + U2.fs(1) * 0.65); g.textBaseline = 'alphabetic';
        } });
      }
      S.cards = cards; S.L = L;
      R.render(ctx, { plates: plates, overlay: function (g, T, U2) { overlay(g, T, U2, ctx, L); } });
    }

    function printAgent(g, T, U, ctx, c, ms, p) {
      var rc = c.rect, pad = 12 * U.ui, ag = ctx.data.agents[c.idx];
      g.textBaseline = 'top'; g.textAlign = 'left';
      R.font(g, U, 2, 500); g.fillStyle = R.rgba(T.ink); g.fillText(ag.id + ' · ' + ag.name, rc[0] + pad, rc[1] + pad);
      R.font(g, U, 1, 400, true); g.fillStyle = R.rgba(T.ink3);
      g.fillText(c.v.caption, rc[0] + pad, rc[1] + pad + U.fs(2) * 1.3);
      var mt = c.from ? ms.tau : 99;
      printView(g, T, U, c.v, c.from, mt, ctx, p.dx, p.dy, c.a);
    }
    // модель z1: заголовок, ломаная следа и сходимость в узел займа (печать, под агентами)
    function printModel(g, T, U, ctx, L, cards) {
      var m = 14 * U.ui, x = L.model[0] + m, y = L.model[1] + m;
      g.textBaseline = 'top'; g.textAlign = 'left';
      R.caps(g, U, 1); g.fillStyle = R.rgba(T.ink3); g.fillText('FIVE AGENTS · ONE MODEL', x, y);
      R.font(g, U, 3, 500); g.fillStyle = R.rgba(T.ink);
      g.fillText('The same ' + S.loans.length + ' loans, read five ways', x, y + U.fs(1) * 1.6);
      R.font(g, U, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textAlign = 'right';
      g.fillText('Fictional data', L.model[0] + L.model[2] - m, L.model[1] + L.model[3] - m - U.fs(1));
      g.textAlign = 'left';
      if (!+ctx.P.trace) { if (V.modelPrint) V.modelPrint(g, T, U, ctx, L, cards, []); return; }
      var pts = cards.filter(function (c) { return c.selLocal; }).map(function (c) { return [c.selLocal[0], c.selLocal[1], c]; });
      g.lineWidth = U.lineW;
      if (pts.length > 1 && !L.noPolyline) {   // ломаная следа: видна в зазорах между агентами
        g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.strokeStyle = R.rgba(T.ink, 0.42); g.setLineDash([2 * U.ui, 3 * U.ui]); g.stroke(); g.setLineDash([]);
      }
      if (L.hub) converge(g, T, U, L, pts);
      if (V.modelPrint) V.modelPrint(g, T, U, ctx, L, cards, pts);
    }
    function converge(g, T, U, L, pts) {
      var hx = L.hub[0], hy = L.hub[1], rc = L.hub[2] * 0.45, N = pts.length;
      pts.forEach(function (p, i) {
        var c = p[2], t = N === 1 ? 0.5 : i / (N - 1), p0, p3, c1, c2, a;
        if (L.axis === 'vertical') {
          a = -Math.PI + (0.12 + 0.76 * t) * Math.PI;              // правило 2: слева направо = по дуге
          p0 = [p[0], c.rect[1] + c.rect[3] + 3 * U.ui];
          p3 = [hx + rc * Math.cos(a), hy + rc * Math.sin(a)];
          var sh = (p3[1] - p0[1]) * 0.55; c1 = [p0[0], p0[1] + sh]; c2 = [p3[0], p3[1] - sh];   // правило 3
        } else {
          a = Math.PI + (0.38 - 0.76 * t) * Math.PI;
          p0 = [c.rect[0] + c.rect[2] + 3 * U.ui, p[1]];
          p3 = [hx + rc * Math.cos(a), hy + rc * Math.sin(a)];
          var sw = (p3[0] - p0[0]) * 0.55; c1 = [p0[0] + sw, p0[1]]; c2 = [p3[0] - sw, p3[1]];
        }
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p3[0], p3[1]);
        g.strokeStyle = R.rgba(T.ink, 0.5); g.stroke();
        g.beginPath(); g.arc(p0[0], p0[1], 1.6 * U.ui, 0, TAU); g.fillStyle = R.rgba(T.ink, 0.6); g.fill();
      });
    }
    function printHub(g, T, U, ctx, p) {
      var x = p.cx - p.dx, y = p.cy - p.dy;
      g.beginPath(); g.arc(x, y, 2.6 * U.ui, 0, TAU); g.fillStyle = R.rgba(T.accent); g.fill();
    }
    function overlay(g, T, U, ctx, L) {
      if (!L.hub || L.hubLabel === 'none') return;
      var l = S.byId.get(S.sel); if (!l) return;
      var x = L.hub[0], y = L.hub[1] + L.hub[2] + 8 * U.ui;
      g.textAlign = L.hubLabel === 'left' ? 'right' : 'center'; g.textBaseline = 'top';
      if (L.hubLabel === 'left') { x = L.hub[0] - L.hub[2] - 10 * U.ui; y = L.hub[1] - U.fs(2) * 0.6; }
      R.font(g, U, 2, 500); g.fillStyle = R.rgba(T.ink); g.fillText(l.id + ' · one record', x, y);
      R.font(g, U, 1, 400, true); g.fillStyle = R.rgba(T.ink3);
      g.fillText(l.segment + ' · ' + l.country + ' · ' + money(l.exposure) + ' · ' + l.stage, x, y + U.fs(2) * 1.3);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }

    function redraw(ctx) { if (ctx.reduced || RELIEF.paused) window.postMessage({ type: 'es:progress', value: ctx.p }, '*'); }
    function attach(ctx) {
      var cv = ctx.canvas;
      function near(e) {
        var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 7;
        S.hit.forEach(function (h) { var d = Math.hypot(h[0] - x, h[1] - y); if (d < bd) { bd = d; best = h; } });
        return [best, x, y];
      }
      cv.addEventListener('pointermove', function (e) { var n = near(e)[0], id = n ? n[2] : null; if (id !== S.hover) { S.hover = id; redraw(ctx); } });
      cv.addEventListener('pointerleave', function () { S.hover = null; redraw(ctx); });
      cv.addEventListener('click', function (e) {
        var nn = near(e), n = nn[0];
        if (n) { S.sel = n[2]; redraw(ctx); return; }
        if (V.click && V.click(ctx, S, nn[1], nn[2], R.tsec(ctx))) redraw(ctx);
      });
    }

    R.scene({
      id: 'agents', variant: V.variant, title: 'Agents · ' + V.name,
      blurb: 'Five agents on one model: the same loans in five readings, one loan traced through all of them.',
      groups: V.groups ? V.groups(GROUPS) : GROUPS,
      init: function (ctx) { if (V.defaults) Object.assign(ctx.P, V.defaults); subset(ctx); },
      structural: function (ctx, path) { if (path === 'dots') subset(ctx); },
      draw: draw, attach: attach
    });
    return S;
  }
  window.AGENTS = { make: make, VIEWS: VIEWS, money: money, pct: pct, tipOf: tipOf, AG: AG };
})();
