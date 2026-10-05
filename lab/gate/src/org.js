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
    var p = [W * (narrow ? 0.52 : 0.5), H * 0.2], side = -1, ang = 0;
    var els = [], wires = [], rings = [];
    var ceil = [p[0] - S * 0.03, -4];
    var prevEnd = ceil;
    for (var k = 0; k < n; k++) {
      var s = items[k], z = size(s), last = k === n - 1, st = s.st;
      ang += O.swing(ctx.seed, 'arm' + k, tsec, P, (2 + k * 0.7) * D2R * flt, still ? 0 : 1);
      var ring = [p[0], p[1] - S * 0.035];
      rings.push(ring);
      // нить от предыдущего конца к кольцу этого коромысла: мягкий провис
      if (k === 0) wires.push({ pts: [prevEnd, [(prevEnd[0] + ring[0]) / 2 + side * S * 0.012, (prevEnd[1] + ring[1]) / 2], ring], tone: 'ink2', a: 0.7 });
      if (last) {
        var top = [p[0], p[1] + S * 0.06];
        var c = rot([p[0], top[1] + z.w / 2], ring, ang * 0.5);
        els.push({ step: s, z: z, x: c[0], y: c[1], rot: 0, st: st, half: z.w / 2, top: rot(top, ring, ang * 0.5) });
        wires.push({ pts: [ring, rot([p[0] + S * 0.01, p[1] + S * 0.02], ring, ang * 0.5), els[els.length - 1].top], tone: 'ink2', a: 0.7, dec: els.length - 1 });
        break;
      }
      var L = S * (0.36 - k * 0.04) * gapK, we = area(s), ws = rest[k + 1];
      var a = L * ws / (we + ws), b = L * we / (we + ws);           // тяжёлое ближе к оси (равновесие плеч)
      var tilt = side * 9 * D2R + ang;                              // коромысло наклонено, не горизонталь
      var endL = rot([p[0] + side * a, p[1]], p, tilt), endR = rot([p[0] - side * b, p[1]], p, tilt);
      var peak = rot([p[0], p[1] - S * 0.02], p, tilt);
      var drop = S * (0.09 + (k % 2) * 0.05), half = z.kind === 'circle' ? z.w / 2 : z.h / 2;
      var sw = O.swing(ctx.seed, 'el' + k, tsec, P, 4 * D2R * flt, still ? 0 : 1);
      var topE = [endL[0] + side * S * 0.01, endL[1] + drop];
      topE = rot(topE, endL, sw);
      var cE = rot([topE[0], topE[1] + half], endL, sw);
      var tiltE = (side * (5 + (k % 3) * 1.5)) * D2R + sw * 1.4;    // лёгкий наклон листа ±4–8°
      els.push({ step: s, z: z, x: cE[0], y: cE[1], rot: z.kind === 'rect' ? tiltE : 0, st: st, half: half, top: topE });
      // коромысло одной непрерывной кривой: нить листа ↗ конец ↗ гребень ↘ конец ↘ к следующему кольцу
      var nextP = rot([endR[0] - side * S * 0.02, endR[1] + S * (0.13 + (k % 2) * 0.03)], endR, ang * 0.5);
      // одна кривая без изломов: нить листа → конец → гребень → конец → нить к кольцу следующего коромысла
      var nr = [nextP[0], nextP[1] - S * 0.035];
      wires.push({ pts: [topE, [endL[0], endL[1] + drop * 0.35], endL, peak, endR, [(endR[0] + nr[0]) / 2 - side * S * 0.01, (endR[1] + nr[1]) / 2], nr], tone: 'ink', a: 0.85, el: els.length - 1 });
      prevEnd = endR;
      p = nextP; side = -side;
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
    var top = m + 70 * Lo.ui, bw = W - 2 * m, bh = H - top - m;
    var k = Math.min(1, bw / (x1 - x0), bh / (y1 - y0));
    var dx = m + (bw - (x1 - x0) * k) / 2 - x0 * k, dy = top + (bh - (y1 - y0) * k) / 2 - y0 * k;
    var T = function (p) { return [p[0] * k + dx, p[1] * k + dy]; };
    Lo.els.forEach(function (e) { var q = T([e.x, e.y]); e.x = q[0]; e.y = q[1]; e.top = T(e.top); e.half *= k;
      e.z = { kind: e.z.kind, w: e.z.w * k, h: e.z.h ? e.z.h * k : undefined }; });
    Lo.wires.forEach(function (w) { w.pts = w.pts.map(T); });
    Lo.rings = Lo.rings.map(T);
    return Lo;
  };


  O.label = function (g, F, x, y, title, sub, o) {
    o = o || {};
    var I = R.ink, al = o.alpha == null ? 1 : o.alpha, align = o.align || 'left';
    I.text(g, F, title, x, y, { s: o.s == null ? 1 : o.s, w: o.w || 500, align: align, alpha: al });
    if (sub) I.text(g, F, sub, x, y + (o.lh || 15 * F.ui), { s: o.ss == null ? 0 : o.ss, mono: true, tone: o.subTone || 'ink3', align: align, alpha: al });
  };
})();
