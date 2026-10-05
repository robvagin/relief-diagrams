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
   Физика, наведение, фокус, зум и панорама — общий модуль src/motion/graph.js (RELIEF.graph): здесь
   только якоря узлов (качание цепочкой), параллакс и перевод в плашки рельса. */
(function () {
  'use strict';
  var R = window.RELIEF = window.RELIEF || {};
  var TAU = Math.PI * 2, D2R = Math.PI / 180;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mix(a, b, k) { return a + (b - a) * k; }

  /* параллакс за мышью (выше = сильнее сдвиг); остальное состояние держит RELIEF.graph */
  var I = { parX: 0, parY: 0 };

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
    var M = null, key = '', G = null, lastF = null;

    function pick(x, y) {
      if (!lastF) return -1;
      var best = -1, bz = -1;
      lastF.plates.forEach(function (s) {
        if (typeof s.id !== 'number') return;
        if (R.sdf.sd(s, x, y) <= 2 && s.z >= bz) { bz = s.z; best = s.id; }
      });
      return best;
    }

    function model(ctx) {
      var P = ctx.P, W = ctx.W, H = ctx.H, k = [W, H, ctx.seed, ctx.theme].concat((opts.layoutKeys || []).map(function (q) { return P[q]; })).join('|');
      if (M && k === key) return M;
      M = opts.build(ctx);
      var rest = pose(M, ctx.seed, 0, P, true);
      var gn = M.nodes.map(function (n, i) {
        var r = n.kind === 'disc' ? n.r : Math.sqrt(n.w * n.h / Math.PI);
        return { id: n.id, x: rest[i].x, y: rest[i].y, r: r * 0.9, z: n.z, mass: n.kind === 'disc' ? 0.6 + n.r / 40 : 0.8 + n.w * n.h / 9000 };
      });
      var ge = [];
      M.nodes.forEach(function (n, i) { if (n.parent >= 0) ge.push({ a: n.parent, b: i, len: n.len }); });
      G = R.graph.create(gn, ge, {});
      // мир раскладки уже в координатах кадра: вписывание единичное, дом = центр кадра
      G.fit = { s: 1, cx: W / 2, cy: H / 2 }; G.home = { zoom: 1, x: W / 2, y: H / 2 }; G.view = { zoom: 1, x: W / 2, y: H / 2 }; G._viewed = true;
      R.graph.bind(G, ctx.canvas, pick);
      key = k;
      return M;
    }

    var seeded = false;
    function draw(ctx) {
      // дефолты сцены поверх общих ручек: один раз, если адрес не задал своё; панель показывает их же
      if (!seeded && opts.defaults) {
        seeded = true;
        var Q = new URLSearchParams(location.search);
        Object.keys(opts.defaults).forEach(function (k) {
          if (Q.has(k) || Q.has('set.' + k) || !(k in ctx.P)) return;
          ctx.P[k] = opts.defaults[k]; if (window.DG && DG.panel) DG.panel.setValue(k, opts.defaults[k]);
        });
      }
      var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), still = !!ctx.reduced;
      var mod = model(ctx), N = mod.nodes, tsec = R.motion.time(ctx);
      // якоря = качание цепочкой (кинематика); пружины графа тянут узлы к ним, перетаскивание и соседи — там
      var target = pose(mod, ctx.seed, tsec, P, still);
      target.forEach(function (q, i) { G.nodes[i].x = q.x; G.nodes[i].y = q.y; });
      G.sync(ctx, { drift: 0, repel: 0.25, anchorK: 22, springK: 26, damp: 9, gap: 2 });
      // параллакс тянется к указателю экспонентой; без мыши стоит на нуле (детерминизм)
      var m = G.mouse && !still ? G.mouse : null;
      var tpx = m ? clamp((m[0] - W / 2) / (W / 2), -1, 1) : 0, tpy = m ? clamp((m[1] - H / 2) / (H / 2), -1, 1) : 0;
      I.parX = mix(I.parX, -tpx, 0.08); I.parY = mix(I.parY, -tpy, 0.08);
      if (Math.abs(I.parX) < 1e-4) I.parX = 0;
      if (Math.abs(I.parY) < 1e-4) I.parY = 0;
      var zoom = G.view.zoom;

      var Z = R.Z, zs = (P.zscale == null ? 1 : +P.zscale) * ui;
      var T = R.tokens(ctx.theme, P.accent), plateTone = R.material.tints(T, +P.temp || 0).plate;
      var plates = [], screen = new Array(N.length);
      N.forEach(function (n, i) {
        var st = G.state(i), lift = st.lift, dimK = st.fade;
        var z = (Z[n.z] + lift * 10) * zs * (1 - 0.45 * dimK);
        var sp = G.toScreen(st.x, st.y), k = z / Math.max(1, 28 * ui) * 10 * ui;
        sp = [sp[0] + I.parX * k, sp[1] + I.parY * k];
        screen[i] = { x: sp[0], y: sp[1], z: z, dim: dimK, lift: lift };
        var pl = { id: i, kind: n.kind === 'disc' ? 'circle' : 'rect', x: sp[0], y: sp[1], z: z, env: 0, rot: n.kind === 'disc' ? 0 : target[i].rot,
          w: (n.kind === 'disc' ? 2 * n.r : n.w) * zoom, h: (n.kind === 'disc' ? 2 * n.r : n.h) * zoom, r: n.kind === 'disc' ? 0 : (n.corner == null ? 2.5 : n.corner) * ui * zoom,
          assembleIndex: n.order == null ? i : n.order };
        // притухание ЦВЕТОМ: плашка уходит к полу, а не становится стеклом (pseudo-3d-layers §2)
        if (dimK > 0.01) pl.fill = R.color.mix(plateTone, T.ground, 0.55 * dimK);
        plates.push(pl);
      });
      // подсказка: маленькая плашка z3 со значениями у наведённого узла
      if (G.hover >= 0 && G.drag < 0 && mod.tip && N[G.hover]) {
        var tp = mod.tip(N[G.hover]);
        if (tp) {
          var hs = screen[G.hover], tw = Math.max(120, tp.w || 168) * ui, th = (tp.lines.length * 18 + 14) * ui;
          var tx = clamp(hs.x + 24 * ui + tw / 2, tw / 2 + 8, W - tw / 2 - 8), ty = clamp(hs.y - th / 2 - 18 * ui, th / 2 + 8, H - th / 2 - 8);
          plates.push({ id: 'tip', kind: 'rect', x: tx, y: ty, w: tw, h: th, z: Z[3] * zs + 6 * ui, r: 4 * ui, env: 0, tip: tp });
        }
      }
      var spec = {
        plates: plates,
        floor: function (g, F) {
          lastF = F; F.zoom = zoom;
          if (mod.floor) mod.floor(g, F, screen, N);
          var al = function (i) { return 1 - 0.7 * (screen[i] ? screen[i].dim : 0); };
          var byId = {}; F.plates.forEach(function (q) { byId[q.id] = q; });
          (mod.links || []).forEach(function (L) {
            var A = byId[L.a], B = byId[L.b];
            if (!A || !B) return;
            var alpha = Math.min(al(L.a), al(L.b)) * (L.alpha == null ? 1 : L.alpha);
            var gap = 3 * F.ui, pa = edgePoint(A, B.x, B.y, gap), pb = edgePoint(B, A.x, A.y, gap);
            if (L.bend) {
              var dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, mx = (pa[0] + pb[0]) / 2 - dy / d * L.bend * d, my = (pa[1] + pb[1]) / 2 + dx / d * L.bend * d;
              strokeRelief(g, F, function (ox, oy) { g.moveTo(pa[0] + ox, pa[1] + oy); g.quadraticCurveTo(mx + ox, my + oy, pb[0] + ox, pb[1] + oy); }, alpha);
            } else {
              strokeRelief(g, F, function (ox, oy) { g.moveTo(pa[0] + ox, pa[1] + oy); g.lineTo(pb[0] + ox, pb[1] + oy); }, alpha);
            }
            if (L.ticks && P.ticks) ticks(g, F, pa, pb, L.ticks.share, L.ticks.full * zoom, alpha);
          });
          if (mod.floorAfter) mod.floorAfter(g, F, screen, N);
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
        above: function (g, F) { if (mod.above) mod.above(g, F, screen, N); }
      };
      R.frame(ctx, spec);
    }

    var def = {
      id: opts.id, title: opts.title, blurb: opts.blurb, groups: opts.groups,
      draw: draw,
      structural: function () { M = null; },
      init: function () { }
    };
    def.zoom = function () { return G ? G.view.zoom : 1; };
    return def;
  }

  R.org = { scene: scene, ticks: ticks, curveThrough: curveThrough, strokeRelief: strokeRelief, sway: sway, pose: pose,
    zoom: function () { return R.def && R.def.zoom ? R.def.zoom() : 1; } };
})();
