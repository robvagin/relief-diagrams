/* organism.js · живой организм из бумажных листов и дисков на рельсе RELIEF (приказ владельца, волна 3).
   Сцена описывает дерево узлов в покое: корень с абсолютной точкой, у остальных полярная привязка
   к родителю (длина, угол). Здесь:
   · качание: каждый узел поворачивает своё поддерево вокруг родителя на угол из гармоник ОДНОГО
     периода (цикл замкнут, скорость непрерывна; канон кинематики, законы 1–2), фаза отстаёт с глубиной:
     щупальце и ветка идут волной, а не жёстким маятником;
   · физика как в graph view: пока никто не трогал, позиция = кинематика (детерминизм по номеру
     кадра); тронули — узлы на пружинах к своей точке покоя и к родителю, перетаскиваемый тянет соседей,
     отпустили — всё возвращается и физика сама выключается, когда скорости погасли;
   · наведение поднимает узел с соседями, остальное притухает цветом; клик = фокус, колесо = зум,
     протяжка по фону = панорама, двойной клик = домой; параллакс за мышью (выше = сильнее);
   · рисует рельс: плашки уходят в RELIEF.frame (один свет, тени по приёмникам), связи печатаются на полу.
   После слияния src/motion/graph.js физика переезжает туда; формат узла совпадает по смыслу. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var TAU = Math.PI * 2, D2R = Math.PI / 180;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mix(a, b, k) { return a + (b - a) * k; }

  /* ── состояние взаимодействия (одно на страницу) ─────────────────────── */
  var I = {
    px: null, py: null, inside: false,             // указатель в координатах канваса
    hover: -1, drag: -1, focus: -1, panning: false,
    zoom: 1, panX: 0, panY: 0,                      // цель камеры
    cz: 1, cx: 0, cy: 0,                            // камера сейчас (экспонента к цели)
    parX: 0, parY: 0,                               // параллакс сейчас
    lift: {}, dim: 0,                               // подъём по узлам и общее притухание
    touched: false, down: null, moved: false
  };

  /* ── качание: гармоники одного периода, фазы из потока рельса по id ── */
  function sway(seed, node, tsec, P) {
    if (!(node.sway > 0)) return 0;
    var ph = R.motion.phases(seed, 'org/' + node.id), per = Math.max(4, +P.period || 36);
    var w = TAU * ((tsec % per) / per), lag = node.depth * 0.7;
    // гармоники 1, 2, 3 от периода: за P всё сходится; фаза волны отстаёт с глубиной
    var a = 0.62 * Math.sin(w + ph[0] - lag) + 0.28 * Math.sin(2 * w + ph[1] - lag) + 0.10 * Math.sin(3 * w + ph[2] - lag);
    return node.sway * D2R * a * (+P.float || 0);
  }

  /* кинематика: позиции всех узлов в мире на момент tsec (без физики) */
  function pose(M, seed, tsec, P, still) {
    var N = M.nodes, out = new Array(N.length);
    for (var i = 0; i < N.length; i++) {
      var n = N[i];
      if (n.parent < 0) { out[i] = { x: n.x, y: n.y, rot: 0, acc: 0 }; continue; }
      var p = out[n.parent], acc = p.acc + (still ? 0 : sway(seed, n, tsec, P));
      var a = n.ang + acc;
      out[i] = { x: p.x + Math.cos(a) * n.len, y: p.y + Math.sin(a) * n.len, rot: (n.rot || 0) + acc * (n.spin == null ? 1 : n.spin), acc: acc };
    }
    return out;
  }

  /* ── физика: пружина к точке покоя и к родителю, вязкость; шаг 1/60 с ── */
  function Phys() { this.p = null; this.v = null; this.t = -1; this.awake = false; }
  Phys.prototype.reset = function (pos) {
    this.p = pos.map(function (q) { return [q.x, q.y]; }); this.v = pos.map(function () { return [0, 0]; });
  };
  Phys.prototype.step = function (M, target, dragId, dragXY) {
    var N = M.nodes, p = this.p, v = this.v, dt = 1 / 60, kT = 26, kE = 60, c = 7.5, energy = 0;
    for (var i = 0; i < N.length; i++) {
      if (i === dragId) { v[i][0] = (dragXY[0] - p[i][0]) / dt * 0.3; v[i][1] = (dragXY[1] - p[i][1]) / dt * 0.3; p[i][0] = dragXY[0]; p[i][1] = dragXY[1]; continue; }
      var fx = kT * (target[i].x - p[i][0]), fy = kT * (target[i].y - p[i][1]);
      var n = N[i];
      // пружина связи: родитель и дети держат длину нити (сосед едет за перетаскиваемым)
      var nb = n.links || [];
      for (var k = 0; k < nb.length; k++) {
        var j = nb[k].j, L = nb[k].len, dx = p[j][0] - p[i][0], dy = p[j][1] - p[i][1], d = Math.hypot(dx, dy) || 1;
        var f = kE * (d - L) / d * (j === dragId ? 1.6 : 1);
        fx += f * dx; fy += f * dy;
      }
      var m = n.mass || 1;
      v[i][0] = (v[i][0] + fx / m * dt) * Math.exp(-c * dt); v[i][1] = (v[i][1] + fy / m * dt) * Math.exp(-c * dt);
      p[i][0] += v[i][0] * dt; p[i][1] += v[i][1] * dt;
      energy += Math.abs(v[i][0]) + Math.abs(v[i][1]) + Math.abs(target[i].x - p[i][0]) + Math.abs(target[i].y - p[i][1]);
    }
    return energy / Math.max(1, N.length);
  };

  /* ── камера: мир → экран ─────────────────────────────────────────────── */
  function toScreen(W, H, x, y, z, ui) {
    var sx = (x - W / 2) * I.cz + W / 2 + I.cx, sy = (y - H / 2) * I.cz + H / 2 + I.cy;
    // параллакс: выше = сильнее сдвиг (псевдо-3D)
    var k = (z || 0) / Math.max(1, 28 * ui) * 10 * ui;
    return [sx + I.parX * k, sy + I.parY * k];
  }
  function toWorld(W, H, sx, sy) { return [(sx - W / 2 - I.cx) / I.cz + W / 2, (sy - H / 2 - I.cy) / I.cz + H / 2]; }

  /* ── попадание: верхняя плашка под указателем ───────────────────────── */
  function hit(F, x, y) {
    var best = -1, bz = -1;
    (F.plates || []).forEach(function (s) {
      if (s.id == null || typeof s.id !== 'number' || s.id < 0 || s.ghost) return;
      var d = R.sdf.sd(s, x, y);
      if (d <= 2 && s.z >= bz) { bz = s.z; best = s.id; }
    });
    return best;
  }

  /* ── связи: прямой луч, мягкая дуга, щупальце сплайном; одна толщина (L7) ─ */
  function edgePoint(s, tx, ty, gap) {
    // точка на краю формы по направлению к цели, плюс зазор (Joint gap донора 04)
    var dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, r;
    if (s.kind === 'circle') r = s.w / 2;
    else { var c = Math.cos(-(s.rot || 0)), n = Math.sin(-(s.rot || 0)), lx = c * ux - n * uy, ly = n * ux + c * uy;
      r = Math.min(Math.abs(s.w / 2 / (lx || 1e-6)), Math.abs(s.h / 2 / (ly || 1e-6))); }
    return [s.x + ux * (r + gap), s.y + uy * (r + gap)];
  }
  function curveThrough(g, pts) {
    // Катмулл-Ром → Безье: мягкая кривая с натяжением, без изломов
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)], t = 0.5 / 3 * 2;
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t / 2, p1[1] + (p2[1] - p0[1]) * t / 2,
        p2[0] - (p3[0] - p1[0]) * t / 2, p2[1] - (p3[1] - p1[1]) * t / 2, p2[0], p2[1]);
    }
  }
  function strokeRelief(g, F, pathFn, alpha) {
    var l = F.L.l, n = Math.hypot(l[0], l[1]) || 1, sx = -0.75 * l[0] / n * F.ui, sy = -0.75 * l[1] / n * F.ui;
    g.save(); g.lineWidth = F.lineW; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = R.color.css(F.T.ink2, 0.5 * alpha); g.beginPath(); pathFn(0, 0); g.stroke();
    g.strokeStyle = R.color.css(F.tn.light, 0.55 * alpha); g.beginPath(); pathFn(sx, sy); g.stroke();
    g.restore();
  }
  /* засечки на луче каждые 10 % доли, конец линейки вдвое длиннее (прибор, а не украшение) */
  function ticks(g, F, a, b, share, full, alpha) {
    var step = full / 10; if (step < 5 * F.ui) return;
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
    g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink2, 0.4 * alpha); g.beginPath();
    var n = Math.floor(share * 10 + 1e-6);
    for (var i = 1; i <= n && i * step <= L + 0.5; i++) { var x = a[0] + ux * i * step, y = a[1] + uy * i * step, t = 3 * F.ui; g.moveTo(x - px * t, y - py * t); g.lineTo(x + px * t, y + py * t); }
    var e = Math.min(L, share * full), ex = a[0] + ux * e, ey = a[1] + uy * e, te = 6 * F.ui;
    g.moveTo(ex - px * te, ey - py * te); g.lineTo(ex + px * te, ey + py * te);
    g.stroke(); g.restore();
  }

  /* ── печать на листе: провис (едва заметная ложбина), подпись, число ── */
  function sag(g, s, F) {
    // лист висит за верхние углы: середина чуть проседает и уходит от света на 1–2 % светлоты
    g.save(); g.translate(s.x, s.y); g.rotate(s.rot || 0);
    var gr = g.createLinearGradient(0, -s.h / 2, 0, s.h / 2);
    gr.addColorStop(0, R.color.css(F.tn.light, 0.10)); gr.addColorStop(0.55, R.color.css(F.tn.shadow, 0.035)); gr.addColorStop(1, R.color.css(F.tn.shadow, 0.012));
    g.fillStyle = gr; g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    g.restore();
  }

  /* ── сцена: оболочка вокруг модели варианта ─────────────────────────── */
  function scene(opts) {
    var M = null, key = '', phys = new Phys(), lastF = null, home = { x: 0, y: 0 };
    var bound = false;

    function bind(ctx) {
      if (bound) return; bound = true;
      var cv = ctx.canvas;
      cv.style.touchAction = 'none';
      function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
      cv.addEventListener('pointermove', function (e) {
        var p = pos(e); I.px = p[0]; I.py = p[1]; I.inside = true;
        if (I.down) {
          var dx = p[0] - I.down.x, dy = p[1] - I.down.y;
          if (!I.moved && Math.hypot(dx, dy) > 4) { I.moved = true; if (I.down.node >= 0) { I.drag = I.down.node; I.touched = true; phys.awake = true; } else I.panning = true; }
          if (I.panning) { I.panX = I.down.panX + dx; I.panY = I.down.panY + dy; I.cx = I.panX; I.cy = I.panY; }
        }
      });
      cv.addEventListener('pointerleave', function () { I.inside = false; I.hover = -1; });
      cv.addEventListener('pointerdown', function (e) {
        var p = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
        I.down = { x: p[0], y: p[1], node: lastF ? hit(lastF, p[0], p[1]) : -1, panX: I.panX, panY: I.panY }; I.moved = false;
      });
      function up() {
        if (I.down && !I.moved) {
          // клик: фокус на узле (камера едет к нему), клик по фону снимает фокус
          var n = I.down.node;
          if (n >= 0 && n !== I.focus) { I.focus = n; var s = lastF && lastF.plates.filter(function (q) { return q.id === n; })[0];
            if (s && lastF) { var w = toWorld(lastF.W, lastF.H, s.x, s.y); I.zoom = Math.max(I.zoom, 1.35); I.panX = -(w[0] - lastF.W / 2) * I.zoom; I.panY = -(w[1] - lastF.H / 2) * I.zoom; } }
          else { I.focus = -1; }
        }
        I.down = null; I.drag = -1; I.panning = false;
      }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) {
        e.preventDefault();
        var p = pos(e), z0 = I.zoom, z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0015), 0.6, 3.2);
        // зум вокруг курсора: точка под мышью остаётся на месте
        var W = cv.clientWidth, H = cv.clientHeight, wx = (p[0] - W / 2 - I.panX) / z0, wy = (p[1] - H / 2 - I.panY) / z0;
        I.zoom = z1; I.panX = p[0] - W / 2 - wx * z1; I.panY = p[1] - H / 2 - wy * z1;
      }, { passive: false });
      cv.addEventListener('dblclick', function () { I.zoom = 1; I.panX = 0; I.panY = 0; I.focus = -1; });
    }

    function model(ctx) {
      var P = ctx.P, k = [ctx.W, ctx.H, ctx.seed, ctx.theme].concat((opts.layoutKeys || []).map(function (q) { return P[q]; })).join('|');
      if (M && k === key) return M;
      M = opts.build(ctx);
      // нити для пружин: родитель и дети
      M.nodes.forEach(function (n, i) { n.links = []; n.mass = n.mass || (n.kind === 'disc' ? 0.6 + n.r / 40 : 0.8 + n.w * n.h / 9000); });
      M.nodes.forEach(function (n, i) { if (n.parent >= 0) { M.nodes[n.parent].links.push({ j: i, len: n.len }); n.links.push({ j: n.parent, len: n.len }); } });
      key = k; phys.p = null;
      return M;
    }

    function draw(ctx) {
      bind(ctx);
      var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), still = !!ctx.reduced;
      var mod = model(ctx), N = mod.nodes, tsec = R.motion.time(ctx);
      var target = pose(mod, ctx.seed, tsec, P, still);
      // физика только после касания: иначе кадр = кинематика (детерминизм по номеру кадра)
      var pos = target;
      if (phys.awake && !still) {
        if (!phys.p || phys.p.length !== N.length) phys.reset(target);
        var dragXY = I.drag >= 0 && I.px != null ? toWorld(W, H, I.px, I.py) : null, e = 0;
        for (var s = 0; s < 2; s++) e = phys.step(mod, target, dragXY ? I.drag : -1, dragXY);
        pos = phys.p.map(function (q, i) { return { x: q[0], y: q[1], rot: target[i].rot }; });
        if (I.drag < 0 && e < 0.02) { phys.awake = false; phys.p = null; }
      }
      // камера и параллакс тянутся к цели экспонентой (интерактив; без касаний всё стоит на нуле)
      var ease = still ? 1 : 0.16;
      I.cz = mix(I.cz, I.zoom, ease); I.cx = mix(I.cx, I.panX, ease); I.cy = mix(I.cy, I.panY, ease);
      var tpx = I.inside && I.px != null && !still ? clamp((I.px - W / 2) / (W / 2), -1, 1) : 0, tpy = I.inside && I.py != null && !still ? clamp((I.py - H / 2) / (H / 2), -1, 1) : 0;
      I.parX = mix(I.parX, -tpx, 0.08); I.parY = mix(I.parY, -tpy, 0.08);
      if (Math.abs(I.parX) < 1e-4) I.parX = 0; if (Math.abs(I.parY) < 1e-4) I.parY = 0;
      // наведение: узел и соседи поднимаются, остальное притухает цветом
      if (!I.drag || I.drag < 0) I.hover = I.inside && lastF && I.px != null ? hit(lastF, I.px, I.py) : -1;
      var act = I.drag >= 0 ? I.drag : I.hover >= 0 ? I.hover : I.focus;
      var near = {}; if (act >= 0) { near[act] = 1; (N[act].links || []).forEach(function (l) { near[l.j] = 1; });
        if (I.focus >= 0 && act === I.focus) (function sub(i) { near[i] = 1; N.forEach(function (n, j) { if (n.parent === i) sub(j); }); })(I.focus); }
      I.dim = mix(I.dim, act >= 0 ? 1 : 0, still ? 1 : 0.14);
      N.forEach(function (n, i) { I.lift[i] = mix(I.lift[i] || 0, act >= 0 && near[i] ? 1 : 0, still ? 1 : 0.14); if (I.lift[i] < 1e-3) I.lift[i] = 0; });
      if (I.dim < 1e-3) I.dim = 0;

      var Z = R.Z, zs = (P.zscale == null ? 1 : +P.zscale) * ui;
      var T = R.tokens(ctx.theme, P.accent);
      var plates = [], screen = new Array(N.length);
      N.forEach(function (n, i) {
        var lift = I.lift[i] || 0, dimK = I.dim * (1 - lift);
        var z = (Z[n.z] + lift * 10) * zs * (1 - 0.45 * dimK);
        var sp = toScreen(W, H, pos[i].x, pos[i].y, z, ui);
        screen[i] = { x: sp[0], y: sp[1], z: z, dim: dimK, lift: lift };
        var pl = { id: i, kind: n.kind === 'disc' ? 'circle' : 'rect', x: sp[0], y: sp[1], z: z, env: 0, rot: n.kind === 'disc' ? 0 : pos[i].rot,
          w: (n.kind === 'disc' ? 2 * n.r : n.w) * I.cz, h: (n.kind === 'disc' ? 2 * n.r : n.h) * I.cz, r: n.kind === 'disc' ? 0 : (n.corner == null ? 2.5 : n.corner) * ui * I.cz,
          assembleIndex: n.order == null ? i : n.order };
        if (dimK > 0.01) pl.fill = R.color.mix(R.material.tints(T, +P.temp || 0).plate, T.ground, 0.55 * dimK);
        plates.push(pl);
      });
      // подсказка: маленькая плашка z3 со значениями у наведённого узла
      if (I.hover >= 0 && I.drag < 0 && mod.tip) {
        var tp = mod.tip(N[I.hover]);
        if (tp) { var hs = screen[I.hover], tw = Math.max(120, tp.w || 168) * ui, th = (tp.lines.length * 18 + 14) * ui;
          var tx = clamp(hs.x + 24 * ui + tw / 2, tw / 2 + 8, W - tw / 2 - 8), ty = clamp(hs.y - th / 2 - 18 * ui, th / 2 + 8, H - th / 2 - 8);
          plates.push({ id: 'tip', kind: 'rect', x: tx, y: ty, w: tw, h: th, z: Z[3] * zs + 6 * ui, r: 4 * ui, env: 0, tip: tp }); }
      }
      var spec = {
        plates: plates,
        floor: function (g, F) {
          lastF = F;
          if (mod.floor) mod.floor(g, F, screen, N, I);
          var al = function (i) { return 1 - 0.7 * (screen[i] ? screen[i].dim : 0); };
          (mod.links || []).forEach(function (L) {
            var A = F.plates.filter(function (q) { return q.id === L.a; })[0], B = F.plates.filter(function (q) { return q.id === L.b; })[0];
            if (!A || !B) return;
            var alpha = Math.min(al(L.a), al(L.b)) * (L.alpha == null ? 1 : L.alpha);
            var gap = 3 * F.ui, pa = edgePoint(A, B.x, B.y, gap), pb = edgePoint(B, A.x, A.y, gap);
            if (L.via) {
              // щупальце/стебель: через промежуточные точки (мировые → экран), мягкая кривая
              var pts = [pa].concat(L.via(pos, screen, F).map(function (q) { return q; })).concat([pb]);
              strokeRelief(g, F, function (ox, oy) { curveThrough(g, pts.map(function (q) { return [q[0] + ox, q[1] + oy]; })); }, alpha);
            } else if (L.bend) {
              var dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, mx = (pa[0] + pb[0]) / 2 - dy / d * L.bend * d, my = (pa[1] + pb[1]) / 2 + dx / d * L.bend * d;
              strokeRelief(g, F, function (ox, oy) { g.moveTo(pa[0] + ox, pa[1] + oy); g.quadraticCurveTo(mx + ox, my + oy, pb[0] + ox, pb[1] + oy); }, alpha);
            } else {
              strokeRelief(g, F, function (ox, oy) { g.moveTo(pa[0] + ox, pa[1] + oy); g.lineTo(pb[0] + ox, pb[1] + oy); }, alpha);
            }
            if (L.ticks && P.ticks) ticks(g, F, pa, pb, L.ticks.share, L.ticks.full * I.cz, alpha);
          });
          if (mod.floorAfter) mod.floorAfter(g, F, screen, N, I);
          R.ink.fictional(g, F);
        },
        print: function (g, s, F) {
          if (s.id === 'tip') {
            s.src.tip.lines.forEach(function (ln, k) {
              R.ink.text(g, F, ln, s.x - s.w / 2 + 8 * F.ui, s.y - s.h / 2 + (16 + 18 * k) * F.ui, { s: 0, mono: k > 0, w: k ? 400 : 500, tone: k ? 'ink2' : 'ink' });
            });
            return;
          }
          var n = N[s.id]; if (!n) return;
          if (n.kind !== 'disc') sag(g, s, F);
          if (mod.print) mod.print(g, s, F, n, screen[s.id]);
        },
        above: function (g, F) { if (mod.above) mod.above(g, F, screen, N, I); }
      };
      R.frame(ctx, spec);
    }

    return {
      id: opts.id, title: opts.title, blurb: opts.blurb, groups: opts.groups,
      draw: draw,
      structural: function () { M = null; },
      init: function () { }
    };
  }

  R.org = { scene: scene, ticks: ticks, curveThrough: curveThrough, strokeRelief: strokeRelief, I: I, sway: sway, pose: pose };
})();
