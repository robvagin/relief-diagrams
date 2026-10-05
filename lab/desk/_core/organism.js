// organism.js — живой организм из бумажных листов и дисков на рельсе src/ (R.frame: свет, тени по
// приёмникам, кант, зерно приняты владельцем). Сцена отдаёт ПОЗУ: узлы (лист, диск, пилюля) и связи
// (стебель, нить, щупальце) как функцию времени; движок кладёт сверху живое поведение графа:
//  · перетаскивание узла, соседи едут за ним на пружинах (смещения диффундируют по рёбрам и гаснут);
//  · наведение поднимает узел и соседей, остальное притухает; клик = фокус (камера едет пружиной);
//  · колесо = зум у курсора, протяжка по фону = панорама, двойной клик по фону = домой;
//  · параллакс за мышью: выше лист — сильнее сдвиг. Тень длиннее и мягче с высотой — рельс.
// Законы формы: в плашках нет ни дырок, ни окон, ни вырезов; связи — мягкие кривые одной толщины,
// ни одного угла 90°. Движение позы задаёт сцена гармониками одного периода (цикл замкнут);
// пружины взаимодействия — критически задемпфированы и гаснут в ноль без ввода (детерминизм кадра).
(function () {
  'use strict';
  var R = window.RELIEF, K = window.RINK, TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var S = {
    off: {}, lift: {}, cam: { z: 1, x: 0, y: 0, tz: 1, tx: 0, ty: 0 },
    hover: null, drag: null, pan: null, ptr: null, focus: null, last: [], byId: {}, nb: {}, moved: false
  };

  // соседи по рёбрам (для пружин и подсветки)
  function neighbours(links) {
    var nb = {};
    links.forEach(function (l) {
      if (typeof l.a !== 'string' || typeof l.b !== 'string') return;
      (nb[l.a] = nb[l.a] || []).push(l.b); (nb[l.b] = nb[l.b] || []).push(l.a);
    });
    return nb;
  }

  // экран ↔ мир: камера масштабирует вокруг центра кадра и сдвигает панорамой
  function toScreen(F, x, y) { var c = S.cam; return [(x - F.W / 2) * c.z + F.W / 2 + c.x, (y - F.H / 2) * c.z + F.H / 2 + c.y]; }
  function toWorld(F, x, y) { var c = S.cam; return [(x - F.W / 2 - c.x) / c.z + F.W / 2, (y - F.H / 2 - c.y) / c.z + F.H / 2]; }

  // шаг пружин взаимодействия (полу-неявный Эйлер, dt = 1/fpsNominal); без ввода всё стоит в нуле
  function stepSprings(F, nodes, P) {
    var dt = 1 / (R.motion.clock.fps || 60), ks = 26 * (+P.springs || 1), k0 = 7, ids = Object.keys(S.off);
    var dragId = S.drag && S.drag.id;
    if (dragId) {
      var n = S.byId[dragId];
      if (n) { var w = toWorld(F, S.ptr.x, S.ptr.y); S.off[dragId] = { x: w[0] - S.drag.dx - n.x0, y: w[1] - S.drag.dy - n.y0, vx: 0, vy: 0 }; }
      (S.nb[dragId] || []).forEach(function (j) { if (!S.off[j]) S.off[j] = { x: 0, y: 0, vx: 0, vy: 0 }; });
    }
    ids = Object.keys(S.off);
    var acc = {};
    ids.forEach(function (i) {
      if (i === dragId) return;
      var o = S.off[i], ax = -k0 * o.x, ay = -k0 * o.y, nb = S.nb[i] || [];
      nb.forEach(function (j) {
        var q = S.off[j] || { x: 0, y: 0 };
        ax += ks * (q.x - o.x); ay += ks * (q.y - o.y);
        if (!S.off[j] && (Math.abs(o.x) + Math.abs(o.y)) > 0.5) S.off[j] = { x: 0, y: 0, vx: 0, vy: 0 };
      });
      var c = 2 * Math.sqrt(k0 + ks * Math.max(1, nb.length)) * 0.85;
      acc[i] = [ax - c * o.vx, ay - c * o.vy];
    });
    Object.keys(acc).forEach(function (i) {
      var o = S.off[i];
      o.vx += acc[i][0] * dt; o.vy += acc[i][1] * dt; o.x += o.vx * dt; o.y += o.vy * dt;
      if (Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.vx) + Math.abs(o.vy) < 0.02) delete S.off[i];
    });
  }
  // камера и подъём: критически задемпфированные пружины на кадр
  function approach(cur, tgt, rate) { return cur + (tgt - cur) * rate; }

  function hitTest(px, py) {
    for (var i = S.last.length - 1; i >= 0; i--) {
      var n = S.last[i];
      if (n.hit === false) continue;
      var dx = px - n.sx, dy = py - n.sy, c = Math.cos(-n.srot), s = Math.sin(-n.srot);
      var lx = c * dx - s * dy, ly = s * dx + c * dy;
      if (n.shape === 'disc' ? Math.hypot(lx, ly) <= n.sw / 2 + 4 : Math.abs(lx) <= n.sw / 2 + 3 && Math.abs(ly) <= n.sh / 2 + 3) return n.id;
    }
    return null;
  }

  function bind(ctx) {
    var cv = ctx.canvas, F = function () { return { W: ctx.W, H: ctx.H }; };
    var redraw = function () { if (ctx.reduced) window.dispatchEvent(new Event('resize')); };
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointermove', function (e) {
      S.ptr = pos(e);
      if (S.drag) { if (Math.hypot(S.ptr.x - S.drag.sx, S.ptr.y - S.drag.sy) > 3) S.moved = true; }
      else if (S.pan) {
        S.cam.tx = S.cam.x = S.pan.cx + (S.ptr.x - S.pan.sx); S.cam.ty = S.cam.y = S.pan.cy + (S.ptr.y - S.pan.sy);
        if (Math.hypot(S.ptr.x - S.pan.sx, S.ptr.y - S.pan.sy) > 3) S.moved = true;
      } else S.hover = hitTest(S.ptr.x, S.ptr.y);
      cv.style.cursor = S.drag || S.pan ? 'grabbing' : S.hover ? 'grab' : 'default';
      redraw();
    });
    cv.addEventListener('pointerleave', function () { if (!S.drag && !S.pan) { S.hover = null; S.ptr = null; redraw(); } });
    cv.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var p = pos(e), id = hitTest(p.x, p.y); S.ptr = p; S.moved = false;
      try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      if (id) {
        var n = S.byId[id], w = toWorld(F(), p.x, p.y), o = S.off[id] || { x: 0, y: 0 };
        S.drag = { id: id, sx: p.x, sy: p.y, dx: w[0] - (n.x0 + o.x), dy: w[1] - (n.y0 + o.y) };
      } else S.pan = { sx: p.x, sy: p.y, cx: S.cam.x, cy: S.cam.y };
    });
    function up() {
      if (S.drag && !S.moved) {
        // клик по узлу = фокус: камера ведёт узел в центр и приближает
        var n = S.byId[S.drag.id];
        if (n) {
          if (S.focus === n.id) { S.focus = null; S.cam.tz = 1; S.cam.tx = 0; S.cam.ty = 0; }
          else { S.focus = n.id; S.cam.tz = Math.max(S.cam.z, 1.3); S.cam.tx = -(n.x0 - ctx.W / 2) * S.cam.tz; S.cam.ty = -(n.y0 - ctx.H / 2) * S.cam.tz; }
        }
      }
      S.drag = null; S.pan = null; redraw();
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', function (e) {
      var p = pos(e);
      if (!hitTest(p.x, p.y)) { S.focus = null; S.cam.tz = 1; S.cam.tx = 0; S.cam.ty = 0; redraw(); }
    });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pos(e), z0 = S.cam.tz, z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0015), 0.6, 2.6);
      // зум у курсора: точка под курсором остаётся на месте
      var wx = (p.x - ctx.W / 2 - S.cam.tx) / z0, wy = (p.y - ctx.H / 2 - S.cam.ty) / z0;
      S.cam.tz = z1; S.cam.tx = p.x - ctx.W / 2 - wx * z1; S.cam.ty = p.y - ctx.H / 2 - wy * z1;
      redraw();
    }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === '0') { S.focus = null; S.cam.tz = 1; S.cam.tx = 0; S.cam.ty = 0; redraw(); }
    });
  }

  // провис бумаги: лист чуть прогнут, сторона к свету светлее, дальняя темнее (матово, без блика)
  function sag(g, F, w, h, amt, rot) {
    if (!(amt > 0)) return;
    var l = F.L.l, n = Math.hypot(l[0], l[1]) || 1, c = Math.cos(-rot || 0), s = Math.sin(-rot || 0);
    var lx = (c * l[0] - s * l[1]) / n, ly = (s * l[0] + c * l[1]) / n, ext = Math.abs(lx) * w / 2 + Math.abs(ly) * h / 2;
    var gr = g.createLinearGradient(lx * ext, ly * ext, -lx * ext, -ly * ext), C = R.color;
    gr.addColorStop(0, C.css(F.tn.light, 0.10 * amt));
    gr.addColorStop(0.45, C.css(F.tn.light, 0));
    gr.addColorStop(0.62, C.css(F.tn.shadow, 0.035 * amt));
    gr.addColorStop(1, C.css(F.tn.shadow, 0.012 * amt));
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
  }

  // ── кадр ───────────────────────────────────────────────────────────────
  function draw(ctx, scene) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), t = R.motion.time(ctx);
    var F0 = { W: W, H: H, ui: ui, u: Math.min(W, H) / 48, m: 0.06 * Math.min(W, H), P: P, t: t, reduced: !!ctx.reduced };
    var pose = scene.pose(ctx, F0, t);
    var nodes = pose.nodes, links = pose.links || [];
    S.byId = {}; nodes.forEach(function (n) { n.x0 = n.x; n.y0 = n.y; S.byId[n.id] = n; });
    S.nb = neighbours(links);
    stepSprings(F0, nodes, P);
    var c = S.cam; c.z = approach(c.z, c.tz, 0.16); c.x = approach(c.x, c.tx, 0.16); c.y = approach(c.y, c.ty, 0.16);
    if (Math.abs(c.z - c.tz) < 1e-4) c.z = c.tz;
    var hl = {}, hv = S.drag ? S.drag.id : S.hover;
    if (hv) { hl[hv] = 1; (S.nb[hv] || []).forEach(function (j) { hl[j] = 0.5; }); }
    var anyHl = !!hv;
    // параллакс: смещение за указателем ∝ высоте узла
    var mx = 0, my = 0;
    if (S.ptr && !ctx.capture) { mx = clamp((S.ptr.x - W / 2) / (W / 2), -1, 1); my = clamp((S.ptr.y - H / 2) / (H / 2), -1, 1); }
    var par = (+P.parallax || 0) * ui;
    var depth = {};
    // порядок сборки: от корня по рёбрам (корень первым)
    var root = pose.root || (nodes[0] && nodes[0].id), q = [root], seen = {}; if (root) seen[root] = 1; var ord = 0;
    while (q.length) { var id = q.shift(); depth[id] = ord++; (S.nb[id] || []).forEach(function (j) { if (!seen[j]) { seen[j] = 1; q.push(j); } }); }
    var plates = [], scr = [];
    nodes.forEach(function (n) {
      var o = S.off[n.id] || { x: 0, y: 0 };
      var lt = S.lift[n.id] || 0, tl = hl[n.id] || 0;
      lt = approach(lt, tl, 0.2); if (Math.abs(lt - tl) < 1e-3) lt = tl;
      if (lt) S.lift[n.id] = lt; else delete S.lift[n.id];
      var zl = R.zh(n.z, P, ui) * (n.zk || 1) + lt * R.zh(1, P, ui) * 1.5;
      var wx = n.x + o.x, wy = n.y + o.y, sp = toScreen(F0, wx, wy);
      sp[0] += mx * par * zl * 0.35; sp[1] += my * par * zl * 0.35;
      n.wx = wx; n.wy = wy;
      var sw = n.w * c.z, sh = n.h * c.z;
      var dim = anyHl && !hl[n.id] ? 0.32 : 1;
      var nn = { id: n.id, shape: n.shape, sx: sp[0], sy: sp[1], sw: sw, sh: sh, srot: n.rot || 0, hit: n.hit, node: n, dim: dim };
      scr.push(nn);
      if (n.ghost) return;
      plates.push({
        id: n.id, kind: n.shape === 'disc' ? 'circle' : 'rect', x: sp[0], y: sp[1], w: sw, h: n.shape === 'disc' ? sw : sh,
        r: n.shape === 'pill' ? Math.min(sw, sh) / 2 : n.shape === 'disc' ? 0 : (+P.radius || 0) * ui * c.z,
        z: zl * Math.sqrt(c.z), rot: n.rot || 0, env: n.env == null ? 1 : n.env, assembleIndex: depth[n.id] == null ? 0 : depth[n.id],
        fill: n.fill, _n: nn
      });
    });
    S.last = scr.slice().sort(function (a, b) { return a.node.z - b.node.z; });
    var byScr = {}; scr.forEach(function (s) { byScr[s.id] = s; });
    var F = R.frame(ctx, {
      plates: plates,
      floor: function (g, Fr) {
        Fr.I = K.inks(Fr); Fr.zoom = c.z;
        g.save();
        g.translate(W / 2 + c.x, H / 2 + c.y); g.scale(c.z, c.z); g.translate(-W / 2, -H / 2);
        if (pose.floor) pose.floor(g, Fr, F0);
        g.restore();
        // связи: мягкие кривые одной толщины от центра к узлам (концы следуют за узлами и пружинами)
        links.forEach(function (l) { drawLink(g, Fr, l, byScr, anyHl, hl, P); });
        if (pose.floorTop) pose.floorTop(g, Fr, F0, byScr);
      },
      print: function (g, s, Fr) {
        var nn = s.src && s.src._n; if (!nn || !nn.node.print) return;
        g.save();
        g.translate(s.x, s.y); g.rotate(s.rot || 0); g.scale(c.z, c.z);
        var n = nn.node;
        if (n.shape !== 'disc') sag(g, Fr, n.w, n.h, +P.sag, s.rot);
        g.globalAlpha = nn.dim;
        n.print(g, Fr, Fr.I || K.inks(Fr), n.w, n.h, n);
        g.restore();
      },
      above: function (g, Fr) {
        // кольцо фокуса акцентом (слой взаимодействия §7.3 п.7)
        var f = S.focus && byScr[S.focus];
        if (f) {
          g.save(); g.strokeStyle = R.color.css(Fr.T.accent, 0.9); g.lineWidth = Fr.lineW;
          g.beginPath();
          if (f.shape === 'disc') g.arc(f.sx, f.sy, f.sw / 2 + 6 * ui, 0, TAU);
          else { g.translate(f.sx, f.sy); g.rotate(f.srot); if (g.roundRect) g.roundRect(-f.sw / 2 - 6 * ui, -f.sh / 2 - 6 * ui, f.sw + 12 * ui, f.sh + 12 * ui, 10 * ui); }
          g.stroke(); g.restore();
        }
        if (pose.above) pose.above(g, Fr, F0, byScr, hv);
        if (hv && byScr[hv] && byScr[hv].node.info) tip(g, Fr, byScr[hv]);
      }
    });
    window.__ORG = { nodes: nodes.length, links: links.length, hover: hv, focus: S.focus, zoom: c.z };
    return F;
  }

  // связь: кривая с натяжением; стебель вырезан рельефом, нить и щупальце напечатаны чернилами
  function drawLink(g, F, l, byScr, anyHl, hl, P) {
    var a = typeof l.a === 'string' ? byScr[l.a] : null, b = typeof l.b === 'string' ? byScr[l.b] : null;
    var pa = a ? [a.sx, a.sy] : l.a && l.a.x != null ? toScreen(F, l.a.x, l.a.y) : null;
    var pb = b ? [b.sx, b.sy] : l.b && l.b.x != null ? toScreen(F, l.b.x, l.b.y) : null;
    if (!pa || !pb) return;
    var al = anyHl ? (hl[l.a] && hl[l.b] ? 1 : 0.28) : 1;
    var d = [pb[0] - pa[0], pb[1] - pa[1]], len = Math.hypot(d[0], d[1]) || 1, u = [d[0] / len, d[1] / len];
    var ta = l.ta || u, tb = l.tb || u, ten = +P.tension;
    var path = function (gg, ox, oy) { K.curve(gg, [pa[0] + (ox || 0), pa[1] + (oy || 0)], [pb[0] + (ox || 0), pb[1] + (oy || 0)], ta, tb, ten); };
    if (l.kind === 'stem') K.relief(g, F, path, al * (l.alpha == null ? 1 : l.alpha));
    else K.stroke(g, F, path, F.I.ink2, al * (l.alpha == null ? 0.55 : l.alpha));
    // засечки на луче (Satellites): короткие штрихи поперёк по долям длины
    if (l.ticks) {
      g.save(); g.strokeStyle = F.I.ink3; g.globalAlpha = 0.5 * al; g.lineWidth = F.lineW;
      l.ticks.forEach(function (f) {
        var p = bez(pa, pb, ta, tb, ten, f), n = [-p.t[1], p.t[0]], s = 3 * F.ui;
        g.beginPath(); g.moveTo(p.p[0] - n[0] * s, p.p[1] - n[1] * s); g.lineTo(p.p[0] + n[0] * s, p.p[1] + n[1] * s); g.stroke();
      });
      g.restore();
    }
  }
  function bez(a, b, ta, tb, ten, f) {
    var d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = d * (0.25 + 0.3 * (1 - (ten == null ? 0.5 : ten)));
    var p1 = [a[0] + ta[0] * k, a[1] + ta[1] * k], p2 = [b[0] - tb[0] * k, b[1] - tb[1] * k], m = 1 - f;
    var p = [m * m * m * a[0] + 3 * m * m * f * p1[0] + 3 * m * f * f * p2[0] + f * f * f * b[0],
             m * m * m * a[1] + 3 * m * m * f * p1[1] + 3 * m * f * f * p2[1] + f * f * f * b[1]];
    var t = [3 * m * m * (p1[0] - a[0]) + 6 * m * f * (p2[0] - p1[0]) + 3 * f * f * (b[0] - p2[0]),
             3 * m * m * (p1[1] - a[1]) + 6 * m * f * (p2[1] - p1[1]) + 3 * f * f * (b[1] - p2[1])];
    var n = Math.hypot(t[0], t[1]) || 1;
    return { p: p, t: [t[0] / n, t[1] / n] };
  }

  // подсказка: маленький лист в слое взаимодействия, числа Geist Mono
  function tip(g, F, n) {
    var lines = n.node.info, ui = F.ui, C = R.color;
    var w = 16 * ui + Math.max.apply(null, lines.map(function (s) { return K.measure(g, F, s, { size: 1, mono: true, min: 8 }); })), h = (12 + 15 * lines.length) * ui;
    var x = n.sx + n.sw / 2 + 12 * ui, y = n.sy - h / 2;
    if (x + w > F.W - 8) x = n.sx - n.sw / 2 - 12 * ui - w;
    y = clamp(y, 8, F.H - h - 8);
    g.save();
    // тень подсказки из того же света: сдвиг и мягкость как у z3
    var o = R.light.offset(F.L, x + w / 2, y + h / 2, R.zh(3, F.P, ui), 0), sg = R.light.sigma(F.L, R.zh(3, F.P, ui));
    g.filter = 'blur(' + sg.toFixed(1) + 'px)'; g.fillStyle = C.css(F.tn.shadow, F.L.dens);
    g.beginPath(); g.roundRect(x + o[0], y + o[1], w, h, 4 * ui); g.fill(); g.filter = 'none';
    g.fillStyle = C.css(F.tn.plate); g.beginPath(); g.roundRect(x, y, w, h, 4 * ui); g.fill();
    lines.forEach(function (s, i) { K.text(g, F, s, x + 8 * ui, y + (18 + 15 * i) * ui, { size: 1, mono: true, color: i ? F.I.ink2 : F.I.ink, weight: i ? 400 : 500, min: 8 }); });
    g.restore();
  }

  // ── кинематика дерева: поворот каждого звена вокруг точки подвеса (родителя) ──────────
  // Звено: {id, parent, rest:[dx,dy] от родителя в мире, amp (°), lag (сдвиг фазы волны по звену)}.
  // Угол звена = гармоники ОДНОГО периода P (целые k → цикл замыкается), копится по цепочке:
  // дальний конец качается сильнее (мобиль Калдера, ветка под ветром, щупальце в воде).
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  }
  var PH = {};
  function phases(seed, id) {
    var k = seed + '|' + id;
    if (!PH[k]) { var r = hash(k), a = []; for (var i = 0; i < 6; i++) a.push(r() * TAU); PH[k] = a; }
    return PH[k];
  }
  function fk(chain, t, P, seed, origin) {
    var per = Math.max(1, +P.period || 36), w = TAU * ((t % per) / per), wind = +P.wind, out = {};
    var D2R = Math.PI / 180;
    chain.forEach(function (c) {
      var par = c.parent ? out[c.parent] : { x: origin[0], y: origin[1], ang: 0 };
      var ph = phases(seed, c.id), lag = c.lag || 0, k = c.k || 1;
      var sw = wind * (c.amp || 0) * D2R * (0.62 * Math.sin(k * w + ph[0] - lag) + 0.28 * Math.sin(2 * k * w + ph[1] - 2 * lag) + 0.10 * Math.sin(3 * k * w + ph[2]));
      var ang = par.ang + sw, ca = Math.cos(ang), sa = Math.sin(ang);
      var dx = c.rest[0], dy = c.rest[1];
      out[c.id] = { x: par.x + ca * dx - sa * dy, y: par.y + sa * dx + ca * dy, ang: ang, sw: sw,
        tilt: wind * D2R * 1.2 * Math.sin(w + ph[3]) };
    });
    return out;
  }
  // касательная звена для мягкой кривой связи: направление от родителя, повёрнутое на изгиб
  function rot(v, a) { var c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; }
  function unit(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; return [dx / n, dy / n]; }

  // вход сцены
  function run(scene, opt) {
    RELIEF_APP.run({
      id: scene.id, title: scene.title, blurb: scene.blurb, hint: scene.hint, rows: scene.rows || {},
      hotkeys: scene.hotkeys,
      mount: function (ctx) { bind(ctx); },
      draw: function (ctx) { draw(ctx, scene); }
    }, opt);
  }

  window.ORG = { run: run, state: S, toScreen: toScreen, bez: bez, sag: sag, fk: fk, hash: hash, rot: rot, unit: unit };
})();
