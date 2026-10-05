/* organism.js · живая часть вариантов horizon и agents (приказ владельца, волна 3).
   Узлы на пружинах как Obsidian graph view: каждый тянется к своему якорю (якорь рождает правило
   раскладки и ветер), связи держат длину, диски расталкиваются. Тянешь узел — соседи едут следом
   на пружинах; наведение поднимает узел с соседями, остальное притухает; колесо = зум, фон = панорама,
   мышь = параллакс (выше = сильнее сдвиг). Физика шагает ТОЛЬКО по номеру кадра (dt = 1/60 на кадр):
   кадр N одинаков при любом числе перерисовок (L11). Перо одно (L7), прямых углов нет: лучи веером,
   дуги, щупальца, нити. Когда в main появится src/motion/graph.js, этот файл уступает ему место. */
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

  // ── физика ───────────────────────────────────────────────────────────
  function Sim() { this.nodes = []; this.byId = {}; this.links = []; this.lastT = null; this.drag = null; }
  Sim.prototype.reset = function () { this.nodes = []; this.byId = {}; this.links = []; this.lastT = null; this.drag = null; };
  Sim.prototype.node = function (id, o) {
    var n = this.byId[id];
    if (!n) { n = this.byId[id] = { id: id, x: o.x, y: o.y, vx: 0, vy: 0, ax: o.x, ay: o.y, r: o.r || 0, ka: o.ka || 26, m: o.m || 1, lift: 0, nb: [] }; this.nodes.push(n); }
    n.alive = true;
    return n;
  };
  Sim.prototype.begin = function () { this.nodes.forEach(function (n) { n.alive = false; }); this.links = []; this.nodes.forEach(function (n) { n.nb = []; }); };
  Sim.prototype.end = function () {
    var self = this;
    this.nodes = this.nodes.filter(function (n) { if (!n.alive) delete self.byId[n.id]; return n.alive; });
  };
  Sim.prototype.link = function (a, b, len, k) {
    var A = this.byId[a], B = this.byId[b]; if (!A || !B) return;
    this.links.push({ a: A, b: B, len: len, k: k == null ? 14 : k }); A.nb.push(B); B.nb.push(A);
  };
  // один шаг 1/60 с: якорь, связи, расталкивание дисков, затухание (ζ ≈ 1, без отскока)
  Sim.prototype.step = function () {
    var dt = 1 / 60, ns = this.nodes, i, j;
    for (i = 0; i < ns.length; i++) { var n = ns[i]; n.fx = n.ka * (n.ax - n.x); n.fy = n.ka * (n.ay - n.y); }
    for (i = 0; i < this.links.length; i++) {
      var L = this.links[i], dx = L.b.x - L.a.x, dy = L.b.y - L.a.y, d = Math.hypot(dx, dy) || 1e-6, f = L.k * (d - L.len) / d;
      L.a.fx += f * dx; L.a.fy += f * dy; L.b.fx -= f * dx; L.b.fy -= f * dy;
    }
    for (i = 0; i < ns.length; i++) {
      if (!ns[i].r) continue;
      for (j = i + 1; j < ns.length; j++) {
        if (!ns[j].r) continue;
        var a = ns[i], b = ns[j], ex = b.x - a.x, ey = b.y - a.y, dd = Math.hypot(ex, ey) || 1e-6, need = a.r + b.r + 4;
        if (dd < need) { var p = 60 * (need - dd) / dd; a.fx -= p * ex; a.fy -= p * ey; b.fx += p * ex; b.fy += p * ey; }
      }
    }
    for (i = 0; i < ns.length; i++) {
      var q = ns[i];
      if (this.drag && this.drag.node === q) { q.x = this.drag.x; q.y = this.drag.y; q.vx = q.vy = 0; continue; }
      var damp = 2 * Math.sqrt(q.ka + 1);
      q.vx = (q.vx + q.fx / q.m * dt) * Math.exp(-damp * dt);
      q.vy = (q.vy + q.fy / q.m * dt) * Math.exp(-damp * dt);
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  };
  // шаги по приросту номера кадра; первый кадр, перемотка и покой = прямо на якоря
  Sim.prototype.advance = function (ctx) {
    var t = ctx.t || 0;
    if (ctx.reduced || this.lastT === null || t < this.lastT || t - this.lastT > 240) {
      this.nodes.forEach(function (n) { n.x = n.ax; n.y = n.ay; n.vx = n.vy = 0; });
      this.lastT = t; return;
    }
    var k = Math.min(8, t - this.lastT);
    for (var s = 0; s < k; s++) this.step();
    this.lastT = t;
  };

  // ── вид: зум, панорама, параллакс ────────────────────────────────────
  function View() { return { zoom: 1, px: 0, py: 0, mx: 0, my: 0, smx: 0, smy: 0 }; }
  function toScreen(V, ctx, x, y, z) {
    var cx = ctx.W / 2, cy = ctx.H / 2, k = 0.9 * (z || 0) / 28;   // z3 сдвигается на ≈ 0,9 px на единицу мыши × 10
    return [cx + (x - cx) * V.zoom + V.px + V.smx * k * 10, cy + (y - cy) * V.zoom + V.py + V.smy * k * 10];
  }
  function toWorld(V, ctx, sx, sy) {
    var cx = ctx.W / 2, cy = ctx.H / 2;
    return [cx + (sx - V.px - cx) / V.zoom, cy + (sy - V.py - cy) / V.zoom];
  }
  // мышь приезжает к параллаксу сглаживанием по кадрам (без часов)
  function viewStep(V, ctx) { var a = ctx.reduced ? 1 : 0.12; V.smx += (V.mx - V.smx) * a; V.smy += (V.my - V.smy) * a; }

  // ── взаимодействие: наведение, тяга узла, фон = панорама, колесо = зум, клик = фокус ──
  function interact(ctx, o) {
    var cv = ctx.canvas, V = o.view, S = o.sim, down = null, lastUp = -1e9;
    function local(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function redraw() { if (ctx.reduced || o.paused && o.paused()) window.postMessage({ type: 'es:progress', value: ctx.p }, '*'); }
    function pick(p) { return o.pick ? o.pick(p[0], p[1]) : null; }
    cv.addEventListener('pointermove', function (e) {
      var p = local(e);
      V.mx = clamp((p[0] / ctx.W - 0.5) * 2, -1, 1); V.my = clamp((p[1] / ctx.H - 0.5) * 2, -1, 1);
      if (down) {
        if (!down.moved && Math.hypot(p[0] - down.x, p[1] - down.y) < 4) return;
        down.moved = true;
        if (down.node && o.dragNode !== false) {
          var w = toWorld(V, ctx, p[0], p[1]);
          S.drag = { node: down.node, x: w[0] + down.ox, y: w[1] + down.oy };
        } else if (o.onPan) o.onPan(down, p);
        else { V.px = down.px + (p[0] - down.x); V.py = down.py + (p[1] - down.y); }
        redraw(); return;
      }
      var h = pick(p); var id = h ? h.id : null;
      if (id !== o.state.hover) { o.state.hover = id; redraw(); }
    });
    cv.addEventListener('pointerdown', function (e) {
      var p = local(e), h = pick(p), w = toWorld(V, ctx, p[0], p[1]);
      var n = h && S.byId[h.id];
      down = { x: p[0], y: p[1], px: V.px, py: V.py, node: n || null, ox: n ? n.x - w[0] : 0, oy: n ? n.y - w[1] : 0, hit: h, moved: false };
      if (o.onPanStart && !n) o.onPanStart(down, p);
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    });
    cv.addEventListener('pointerup', function (e) {
      var d = down; down = null; S.drag = null;
      if (!d) return;
      if (!d.moved) {
        if (d.hit && o.onClick) o.onClick(d.hit);
        else if (e.timeStamp - lastUp < 350) { V.zoom = 1; V.px = V.py = 0; if (o.onHome) o.onHome(); }
        lastUp = e.timeStamp;
      }
      redraw();
    });
    cv.addEventListener('pointerleave', function () { V.mx = V.my = 0; o.state.hover = null; redraw(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e), before = toWorld(V, ctx, p[0], p[1]);
      V.zoom = clamp(V.zoom * Math.exp(-e.deltaY * 0.0015), 0.6, 2.6);
      var after = toScreen({ zoom: V.zoom, px: V.px, py: V.py, smx: 0, smy: 0 }, ctx, before[0], before[1], 0);
      V.px += p[0] - after[0]; V.py += p[1] - after[1];
      redraw();
    }, { passive: false });
  }
  // подъём наведением: цель 1 у узла и соседей, сглаживание по кадрам; dim = доля притухания остальных
  function hoverStep(S, state, ctx) {
    var h = state.hover && S.byId[state.hover], set = {};
    if (h) { set[h.id] = 1; h.nb.forEach(function (n) { set[n.id] = 0.6; }); }
    var a = ctx.reduced ? 1 : 0.14;
    S.nodes.forEach(function (n) { n.lift += ((set[n.id] || 0) - n.lift) * a; });
    state.dim = (state.dim || 0) + ((h ? 1 : 0) - (state.dim || 0)) * a;
    return set;
  }

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
