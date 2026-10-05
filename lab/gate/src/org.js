/* org.js · организм поверх общего живого графа src/motion/graph.js (приказ 3, закон 5).
   Раскладка организма (мобиль, росток, осьминог) двигает ЯКОРЯ узлов каждый кадр; физику, пружины к соседям,
   перетаскивание, наведение с подъёмом и притуханием, клик-фокус, колесо-зум и панораму даёт R.graph.
   Мир = экранные px кадра (вид 1:1), параллакс за мышью добавляется по высоте узла: выше = сильнее сдвиг.
   Здесь же печать организма: мягкие кривые одной толщины, засечки на лучах, гармоники качания. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org = {};
  var TAU = Math.PI * 2;
  var S = { G: null, key: '', ids: [], idx: {}, canvas: null, sx: [], sy: [], r: [] };
  O.state = S;

  /* мягкая кривая через точки (Catmull-Rom → Безье, натяжение t): одна толщина, без углов */
  O.curve = function (g, pts, t) {
    t = t == null ? 0.5 : t;
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3,
        p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3, p2[0], p2[1]);
    }
  };
  O.stem = function (g, F, pts, o) {
    o = o || {};
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    if (o.dash) g.setLineDash(o.dash);
    g.strokeStyle = R.color.css(F.T[o.tone || 'ink2'], o.alpha == null ? 0.75 : o.alpha);
    g.beginPath(); O.curve(g, pts, o.t); g.stroke(); g.restore();
  };
  /* засечки на луче (Satellites): короткие, полупрозрачные, по нормали к лучу */
  O.ticks = function (g, F, a, b, n, o) {
    o = o || {};
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, s = 3 * F.ui;
    g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink2, o.alpha == null ? 0.35 : o.alpha);
    g.beginPath();
    for (var i = 1; i < n; i++) { var x = a[0] + dx * i / n, y = a[1] + dy * i / n; g.moveTo(x - nx * s, y - ny * s); g.lineTo(x + nx * s, y + ny * s); }
    g.stroke(); g.restore();
  };
  /* гармоники одного периода (§7.5): цикл замыкается, скорость непрерывна; env гасит размах */
  O.swing = function (seed, id, tsec, P, amp, env) {
    if (!env || !amp) return 0;
    var ph = R.motion.phases(seed, 'org/' + id), per = Math.max(1, +P.period || 36), w = TAU * (((tsec % per) + per) % per) / per;
    return amp * env * (0.62 * Math.sin(w + ph[0]) + 0.28 * Math.sin(2 * w + ph[1]) + 0.10 * Math.sin(3 * w + ph[2]));
  };

  function pick(sx, sy) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < S.ids.length; i++) {
      var d = Math.hypot(sx - S.sx[i], sy - S.sy[i]);
      if (d < S.r[i] + 6 && d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function redraw() { var c = window.KIT && KIT.scene.ctx; if (c && c.reduced && window.Scene) Scene.set('format', Scene.get('format')); }

  /* узлы кадра [{id, x, y, r, z?, nb:[id]}] в px кадра. key меняется — граф пересоздаётся (структура иная) */
  O.frame = function (ctx, key, nodes) {
    var W = ctx.W, H = ctx.H;
    if (!S.G || S.key !== key) {
      S.ids = nodes.map(function (n) { return n.id; }); S.idx = {};
      S.ids.forEach(function (id, i) { S.idx[id] = i; });
      var edges = [], seen = {};
      nodes.forEach(function (n, i) { (n.nb || []).forEach(function (id) {
        var j = S.idx[id], k = i < j ? i + '-' + j : j + '-' + i;
        if (j != null && !seen[k]) { seen[k] = 1; edges.push({ a: i, b: j, k: 8 }); } }); });
      S.G = R.graph.create(nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, r: n.r * 0.6, mass: n.mass || 1, drift: 0 }; }), edges, {});
      S.key = key;
      if (S.canvas !== ctx.canvas) { S.canvas = ctx.canvas; R.graph.bind({ get mouse() { return S.G.mouse; }, set mouse(v) { S.G.mouse = v; },
        get hover() { return S.G.hover; }, set hover(v) { S.G.hover = v; }, get drag() { return S.G.drag; }, set drag(v) { S.G.drag = v; },
        get dragW() { return S.G.dragW; }, set dragW(v) { S.G.dragW = v; }, get view() { return S.G.view; }, set view(v) { S.G.view = v; },
        get viewT() { return S.G.viewT; }, set viewT(v) { S.G.viewT = v; },
        toWorld: function (x, y) { return S.G.toWorld(x, y); }, scale: function () { return S.G.scale(); },
        goFocus: function (i) { S.G.goFocus(i, 1.35); }, goHome: function () { S.G.goHome(); } }, ctx.canvas, pick, redraw); }
    }
    var G = S.G;
    // якоря идут за живой раскладкой: физика тянет узел к якорю и к соседям (лаг = органика)
    nodes.forEach(function (n, i) { if (G.nodes[i]) { G.nodes[i].x = n.x; G.nodes[i].y = n.y; } });
    G.fit = { s: 1, cx: W / 2, cy: H / 2 }; G.home = { zoom: 1, x: W / 2, y: H / 2 };
    if (!G._viewed) { G.view = { zoom: 1, x: W / 2, y: H / 2 }; G._viewed = true; }
    G.sync(ctx, { drift: 0, anchorK: 26, springK: 8, repel: 0.4, damp: 10, period: +ctx.P.period || 36 });
    var mouse = G.mouse, k = G.scale();
    function screen(i, z) {
      var st = G.state(i), p = G.toScreen(st.x, st.y);
      if (mouse && z) { var q = 0.55 * z / 28; p[0] += (mouse[0] - W / 2) / (W / 2) * q * 14; p[1] += (mouse[1] - H / 2) / (H / 2) * q * 14; }
      return p;
    }
    var V = {
      k: k, G: G,
      has: function (id) { return id in S.idx; },
      pos: function (id, z) { var i = S.idx[id], p = screen(i, z || 0); S.sx[i] = p[0]; S.sy[i] = p[1]; return p; },
      lift: function (id) { var i = S.idx[id]; return i == null ? 0 : G.state(i).lift; },
      fade: function (id) { var i = S.idx[id]; return i == null ? 0 : G.state(i).fade; },
      dim: function (id) { return 1 - 0.62 * V.fade(id); },
      focus: G.focus >= 0 ? S.ids[G.focus] : null,
      hover: G.hover >= 0 ? S.ids[G.hover] : null,
      /* точка конструкции (не узел): тот же вид, без физики */
      pt: function (p, z) { var q = G.toScreen(p[0], p[1]);
        if (mouse && z) { var s = 0.55 * z / 28; q[0] += (mouse[0] - W / 2) / (W / 2) * s * 14; q[1] += (mouse[1] - H / 2) / (H / 2) * s * 14; }
        return q; }
    };
    nodes.forEach(function (n, i) { S.r[i] = n.r * k; });
    return V;
  };
  /* притухание ЦВЕТОМ (pseudo-3d-layers §2): заливка плашки к полу, не альфой */
  O.fadeFill = function (F, fade, base) {
    var a = base || F.tn.plate, b = F.tn.ground, k = 0.55 * fade;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  /* мобиль Калдера (общая раскладка): items = [{id, z(S) → {kind, w, h}, st:{flat}, lab?}] сверху вниз.
     Коромысла наклонены, плечи уравновешены по площади, качание гармониками одного периода;
     коромысло и нити — одна непрерывная кривая, узлы подвеса кольцами */
  var D2R = Math.PI / 180;
  var rot = O.rot = function (p, c, a) { var s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; };

  O.mobile = function (ctx, items, tsec) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), S = Math.min(W, H) * (W / H < 1.05 ? 1 : 1.08), n = items.length;
    var narrow = W / H < 1.05, gapK = (+P.gap || 22) / 22, still = ctx.reduced, flt = +P.float || 0;
    var size = function (s) { return s.z(S); };
    var area = function (s) { var z = size(s); return z.kind === 'circle' ? Math.PI * z.w * z.w / 4 : z.w * z.h; };
    var rest = []; for (var i = n - 1, acc = 0; i >= 0; i--) { acc += area(items[i]); rest[i] = acc; }
    var down = function (ang) { return [Math.sin(-ang), Math.cos(ang)]; };       // отвес, наклонённый качанием
    var els = [], wires = [], rings = [];
    // точка подвеса у потолка и первая нить: прямая под тяжестью
    var A = [W * (narrow ? 0.52 : 0.5), H * 0.2], side = -1, ang = 0;
    wires.push({ pts: [[A[0], -4], A], tone: 'ink2', a: 0.7, kind: 'thread' });
    for (var k = 0; k < n; k++) {
      var s = items[k], z = size(s), last = k === n - 1, st = s.st;
      var sw = O.swing(ctx.seed, 'arm' + k, tsec, P, (1.6 + k * 0.5) * D2R * flt, still ? 0 : 1);
      ang = sw;                                                     // каждый узел качается около своего отвеса
      rings.push(A);
      var half = z.kind === 'circle' ? z.w / 2 : z.h / 2;
      if (last) {                                                   // последний висит прямо на нити
        var d0 = down(ang * 0.6), top = [A[0] + d0[0] * S * 0.06, A[1] + d0[1] * S * 0.06];
        els.push({ step: s, z: z, x: top[0] + d0[0] * half, y: top[1] + d0[1] * half, rot: 0, st: st, half: half, top: top });
        wires.push({ pts: [A, top], tone: 'ink2', a: 0.7, kind: 'thread', el: els.length - 1 });
        break;
      }
      // коромысло: пологая дуга, плечи по равновесию (тяжёлое ближе к точке подвеса)
      var L = S * (0.38 - k * 0.04) * gapK, we = area(s), ws = rest[k + 1];
      var a = L * ws / (we + ws), b = L * we / (we + ws), t = a / (a + b);
      var tilt = side * 5 * D2R + ang * 0.6, ux = Math.cos(tilt), uy = Math.sin(tilt), vx = Math.sin(tilt), vy = -Math.cos(tilt);
      var h = S * 0.035, bump = 2 * t * (1 - t) * h;                // дуга выгнута вверх; точка подвеса лежит на дуге
      var base = [A[0] - vx * bump, A[1] - vy * bump];
      var eL = [base[0] + side * a * ux, base[1] + side * a * uy], eR = [base[0] - side * b * ux, base[1] - side * b * uy];
      var mid = [(eL[0] + eR[0]) / 2 + vx * h, (eL[1] + eR[1]) / 2 + vy * h];
      var arc = [eL, [(eL[0] + mid[0]) / 2 + vx * h * 0.25, (eL[1] + mid[1]) / 2 + vy * h * 0.25], mid, [(eR[0] + mid[0]) / 2 + vx * h * 0.25, (eR[1] + mid[1]) / 2 + vy * h * 0.25], eR];
      wires.push({ pts: arc, tone: 'ink', a: 0.85, kind: 'arm' });
      rings.push(eL, eR);                                           // петли на концах проволоки, как у Калдера
      // элемент на нити с левого конца: отвес вниз, длина по ритму
      var ew = O.swing(ctx.seed, 'el' + k, tsec, P, 3 * D2R * flt, still ? 0 : 1), d1 = down(ew);
      var drop = S * (0.08 + (k % 2) * 0.05), topE = [eL[0] + d1[0] * drop, eL[1] + d1[1] * drop];
      var tiltE = (side * (5 + (k % 3) * 1.5)) * D2R + ew * 1.2;    // лёгкий наклон листа ±4–8°
      els.push({ step: s, z: z, x: topE[0] + d1[0] * half, y: topE[1] + d1[1] * half, rot: z.kind === 'rect' ? tiltE : 0, st: st, half: half, top: topE });
      wires.push({ pts: [eL, topE], tone: 'ink2', a: 0.75, kind: 'thread', el: els.length - 1 });
      // с правого конца нить вниз к точке подвеса следующего коромысла
      var d2 = down(ang * 0.5), len = S * (0.12 + (k % 2) * 0.03);
      var nA = [eR[0] + d2[0] * len, eR[1] + d2[1] * len];
      wires.push({ pts: [eR, nA], tone: 'ink2', a: 0.75, kind: 'thread' });
      A = nA; side = -side;
    }
    return { els: els, wires: wires, rings: rings, S: S, ui: ui };
  };

  /* габарит в покое → масштаб и сдвиг (канон кинематики, закон 9): мобиль целиком в поле кадра */
  O.fitMobile = function (ctx, Lo, Lr) {
    var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    Lr.els.forEach(function (e) {
      var hw = e.z.w / 2 + (e.z.kind === 'circle' ? 0 : 0), hh = (e.z.h || e.z.w) / 2, lab = e.step.lab ? 150 * Lo.ui : 0;
      x0 = Math.min(x0, e.x - hw - (e.x < W / 2 ? lab : 0)); x1 = Math.max(x1, e.x + hw + (e.x >= W / 2 ? lab : 0));
      y0 = Math.min(y0, e.y - hh); y1 = Math.max(y1, e.y + hh);
    });
    Lr.rings.forEach(function (r) { y0 = Math.min(y0, r[1]); });
    var top = m + 70 * Lo.ui, bw = W - 2 * m, bh = H - top - m * 1.4;
    var k = Math.min(1, bw / (x1 - x0), bh / (y1 - y0)) * 0.94;            // запас на качание
    var dx = m + (bw - (x1 - x0) * k) / 2 - x0 * k, dy = top + (bh - (y1 - y0) * k) / 2 - y0 * k;
    var T = function (p) { return [p[0] * k + dx, p[1] * k + dy]; };
    Lo.els.forEach(function (e) { var q = T([e.x, e.y]); e.x = q[0]; e.y = q[1]; e.top = T(e.top); e.half *= k;
      e.z = { kind: e.z.kind, w: e.z.w * k, h: e.z.h ? e.z.h * k : undefined }; });
    Lo.wires.forEach(function (w) { w.pts = w.pts.map(T); });
    Lo.rings = Lo.rings.map(T);
    return Lo;
  };


  /* нить к элементу: от точки подвеса до верхней кромки по направлению на центр; у опавшего — провис */
  O.threadTo = function (a, cx, cy, half, flat, ui) {
    var dx = cx - a[0], dy = cy - a[1], L = Math.hypot(dx, dy) || 1, top = [cx - dx / L * half, cy - dy / L * half];
    if (!flat) return [a, top];
    return [a, [(a[0] + top[0]) / 2 + 12 * ui, (a[1] + top[1]) / 2 + 14 * ui], top];
  };

  O.label = function (g, F, x, y, title, sub, o) {
    o = o || {};
    var I = R.ink, al = o.alpha == null ? 1 : o.alpha, align = o.align || 'left';
    I.text(g, F, title, x, y, { s: o.s == null ? 1 : o.s, w: o.w || 500, align: align, alpha: al });
    if (sub) I.text(g, F, sub, x, y + (o.lh || 15 * F.ui), { s: o.ss == null ? 0 : o.ss, mono: true, tone: o.subTone || 'ink3', align: align, alpha: al });
  };
})();
