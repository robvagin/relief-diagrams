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

  // живой граф: общий модуль src/motion/graph.js (физика, перетаскивание, наведение, фокус, камера);
  // поза организма (качание вокруг точек подвеса) становится якорем узлов каждый кадр
  var S = { G: null, key: '', idx: {}, last: [], ctx: null };

  function pickAt(sx, sy) {
    for (var i = S.last.length - 1; i >= 0; i--) {
      var n = S.last[i];
      if (n.hit === false) continue;
      var dx = sx - n.sx, dy = sy - n.sy, c = Math.cos(-n.srot), s = Math.sin(-n.srot);
      var lx = c * dx - s * dy, ly = s * dx + c * dy;
      if (n.shape === 'disc' ? Math.hypot(lx, ly) <= n.sw / 2 + 4 : Math.abs(lx) <= n.sw / 2 + 3 && Math.abs(ly) <= n.sh / 2 + 3) return n.i;
    }
    return -1;
  }
  function graphFor(ctx, pose, F0) {
    var key = F0.W + 'x' + F0.H + '|' + pose.nodes.map(function (n) { return n.id; }).join(',') + '|' + ctx.P.spread + '|' + (pose.key || '');
    if (S.G && S.key === key) return S.G;
    var idx = {};
    pose.nodes.forEach(function (n, i) { idx[n.id] = i; });
    var gn = pose.nodes.map(function (n) {
      var r = n.shape === 'disc' ? n.w / 2 : 0.32 * Math.min(n.w, n.h);
      return { id: n.id, x: n.x, y: n.y, r: r, z: n.z, fixed: !!n.fixed, mass: clamp(n.w * n.h / 40000, 0.6, 1.6), drift: 0.35 };
    });
    var ge = [];
    (pose.links || []).forEach(function (l) { if (idx[l.a] != null && idx[l.b] != null) ge.push({ a: idx[l.a], b: idx[l.b] }); });
    var G = R.graph.create(gn, ge, {});
    G.fit = { s: 1, cx: F0.W / 2, cy: F0.H / 2 };
    G.home = { zoom: 1, x: F0.W / 2, y: F0.H / 2 };
    G.view = Object.assign({}, G.home); G._viewed = true;
    S.G = G; S.key = key; S.idx = idx;
    G.describe = function (i) { return pose.nodes[i].info || [pose.nodes[i].id]; };
    if (!ctx.capture) R.graph.bind(G, ctx.canvas, pickAt);
    return S.G;
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

  // Small overview: readable summaries; focus reveals the original full card and text details.
  function compact(g, F, n, zoom) {
    var w = n.w * zoom, h = n.h * zoom, lines = n.info || [];
    g.scale(1 / zoom, 1 / zoom); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = R.color.css(F.T.ink);
    if (w < 40 || h < 24) { g.beginPath(); g.arc(0, 0, 1.5, 0, TAU); g.fill(); return; }
    var max = Math.max(12, w - (n.shape === 'disc' ? 18 : 12));
    function fitLine(s, y, px) {
      s = String(s || ''); g.font = '400 ' + px + 'px Geist,system-ui'; g.letterSpacing = '0px';
      if (g.measureText(s).width > max) { while (s.length && g.measureText(s + '…').width > max) s = s.slice(0, -1); s += '…'; }
      g.fillText(s, 0, y);
    }
    if (n.shape === 'disc') { fitLine(lines[1] || lines[0], 0, 11); return; }
    fitLine(lines[0], -Math.min(20, h / 4), 11);
    fitLine(lines[1], 0, w > 120 ? 18 : 12);
    if (h > 65 && lines[2]) fitLine(lines[2], 20, 11);
  }

  // ── кадр ───────────────────────────────────────────────────────────────
  function draw(ctx, scene) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), t = R.motion.time(ctx);
    var F0 = { W: W, H: H, ui: ui, u: Math.min(W, H) / 48, m: 0.06 * Math.min(W, H), P: P, t: t, reduced: !!ctx.reduced };
    var pose = scene.pose(ctx, F0, t);
    var nodes = pose.nodes, links = pose.links || [];
    var G = graphFor(ctx, pose, F0);
    // якорь узла = поза организма в этот кадр; граф кладёт сверху пружины, наведение и камеру
    nodes.forEach(function (n, i) { G.nodes[i].x = n.x; G.nodes[i].y = n.y; G.nodes[i].fixed = !!n.fixed; });
    G.sync(ctx, { drift: 0.35, amp: 2 * ui, period: +P.period, springK: 30 * (+P.springs || 1), repel: 0.6, gap: 0, damp: 9 });
    var z = G.view.zoom, hot = G.hover >= 0 ? G.hover : G.drag >= 0 ? G.drag : -1;
    var mx = 0, my = 0;
    if (G.mouse && !ctx.capture) { mx = clamp((G.mouse[0] - W / 2) / (W / 2), -1, 1); my = clamp((G.mouse[1] - H / 2) / (H / 2), -1, 1); }
    var par = (+P.parallax || 0) * ui;
    // порядок сборки: от корня по рёбрам
    var depth = {}, root = S.idx[pose.root || (nodes[0] && nodes[0].id)] || 0, q = [root], seen = {}, ord = 0; seen[root] = 1;
    while (q.length) { var id = q.shift(); depth[id] = ord++; G.nb[id].forEach(function (j) { if (!seen[j]) { seen[j] = 1; q.push(j); } }); }
    var plates = [], scr = [];
    nodes.forEach(function (n, i) {
      var st = G.state(i), sp = G.toScreen(st.x, st.y);
      var zl = (n.height == null ? R.zh(n.z, P, ui) : n.height) * (n.zk || 1) + st.lift * R.zh(1, P, ui) * 1.6;
      sp[0] += mx * par * zl * 0.35; sp[1] += my * par * zl * 0.35;
      var sw = n.w * z, sh = n.h * z;
      var nn = { i: i, id: n.id, shape: n.shape, sx: sp[0], sy: sp[1], sw: sw, sh: sh, srot: n.rot || 0, hit: n.hit, node: n, dim: 1 - 0.68 * st.fade };
      scr.push(nn);
      if (n.ghost) return;
      plates.push({
        id: n.id, kind: n.shape === 'disc' ? 'circle' : 'rect', x: sp[0], y: sp[1], w: sw, h: n.shape === 'disc' ? sw : sh,
        r: n.shape === 'pill' ? Math.min(sw, sh) / 2 : n.shape === 'disc' ? 0 : (+P.radius || 0) * ui * z,
        z: zl * Math.sqrt(z), rot: n.rot || 0, env: n.env == null ? 1 : n.env, assembleIndex: depth[i] == null ? 0 : depth[i],
        fill: n.fill, _n: nn
      });
    });
    S.last = scr.slice().sort(function (a, b) { return (a.node.height == null ? a.node.z : a.node.height) - (b.node.height == null ? b.node.z : b.node.height); });
    var byScr = {}; scr.forEach(function (s) { byScr[s.id] = s; });
    var F = R.frame(ctx, {
      plates: plates,
      floor: function (g, Fr) {
        Fr.I = K.inks(Fr); Fr.zoom = z; Fr.G = G;
        g.save();
        var o = G.toScreen(0, 0); g.translate(o[0], o[1]); g.scale(z, z);
        if (pose.floor) pose.floor(g, Fr, F0);
        g.restore();
        // связи: мягкие кривые одной толщины; концы следуют за узлами и пружинами
        links.forEach(function (l) { drawLink(g, Fr, l, byScr); });
        if (pose.floorTop) pose.floorTop(g, Fr, F0, byScr);
      },
      print: function (g, s, Fr) {
        var nn = s.src && s.src._n; if (!nn || !nn.node.print) return;
        g.save();
        g.translate(s.x, s.y); g.rotate(s.rot || 0); g.scale(z, z);
        var n = nn.node;
        if (n.w * z < 120 && z < 1.5 && n.info) { compact(g, Fr, n, z); g.restore(); return; }
        if (n.shape !== 'disc') sag(g, Fr, n.w, n.h, +P.sag, s.rot);
        g.globalAlpha = nn.dim;
        n.print(g, Fr, Fr.I || K.inks(Fr), n.w, n.h, n);
        g.restore();
      },
      above: function (g, Fr) {
        // кольцо фокуса акцентом (слой взаимодействия §7.3 п.7)
        var f = G.focus >= 0 ? scr[G.focus] : null;
        if (f) {
          g.save(); g.strokeStyle = R.color.css(Fr.T.accent, 0.9); g.lineWidth = Fr.lineW;
          g.beginPath();
          if (f.shape === 'disc') g.arc(f.sx, f.sy, f.sw / 2 + 6 * ui, 0, TAU);
          else { g.translate(f.sx, f.sy); g.rotate(f.srot); g.roundRect(-f.sw / 2 - 6 * ui, -f.sh / 2 - 6 * ui, f.sw + 12 * ui, f.sh + 12 * ui, 10 * ui); }
          g.stroke(); g.restore();
        }
        if (pose.above) pose.above(g, Fr, F0, byScr);
        if (hot >= 0 && scr[hot] && scr[hot].node.info) tip(g, Fr, scr[hot]);
      }
    });
    window.__ORG = { nodes: nodes.length, links: links.length, hover: hot >= 0 ? nodes[hot].id : null, focus: G.focus >= 0 ? nodes[G.focus].id : null, zoom: z };
    return F;
  }

  // связь: кривая с натяжением; стебель вырезан рельефом, нить и щупальце напечатаны чернилами
  function drawLink(g, F, l, byScr) {
    var a = typeof l.a === 'string' ? byScr[l.a] : null, b = typeof l.b === 'string' ? byScr[l.b] : null;
    if (!a || !b) return;
    var pa = [a.sx, a.sy], pb = [b.sx, b.sy];
    var al = Math.min(a.dim, b.dim);
    var d = [pb[0] - pa[0], pb[1] - pa[1]], len = Math.hypot(d[0], d[1]) || 1, u = [d[0] / len, d[1] / len];
    var ta = l.ta || u, tb = l.tb || u, ten = +F.P.tension;
    var path = function (gg, ox, oy) { K.curve(gg, [pa[0] + (ox || 0), pa[1] + (oy || 0)], [pb[0] + (ox || 0), pb[1] + (oy || 0)], ta, tb, ten); };
    if (l.kind === 'stem') { K.stroke(g, F, path, F.I.ink2, al * 0.38 * (l.alpha == null ? 1 : l.alpha)); K.relief(g, F, path, al * (l.alpha == null ? 1 : l.alpha)); }
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

  // гладкая цепочка: касательные в узлах по соседям (Catmull-Rom), чтобы стебель и щупальце шли без изломов
  function chainLinks(pos, ids, kind, extra) {
    var out = [];
    for (var i = 0; i + 1 < ids.length; i++) {
      var p0 = pos[ids[Math.max(0, i - 1)]], p1 = pos[ids[i]], p2 = pos[ids[i + 1]], p3 = pos[ids[Math.min(ids.length - 1, i + 2)]];
      var ta = unit([p0.x, p0.y], [p2.x, p2.y]), tb = unit([p1.x, p1.y], [p3.x, p3.y]);
      out.push(Object.assign({ a: ids[i], b: ids[i + 1], kind: kind, ta: ta, tb: tb }, extra || {}));
    }
    return out;
  }

  // вписать организм в кадр: поза покоя (ветер 0) → рамка с радиусами узлов и запасом на наклон
  // листов (±8°) и качание → масштаб и центр (поля 6 % + место под шапку). Правило раскладки
  // остаётся, меняется только масштаб кадра; kmax > 1 разрешает организму заполнить кадр.
  function halfExt(n) {
    if (n.shape === 'disc') return [n.w / 2, n.w / 2];
    var c = Math.cos(8 * Math.PI / 180), s = Math.sin(8 * Math.PI / 180);
    return [(c * n.w + s * n.h) / 2, (s * n.w + c * n.h) / 2];
  }
  function restPos(M) { return fk(M.chain, 0, { wind: 0, period: 36 }, 'fit', [0, 0]); }
  function fitModel(M, F, top, kmax) {
    var pos = restPos(M), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    M.nodes.forEach(function (n) { if (n.ghost) return; var p = pos[n.id], e = halfExt(n);
      x0 = Math.min(x0, p.x - e[0]); x1 = Math.max(x1, p.x + e[0]); y0 = Math.min(y0, p.y - e[1]); y1 = Math.max(y1, p.y + e[1]); });
    var m = F.m + 6 * F.ui, tp = top == null ? 0.07 * F.H : top, aw = F.W - 2 * m, ah = F.H - 2 * m - tp;
    var k = Math.min(kmax == null ? 1 : kmax, aw / (x1 - x0), ah / (y1 - y0));
    M.chain.forEach(function (c) { c.rest = [c.rest[0] * k, c.rest[1] * k]; });
    M.nodes.forEach(function (n) { n.w *= k; n.h *= k; });
    M.cx = F.W / 2 - (x0 + x1) / 2 * k; M.cy = m + tp + ah / 2 - (y0 + y1) / 2 * k;
    M.k = k;
    return M;
  }
  // воздух между плашками: в позе покоя раздвинуть пересечения (рамки с зазором gap), лёгкое
  // уступает тяжёлому, корень и закреплённые стоят; затем позы пересчитываются в векторы подвеса
  function relax(M, gap, keep) {
    var pos = restPos(M), ids = M.nodes.filter(function (n) { return !n.ghost; }).map(function (n) { return n.id; });
    var byId = {}; M.nodes.forEach(function (n) { byId[n.id] = n; });
    var P = {}; Object.keys(pos).forEach(function (k) { P[k] = [pos[k].x, pos[k].y]; });
    keep = keep || {};
    for (var it = 0; it < 80; it++) {
      var moved = false;
      for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
        var a = byId[ids[i]], b = byId[ids[j]];
        if (keep[a.id + '|' + b.id] || keep[b.id + '|' + a.id]) continue;
        var ea = halfExt(a), eb = halfExt(b), pa = P[a.id], pb = P[b.id];
        var ox = ea[0] + eb[0] + gap - Math.abs(pb[0] - pa[0]), oy = ea[1] + eb[1] + gap - Math.abs(pb[1] - pa[1]);
        if (ox <= 0 || oy <= 0) continue;
        // круги расходятся по линии центров, листы — по оси меньшего перекрытия
        var dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, push;
        if (a.shape === 'disc' && b.shape === 'disc') { push = a.w / 2 + b.w / 2 + gap - d; if (push <= 0) continue; dx /= d; dy /= d; }
        else if (ox < oy) { push = ox; dx = dx >= 0 ? 1 : -1; dy = 0; } else { push = oy; dy = dy >= 0 ? 1 : -1; dx = 0; }
        var wa = a.fixed ? 0 : 1 / Math.max(1, a.w * a.h), wb = b.fixed ? 0 : 1 / Math.max(1, b.w * b.h), ws = wa + wb;
        if (!ws) continue;
        pa[0] -= dx * push * wa / ws * 0.5; pa[1] -= dy * push * wa / ws * 0.5;
        pb[0] += dx * push * wb / ws * 0.5; pb[1] += dy * push * wb / ws * 0.5;
        moved = true;
      }
      if (!moved) break;
    }
    // обратно в векторы подвеса (в покое углы нулевые, вектор = разность позиций)
    M.chain.forEach(function (c) { if (c.parent) { var q = P[c.id], r = P[c.parent]; c.rest = [q[0] - r[0], q[1] - r[1]]; } });
    return M;
  }

  // вход сцены
  function run(scene, opt) {
    RELIEF_APP.run({
      id: scene.id, title: scene.title, blurb: scene.blurb, hint: scene.hint, rows: scene.rows || {},
      hotkeys: scene.hotkeys,
      draw: function (ctx) { draw(ctx, scene); },
      capture: function (ctx) {
        var keep = Object.assign({}, S), last = R.last;
        S.G = null; S.key = '';
        try { draw(ctx, scene); } finally { Object.assign(S, keep); R.last = last; R._shade = null; }
      }
    }, opt);
  }

  window.ORG = { run: run, state: S, bez: bez, sag: sag, fk: fk, hash: hash, rot: rot, unit: unit, chainLinks: chainLinks, fitModel: fitModel, relax: relax };
})();
