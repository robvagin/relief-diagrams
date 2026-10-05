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
  O.label = function (g, F, x, y, title, sub, o) {
    o = o || {};
    var I = R.ink, al = o.alpha == null ? 1 : o.alpha, align = o.align || 'left';
    I.text(g, F, title, x, y, { s: o.s == null ? 1 : o.s, w: o.w || 500, align: align, alpha: al });
    if (sub) I.text(g, F, sub, x, y + (o.lh || 15 * F.ui), { s: o.ss == null ? 0 : o.ss, mono: true, tone: o.subTone || 'ink3', align: align, alpha: al });
  };
})();
