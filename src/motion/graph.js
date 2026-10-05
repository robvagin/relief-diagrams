/* motion/graph.js · живой граф как Obsidian graph view, общий модуль для сцен (приказ владельца 2026-10-05, закон 5).
   Узлы на силовой модели: якорь к месту раскладки (правило рождает композицию, L12), пружины по рёбрам,
   отталкивание по зазору между формами, демпфирование. Интегрируется СКОРОСТЬ (канон кинематики, закон 1),
   полу-неявный Эйлер, dt = 1/fpsNominal, один шаг на номер кадра: кадр N одинаков при любом числе
   перерисовок (детерминизм). Якорь дышит гармониками одного периода (цикл замкнут), огибающая плавания
   гасится у выбранного.
   Взаимодействие: тянешь узел — соседи едут за ним на пружинах; наведение поднимает узел с соседями,
   остальное притухает ЦВЕТОМ (не альфой: pseudo-3d-layers §2); клик = фокус (камера едет к узлу);
   колесо = зум к курсору; протяжка по пустому = панорама; двойной клик по пустому или Esc = домой.

   API:
     var G = RELIEF.graph.create(nodes, edges, opts)
       nodes: [{id, x, y (место раскладки), r (радиус столкновения), z, mass?, fixed?}]
       edges: [{a, b (индексы), k?, len? (по умолчанию дистанция раскладки)}]
     G.sync(ctx)               шаги физики до номера кадра ctx.t (и сброс при переигровке)
     G.view                    камера {zoom, x, y} в мировых координатах; G.toScreen / G.toWorld
     G.state(i)                {x, y, lift, fade, hot} узла i после физики и наведения
     RELIEF.graph.bind(G, canvas, pick)   указатель: pick(sx, sy) → индекс узла под курсором или -1
*/
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var TAU = Math.PI * 2;

  function create(nodes, edges, opts) {
    opts = opts || {};
    var n = nodes.length, P = new Float64Array(n * 2), V = new Float64Array(n * 2), A = new Float64Array(n * 2);
    var nb = []; for (var i = 0; i < n; i++) nb.push([]);
    edges.forEach(function (e) {
      if (e.len == null) e.len = Math.hypot(nodes[e.a].x - nodes[e.b].x, nodes[e.a].y - nodes[e.b].y);
      nb[e.a].push(e.b); nb[e.b].push(e.a);
    });
    var lift = new Float64Array(n), liftV = new Float64Array(n), fade = new Float64Array(n), fadeV = new Float64Array(n);
    var G = {
      nodes: nodes, edges: edges, nb: nb, n: n, P: P, V: V, t: -1, opts: opts,
      hover: -1, focus: -1, drag: -1, dragW: null,
      view: { zoom: 1, x: 0, y: 0 }, home: { zoom: 1, x: 0, y: 0 }, viewT: null,
      fit: { s: 1, ox: 0, oy: 0 }, version: 0
    };
    function reset() {
      for (var i = 0; i < n; i++) { P[2 * i] = nodes[i].x; P[2 * i + 1] = nodes[i].y; V[2 * i] = V[2 * i + 1] = 0; lift[i] = liftV[i] = fade[i] = fadeV[i] = 0; }
      G.t = -1;
    }
    reset();
    G.reset = reset;

    /* якорь узла с дыханием: три гармоники одного периода, фазы из потока рельса по id */
    function anchor(i, ts, prm) {
      var nd = nodes[i], amp = (prm.drift == null ? 1 : prm.drift) * (nd.drift == null ? 1 : nd.drift);
      if (!(amp > 0) || i === G.focus) return [nd.x, nd.y];
      var ph = R.motion.phases(prm.seed, 'g/' + nd.id), per = Math.max(4, prm.period || 36), w = TAU * ((ts % per) / per);
      var a = amp * (prm.amp == null ? 3 : prm.amp);
      return [nd.x + a * (0.62 * Math.sin(w + ph[0]) + 0.28 * Math.sin(2 * w + ph[1]) + 0.10 * Math.sin(3 * w + ph[2])),
              nd.y + a * (0.62 * Math.sin(w + ph[3]) + 0.28 * Math.sin(2 * w + ph[4]) + 0.10 * Math.sin(3 * w + ph[5]))];
    }

    /* критически демпфированная пружина значения (наведение, притухание): скорость, не позиция */
    function spring(x, v, target, dt, omega) {
      var a = omega * omega * (target - x) - 2 * omega * v;
      v += a * dt; x += v * dt;
      return [x, v];
    }

    function step(ts, dt, prm) {
      var ka = prm.anchorK == null ? 18 : prm.anchorK, ke = prm.springK == null ? 30 : prm.springK;
      var rep = prm.repel == null ? 1 : prm.repel, damp = prm.damp == null ? 9 : prm.damp, gap = prm.gap == null ? 3 : prm.gap;
      A.fill(0);
      for (var i = 0; i < n; i++) {
        var t = anchor(i, ts, prm);
        A[2 * i] += ka * (t[0] - P[2 * i]); A[2 * i + 1] += ka * (t[1] - P[2 * i + 1]);
      }
      for (var k = 0; k < edges.length; k++) {
        var e = edges[k], ax = P[2 * e.a], ay = P[2 * e.a + 1], bx = P[2 * e.b], by = P[2 * e.b + 1];
        var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6, f = (e.k == null ? ke : e.k) * (d - e.len) / d;
        A[2 * e.a] += f * dx; A[2 * e.a + 1] += f * dy; A[2 * e.b] -= f * dx; A[2 * e.b + 1] -= f * dy;
      }
      // отталкивание только у перекрытия форм + зазор: семья держит воздух, дальнее не толкается
      if (rep > 0) for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) {
        var ddx = P[2 * q] - P[2 * p], ddy = P[2 * q + 1] - P[2 * p + 1], lim = nodes[p].r + nodes[q].r + gap;
        if (ddx > lim || ddx < -lim || ddy > lim || ddy < -lim) continue;
        var dd = Math.hypot(ddx, ddy) || 1e-3;
        if (dd >= lim) continue;
        var push = rep * 220 * (lim - dd) / dd, wp = 1 / (nodes[p].mass || 1), wq = 1 / (nodes[q].mass || 1);
        A[2 * p] -= push * ddx * wp; A[2 * p + 1] -= push * ddy * wp; A[2 * q] += push * ddx * wq; A[2 * q + 1] += push * ddy * wq;
      }
      for (var j = 0; j < n; j++) {
        if (j === G.drag && G.dragW) { V[2 * j] = (G.dragW[0] - P[2 * j]) / dt; V[2 * j + 1] = (G.dragW[1] - P[2 * j + 1]) / dt; P[2 * j] = G.dragW[0]; P[2 * j + 1] = G.dragW[1]; continue; }
        if (nodes[j].fixed) { P[2 * j] = nodes[j].x; P[2 * j + 1] = nodes[j].y; continue; }
        var m = nodes[j].mass || 1;
        V[2 * j] += (A[2 * j] / m - damp * V[2 * j]) * dt; V[2 * j + 1] += (A[2 * j + 1] / m - damp * V[2 * j + 1]) * dt;
        P[2 * j] += V[2 * j] * dt; P[2 * j + 1] += V[2 * j + 1] * dt;
      }
      // наведение и фокус: подъём узла с соседями, притухание остальных — пружинами ζ = 1, ω = 2π/0,5 с
      var hot = G.hover >= 0 ? G.hover : G.focus, om = TAU / 0.5, set = hot >= 0 ? hotSet(hot) : null;
      for (var h = 0; h < n; h++) {
        var lt = set ? (h === hot ? 1 : set[h] ? 0.55 : 0) : 0, ft = set ? (set[h] ? 0 : 1) : 0;
        var s1 = spring(lift[h], liftV[h], lt, dt, om); lift[h] = s1[0]; liftV[h] = s1[1];
        var s2 = spring(fade[h], fadeV[h], ft, dt, om); fade[h] = s2[0]; fadeV[h] = s2[1];
      }
      // камера едет к цели той же пружиной
      if (G.viewT) {
        ['zoom', 'x', 'y'].forEach(function (k2) {
          var key = '_v' + k2, s3 = spring(G.view[k2], G[key] || 0, G.viewT[k2], dt, TAU / 0.72);
          G.view[k2] = s3[0]; G[key] = s3[1];
        });
      }
    }

    var hotCache = { i: -2, set: null };
    function hotSet(i) {
      if (hotCache.i === i) return hotCache.set;
      var s = {}; s[i] = 1; nb[i].forEach(function (j) { s[j] = 1; });
      hotCache = { i: i, set: s };
      return s;
    }
    G.hotSet = hotSet;

    /* шаги до номера кадра: один шаг на кадр, переигровка (t назад) сбрасывает мир */
    G.sync = function (ctx, prm) {
      var fps = R.motion.clock.fps || 60, dt = 1 / fps, target = ctx.t || 0;
      prm = Object.assign({ seed: ctx.seed }, prm || {});
      if (ctx.reduced) {                         // покой: мир осевший, без дыхания, кадр финальный
        if (G.t !== 'still') { reset(); prm.drift = 0; for (var s = 0; s < 360; s++) step(0, dt, prm); G.t = 'still'; }
        return;
      }
      if (G.t === 'still' || target < G.t) reset();
      var guard = 0;
      while (G.t < target && guard++ < 600) { G.t++; step(G.t / fps, dt, prm); }
      if (G.t < target) G.t = target;            // догон после долгой паузы вкладки не молотит тысячи шагов
    };

    G.state = function (i) { return { x: P[2 * i], y: P[2 * i + 1], lift: lift[i], fade: Math.max(0, Math.min(1, fade[i])) }; };
    G.toScreen = function (x, y) { var f = G.fit, v = G.view; return [(x - v.x) * f.s * v.zoom + f.cx, (y - v.y) * f.s * v.zoom + f.cy]; };
    G.toWorld = function (sx, sy) { var f = G.fit, v = G.view; return [(sx - f.cx) / (f.s * v.zoom) + v.x, (sy - f.cy) / (f.s * v.zoom) + v.y]; };
    G.scale = function () { return G.fit.s * G.view.zoom; };
    /* вписать мир (bbox) в кадр с полями 6 % */
    /* pad = {top, bottom, left, right} в px сверх полей 6 %: место под шапку и легенду сцены */
    G.fitTo = function (W, H, bbox, pad) {
      pad = pad || {}; var m = Math.min(W, H) * 0.06, t = m + (pad.top || 0), b = m + (pad.bottom || 0), l = m + (pad.left || 0), r = m + (pad.right || 0);
      var s = Math.min((W - l - r) / (bbox[2] - bbox[0]), (H - t - b) / (bbox[3] - bbox[1]));
      G.fit = { s: s, cx: l + (W - l - r) / 2, cy: t + (H - t - b) / 2 };
      G.home = { zoom: 1, x: (bbox[0] + bbox[2]) / 2, y: (bbox[1] + bbox[3]) / 2 };
      if (!G.viewT && !G._viewed) { G.view = Object.assign({}, G.home); G._viewed = true; }
    };
    G.goHome = function () { G.focus = -1; G.viewT = Object.assign({}, G.home); };
    G.goFocus = function (i, zoom) {
      G.focus = i; var st = G.state(i);
      G.viewT = { zoom: zoom || 1.7, x: st.x, y: st.y };
    };
    return G;
  }

  /* указатель: наведение, перетаскивание узла, панорама, колесо, клик-фокус, двойной клик и Esc = домой */
  function bind(G, canvas, pick, onChange) {
    var down = null, ch = onChange || function () {};
    function local(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointermove', function (e) {
      var p = local(e);
      G.mouse = p;
      if (down) {
        var dx = p[0] - down.p[0], dy = p[1] - down.p[1];
        if (!down.moved && Math.hypot(dx, dy) > 3) down.moved = true;
        if (down.node >= 0 && down.moved) { G.drag = down.node; G.dragW = G.toWorld(p[0], p[1]); }
        else if (down.node < 0 && down.moved) {
          var s = G.scale(); G.viewT = null;
          G.view.x = down.view.x - dx / s; G.view.y = down.view.y - dy / s;
        }
        ch(); return;
      }
      var h = pick(p[0], p[1]);
      if (h !== G.hover) { G.hover = h; canvas.style.cursor = h >= 0 ? 'grab' : 'default'; ch(); }
    });
    canvas.addEventListener('pointerleave', function () { if (!down) { G.hover = -1; G.mouse = null; ch(); } });
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var p = local(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { }
      down = { p: p, node: pick(p[0], p[1]), moved: false, view: Object.assign({}, G.view) };
      if (down.node >= 0) canvas.style.cursor = 'grabbing';
    });
    function up(e) {
      if (!down) return;
      var d = down; down = null;
      G.drag = -1; G.dragW = null;
      canvas.style.cursor = G.hover >= 0 ? 'grab' : 'default';
      if (!d.moved) { if (d.node >= 0) G.goFocus(d.node); }
      ch();
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', function (e) { var p = local(e); if (pick(p[0], p[1]) < 0) { G.goHome(); ch(); } });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e), before = G.toWorld(p[0], p[1]);
      var z = Math.max(0.5, Math.min(4, (G.viewT ? G.viewT.zoom : G.view.zoom) * Math.exp(-e.deltaY * 0.0015)));
      G.viewT = null; G.view.zoom = z;
      var after = G.toWorld(p[0], p[1]);                     // зум к курсору: точка под курсором стоит
      G.view.x += before[0] - after[0]; G.view.y += before[1] - after[1];
      ch();
    }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { G.goHome(); ch(); }
    });
  }

  R.graph = { create: create, bind: bind };
})();
