/* organism.js · живая часть вариантов horizon и agents (приказ владельца, волна 3).
   Физика, наведение, тяга узла, зум и панорама — общий модуль src/motion/graph.js (RELIEF.graph,
   из main); здесь адаптер к организмам (якорь = правило раскладки + ветер), параллакс по высоте
   и перо: лучи веером с засечками, дуги, щупальца, нити, провис бумаги, сходимость донора 04.
   Перо одно (L7), прямых углов нет. */
(function () {
  'use strict';
  var R = window.RELIEF, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash01(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // ── физика и взаимодействие: общий модуль src/motion/graph.js (RELIEF.graph) ─────────
  // Набор узлов у RELIEF.graph фиксирован при создании, поэтому адаптер пересоздаёт граф, когда
  // меняется состав (новое дерево, другой вид), а якоря (место раскладки + ветер организма)
  // обновляет каждый кадр. Указатель вешается один раз на прокси, который смотрит в текущий граф.
  function Sim() { this.byId = {}; this.nodes = []; this.G = null; this.sig = ''; this.cur = null; }
  Sim.prototype.reset = function () { this.G = null; this.sig = ''; this.byId = {}; this.nodes = []; };
  Sim.prototype.begin = function () { this.next = []; this.links = []; };
  Sim.prototype.node = function (id, o) {
    var n = this.byId[id] || (this.byId[id] = { id: id, x: o.x, y: o.y, lift: 0, fade: 0, nb: [] });
    n.ax = o.x; n.ay = o.y; n.r = o.r || 0; n.m = o.m || 1;
    this.next.push(n);
    return n;
  };
  Sim.prototype.link = function (a, b, len, k) { this.links.push([a, b, len, k]); };
  Sim.prototype.end = function () {
    var self = this, ids = this.next.map(function (n) { return n.id; }), sig = ids.join('|') + '#' + this.links.length;
    var idx = {}; ids.forEach(function (id, i) { idx[id] = i; });
    if (sig !== this.sig || !this.G) {
      var nodes = this.next.map(function (n) { return { id: n.id, x: n.ax, y: n.ay, r: n.r, mass: n.m }; });
      var edges = this.links.filter(function (l) { return idx[l[0]] != null && idx[l[1]] != null; })
        .map(function (l) { return { a: idx[l[0]], b: idx[l[1]], len: l[2], k: l[3] }; });
      var old = this.G;
      this.G = RELIEF.graph.create(nodes, edges, {});
      if (old) { this.G.view = old.view; this.G._viewed = true; this.G.mouse = old.mouse; }
      this.sig = sig;
      var keep = {}; ids.forEach(function (id) { keep[id] = 1; });
      Object.keys(this.byId).forEach(function (id) { if (!keep[id]) delete self.byId[id]; });
    } else {
      this.next.forEach(function (n, i) { var g = self.G.nodes[i]; g.x = n.ax; g.y = n.ay; g.r = n.r; });
    }
    this.nodes = this.next; this.ids = ids; this.idx = idx;
    var G = this.G;
    this.nodes.forEach(function (n, i) { n.nb = G.nb[i].map(function (j) { return self.nodes[j]; }); });
  };
  Sim.prototype.advance = function (ctx) {
    var G = this.G, W = ctx.W, H = ctx.H;
    G.fit = { s: 1, cx: W / 2, cy: H / 2 }; G.home = { zoom: 1, x: W / 2, y: H / 2 };
    if (!G._viewed) { G.view = { zoom: 1, x: W / 2, y: H / 2 }; G._viewed = true; }
    G.sync(ctx, { drift: 0, anchorK: 20, springK: 12, damp: 9, gap: 3 });
    this.nodes.forEach(function (n, i) { var st = G.state(i); n.x = st.x; n.y = st.y; n.lift = st.lift; n.fade = st.fade; });
  };
  Sim.prototype.zoom = function () { return this.G ? this.G.view.zoom : 1; };

  // мир → экран: камера графа + параллакс по высоте (выше = сильнее сдвиг)
  function toScreen(S, ctx, x, y, z) {
    var p = S.G ? S.G.toScreen(x, y) : [x, y], k = 0.9 * (z || 0) / 28 * 10;
    return [p[0] + (S.pmx || 0) * k, p[1] + (S.pmy || 0) * k];
  }
  function toWorld(S, ctx, sx, sy) { return S.G ? S.G.toWorld(sx, sy) : [sx, sy]; }
  // мышь приезжает к параллаксу сглаживанием по кадрам (без часов)
  function viewStep(S, ctx) {
    var m = S.G && S.G.mouse, tx = m ? clamp((m[0] / ctx.W - 0.5) * 2, -1, 1) : 0, ty = m ? clamp((m[1] / ctx.H - 0.5) * 2, -1, 1) : 0, a = ctx.reduced ? 1 : 0.12;
    S.pmx = (S.pmx || 0) + (tx - (S.pmx || 0)) * a; S.pmy = (S.pmy || 0) + (ty - (S.pmy || 0)) * a;
  }
  // указатель: RELIEF.graph.bind на прокси текущего графа; клик по узлу = фокус сцены (а не камеры),
  // клик по точке-займу (не узлу) = выбор следа
  function interact(ctx, o) {
    var S = o.sim, cv = ctx.canvas, last = {};
    var proxy = new Proxy({}, {
      get: function (t, k) {
        if (k === 'goFocus') return function (i) { var h = last[i]; if (h && o.onClick) o.onClick(h); };
        if (k === 'goHome') return function () { S.G.goHome(); if (o.onHome) o.onHome(); };
        var v = S.G[k]; return typeof v === 'function' ? v.bind(S.G) : v;
      },
      set: function (t, k, v) { S.G[k] = v; return true; }
    });
    function pickIndex(x, y) {
      var h = o.pick ? o.pick(x, y) : null;
      o.state.hover = h && h.id != null ? h.id : null;
      if (!h || h.id == null || S.idx[h.id] == null) return -1;
      var i = S.idx[h.id]; last[i] = h; return i;
    }
    function redraw() { if (ctx.reduced) window.postMessage({ type: 'es:progress', value: ctx.p }, '*'); }
    RELIEF.graph.bind(proxy, cv, pickIndex, redraw);
    cv.addEventListener('click', function (e) {
      var r = cv.getBoundingClientRect(), h = o.pick ? o.pick(e.clientX - r.left, e.clientY - r.top) : null;
      if (h && h.id == null && o.onClick) { o.onClick(h); redraw(); }
    });
  }
  // подъём наведением уже посчитан графом (lift, fade); здесь только общая доля притухания кадра
  function hoverStep(S, state, ctx) {
    var a = ctx.reduced ? 1 : 0.14, on = state.hover != null ? 1 : 0;
    state.dim = (state.dim || 0) + (on - (state.dim || 0)) * a;
  }
  function View() { return {}; }

  // ── перо: лучи с засечками, мягкие дуги, щупальца, нити ───────────────
  function css(c, a) { return R.color.css(c, a); }
  // прямой луч из хаба с зазором у узлов и засечками каждые 10 % длины (Satellites network)
  function ray(g, F, a, b, o) {
    o = o || {};
    var gap = 3 * F.ui, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    var s = (o.ra || 0) + gap, e = L - (o.rb || 0) - gap; if (e <= s) return;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round';
    g.strokeStyle = css(F.T[o.tone || 'ink'], o.alpha == null ? 0.5 : o.alpha);
    g.beginPath(); g.moveTo(a[0] + ux * s, a[1] + uy * s); g.lineTo(a[0] + ux * e, a[1] + uy * e); g.stroke();
    if (o.ticks) {
      var tl = 1.8 * F.ui, step = o.tickStep || 0.1;
      if (L < 70 * F.ui) step = 0.25;
      g.globalAlpha = 0.55;
      for (var k = step; k < 1 - 1e-6; k += step) {
        var d = L * k; if (d < s + 2 || d > e - 2) continue;
        var px = a[0] + ux * d, py = a[1] + uy * d;
        g.beginPath(); g.moveTo(px - uy * tl, py + ux * tl); g.lineTo(px + uy * tl, py - ux * tl); g.stroke();
      }
    }
    g.restore();
  }
  // гладкая кривая с натяжением (Catmull-Rom → Безье) через точки, одна толщина
  function spline(g, F, pts, o) {
    o = o || {};
    if (pts.length < 2) return;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = css(F.T[o.tone || 'ink'], o.alpha == null ? 0.5 : o.alpha);
    var t = o.tension == null ? 0.5 : o.tension;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3,
                      p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3, p2[0], p2[1]);
    }
    g.stroke(); g.restore();
  }
  // нить подвеса: провисает под своим весом (парабола), к листу приходит сверху
  function thread(g, F, a, b, sag, o) {
    o = o || {};
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + sag;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round';
    g.strokeStyle = css(F.T[o.tone || 'ink'], o.alpha == null ? 0.45 : o.alpha);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx, my, b[0], b[1]); g.stroke(); g.restore();
  }
  // мягкая дуга: квадратичная, кривизна c·длина в сторону side
  function arc(g, F, a, b, c, o) {
    o = o || {};
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    var mx = (a[0] + b[0]) / 2 - dy / L * c * L, my = (a[1] + b[1]) / 2 + dx / L * c * L;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round';
    g.strokeStyle = css(F.T[o.tone || 'ink'], o.alpha == null ? 0.45 : o.alpha);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx, my, b[0], b[1]); g.stroke(); g.restore();
  }
  // провис бумаги: едва заметный тон к середине листа и светлая полоса у кромки к свету
  function paper(g, F, p) {
    var w = p.w, h = p.h, x = -w / 2, y = -h / 2;
    g.save(); g.translate(p.x, p.y); if (p.rot) g.rotate(p.rot);
    var gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, css(F.tn.light, 0.18)); gr.addColorStop(0.45, css(F.T.ink, 0.018));
    gr.addColorStop(0.6, css(F.T.ink, 0.022)); gr.addColorStop(1, css(F.tn.light, 0.08));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.restore();
  }
  // сходимость донора 04: линии входят в собирающую дугу внутри узла монотонно по порядку источников
  function converge(g, F, srcs, hub, o) {
    o = o || {};
    var N = srcs.length, rc = hub[2] * 0.45, sorted = srcs.slice().sort(function (a, b) {
      return Math.atan2(a[1] - hub[1], a[0] - hub[0]) - Math.atan2(b[1] - hub[1], b[0] - hub[0]);
    });
    sorted.forEach(function (s, i) {
      var base = Math.atan2(s[1] - hub[1], s[0] - hub[0]);
      var a = base + (N > 1 ? ((i / (N - 1)) - 0.5) * 0.35 : 0);
      var p3 = [hub[0] + rc * Math.cos(a), hub[1] + rc * Math.sin(a)];
      var d = Math.hypot(p3[0] - s[0], p3[1] - s[1]), sh = d * 0.42;
      var ux = Math.cos(base), uy = Math.sin(base);
      g.save(); g.lineWidth = F.lineW; g.strokeStyle = css(F.T[o.tone || 'ink'], o.alpha == null ? 0.55 : o.alpha);
      g.beginPath(); g.moveTo(s[0], s[1]);
      g.bezierCurveTo(s[0] - ux * sh, s[1] - uy * sh, p3[0] + ux * sh, p3[1] + uy * sh, p3[0], p3[1]);
      g.stroke(); g.restore();
    });
  }

  R.org = { Sim: Sim, View: View, toScreen: toScreen, toWorld: toWorld, viewStep: viewStep, interact: interact,
    hoverStep: hoverStep, ray: ray, spline: spline, thread: thread, arc: arc, paper: paper, converge: converge,
    hash01: hash01, clamp: clamp, TAU: TAU };
})();
