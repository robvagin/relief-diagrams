/* org.js · живой организм поверх рельса RELIEF (приказ 3): узлы висят и присоединены к центру,
   наведение поднимает узел с соседями и притушает остальное, перетаскивание тянет соседей на пружинах,
   клик = фокус, колесо = зум, протяжка по фону = панорама, параллакс за мышью тем сильнее, чем выше узел.
   Детерминизм (L11): в покое смещения, подъёмы и вид нулевые, кадр зависит только от сида и номера кадра;
   интеграция пружин идёт только пока есть взаимодействие (dt = 1/fps, полу-неявный Эйлер, ζ = 1).
   Когда общий модуль src/motion/graph.js появится в main, этот файл переезжает на него. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org = {};
  var V = O.state = { k: 1, px: 0, py: 0, mx: null, my: null, hover: null, drag: null, pan: null, focus: null,
    nodes: [], byId: {}, off: {}, lift: {}, W: 0, H: 0, moved: false, onFocus: null };
  var TAU = Math.PI * 2;

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
  /* стебель / нить / щупальце: печатная линия одной толщины (L7), рельеф под ней — вырезано в материале */
  O.stem = function (g, F, pts, o) {
    o = o || {};
    var a = o.alpha == null ? 0.75 : o.alpha, C = R.color;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    if (o.dash) g.setLineDash(o.dash);
    g.strokeStyle = C.css(F.T[o.tone || 'ink2'], a);
    g.beginPath(); O.curve(g, pts, o.t); g.stroke(); g.restore();
  };
  /* засечки на луче (Satellites): каждые step доли, короткие, полупрозрачные, по нормали к лучу */
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
    if (!env) return 0;
    var r = R.stream(seed, 'org/' + id), f1 = r() * TAU, f2 = r() * TAU, f3 = r() * TAU;
    var per = Math.max(1, +P.period || 36), w = TAU * (((tsec % per) + per) % per) / per;
    return amp * env * (0.62 * Math.sin(w + f1) + 0.28 * Math.sin(2 * w + f2) + 0.10 * Math.sin(3 * w + f3));
  };

  /* вид: мир → экран (зум вокруг центра кадра, панорама), плюс параллакс от высоты */
  O.toScreen = function (x, y, z) {
    var cx = V.W / 2, cy = V.H / 2, k = V.k;
    var sx = (x - cx) * k + cx + V.px, sy = (y - cy) * k + cy + V.py;
    if (V.mx != null && z) {
      var q = 0.55 * z / 28;                         // выше = сильнее сдвиг; z3 ≈ 0.55 % ширины на край
      sx += (V.mx - cx) / Math.max(1, cx) * q * 14; sy += (V.my - cy) / Math.max(1, cy) * q * 14;
    }
    return [sx, sy];
  };
  O.toWorld = function (sx, sy) {
    var cx = V.W / 2, cy = V.H / 2;
    return [(sx - cx - V.px) / V.k + cx, (sy - cy - V.py) / V.k + cy];
  };

  /* узлы кадра: [{id, x, y, r, nb:[id]}] в мировых координатах. Возвращает смещение и подъём каждого */
  O.frame = function (ctx, nodes) {
    V.W = ctx.W; V.H = ctx.H; V.nodes = nodes; V.byId = {};
    nodes.forEach(function (n) { V.byId[n.id] = n; });
    var fps = (R.motion.clock && R.motion.clock.fps) || 60, dt = 1 / fps, w = TAU / 0.5;
    var hovSet = {};
    if (V.hover && V.byId[V.hover]) { hovSet[V.hover] = 1; (V.byId[V.hover].nb || []).forEach(function (id) { hovSet[id] = 0.6; }); }
    var dragTarget = {};
    if (V.drag && V.byId[V.drag.id]) {
      var dn = V.byId[V.drag.id], wp = O.toWorld(V.drag.sx, V.drag.sy);
      var d = [wp[0] - V.drag.ox - dn.x, wp[1] - V.drag.oy - dn.y];
      dragTarget[dn.id] = [d[0], d[1], 1];
      (dn.nb || []).forEach(function (id) { if (!dragTarget[id]) dragTarget[id] = [d[0] * 0.45, d[1] * 0.45, 0]; });
      (dn.nb || []).forEach(function (id) {
        var n1 = V.byId[id]; (n1 && n1.nb || []).forEach(function (j) { if (!dragTarget[j]) dragTarget[j] = [d[0] * 0.16, d[1] * 0.16, 0]; });
      });
    }
    var live = false;
    nodes.forEach(function (n) {
      var o = V.off[n.id] || (V.off[n.id] = { x: 0, y: 0, vx: 0, vy: 0 }), tg = dragTarget[n.id];
      if (tg && tg[2]) { o.x = tg[0]; o.y = tg[1]; o.vx = 0; o.vy = 0; }
      else {
        var tx = tg ? tg[0] : 0, ty = tg ? tg[1] : 0;
        // критически демпфированная пружина к цели (соседи едут за перетаскиваемым и возвращаются)
        o.vx += (-w * w * (o.x - tx) - 2 * w * o.vx) * dt; o.vy += (-w * w * (o.y - ty) - 2 * w * o.vy) * dt;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (!tg && Math.abs(o.x) < 0.02 && Math.abs(o.y) < 0.02 && Math.abs(o.vx) < 0.05 && Math.abs(o.vy) < 0.05) { o.x = o.y = o.vx = o.vy = 0; }
      }
      var lt = hovSet[n.id] || 0, l = V.lift[n.id] || 0;
      l += (lt - l) * Math.min(1, dt * 9);
      if (Math.abs(l - lt) < 0.003) l = lt;
      V.lift[n.id] = l;
      if (o.x || o.y || l) live = true;
    });
    V.live = live || !!V.drag || !!V.hover;
    return { off: function (id) { return V.off[id] || { x: 0, y: 0 }; }, lift: function (id) { return V.lift[id] || 0; },
      dim: function (id) { return V.hover && !(id in hovSet) ? 0.4 : 1; }, focus: V.focus, k: V.k };
  };

  function hit(sx, sy) {
    var best = null, bd = 1e9;
    V.nodes.forEach(function (n) {
      var p = n.sx != null ? [n.sx, n.sy] : O.toScreen(n.x, n.y, 0), d = Math.hypot(sx - p[0], sy - p[1]);
      if (d < (n.r || 12) * V.k + 6 && d < bd) { bd = d; best = n; }
    });
    return best;
  }
  function redraw() { if (window.Scene && KIT.scene.ctx && KIT.scene.ctx.reduced) Scene.set('format', Scene.get('format')); }

  /* подключить указатель к холсту; onFocus(id) зовётся на клик по узлу */
  O.attach = function (canvas, onFocus) {
    if (O._attached) return; O._attached = true; V.onFocus = onFocus || null;
    function pos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    canvas.addEventListener('pointermove', function (e) {
      var p = pos(e); V.mx = p[0]; V.my = p[1];
      if (V.drag) { V.drag.sx = p[0]; V.drag.sy = p[1]; V.moved = true; }
      else if (V.pan) { V.px = V.pan.px + p[0] - V.pan.x; V.py = V.pan.py + p[1] - V.pan.y; V.moved = true; }
      else { var h = hit(p[0], p[1]); V.hover = h ? h.id : null; canvas.style.cursor = h ? 'grab' : 'default'; }
      redraw();
    });
    canvas.addEventListener('pointerleave', function () { V.mx = V.my = null; if (!V.drag) V.hover = null; redraw(); });
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e), h = hit(p[0], p[1]); V.moved = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { }
      if (h) {
        var s = h.sx != null ? O.toWorld(h.sx, h.sy) : [h.x, h.y], wp = O.toWorld(p[0], p[1]);
        V.drag = { id: h.id, sx: p[0], sy: p[1], ox: wp[0] - s[0] + (s[0] - h.x), oy: wp[1] - s[1] + (s[1] - h.y) };
        V.drag.ox = wp[0] - h.x - (V.off[h.id] ? V.off[h.id].x : 0); V.drag.oy = wp[1] - h.y - (V.off[h.id] ? V.off[h.id].y : 0);
        canvas.style.cursor = 'grabbing';
      } else V.pan = { x: p[0], y: p[1], px: V.px, py: V.py };
    });
    function up() {
      if (V.drag && !V.moved) { V.focus = V.focus === V.drag.id ? null : V.drag.id; if (V.onFocus) V.onFocus(V.focus); }
      if (V.pan && !V.moved) { V.focus = null; if (V.onFocus) V.onFocus(null); }
      V.drag = null; V.pan = null; canvas.style.cursor = 'default'; redraw();
    }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', function () { V.k = 1; V.px = V.py = 0; V.focus = null; redraw(); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pos(e), before = O.toWorld(p[0], p[1]);
      V.k = Math.max(0.6, Math.min(2.6, V.k * Math.exp(-e.deltaY * 0.0015)));
      var after = O.toScreen(before[0], before[1], 0);
      V.px += p[0] - after[0]; V.py += p[1] - after[1];
      redraw();
    }, { passive: false });
  };

  /* подпись на полу у диска: текст + моно-строка, выносится наружу от центра организма */
  O.label = function (g, F, x, y, title, sub, o) {
    o = o || {};
    var I = R.ink, al = o.alpha == null ? 1 : o.alpha, align = o.align || 'left';
    I.text(g, F, title, x, y, { s: o.s == null ? 1 : o.s, w: o.w || 500, align: align, alpha: al });
    if (sub) I.text(g, F, sub, x, y + 15 * F.ui * (o.s >= 2 ? 1.2 : 1), { s: 0, mono: true, tone: o.subTone || 'ink3', align: align, alpha: al });
  };
})();
