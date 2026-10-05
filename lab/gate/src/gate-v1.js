/* gate · v1 «Мобиль»: проверка как подвесной мобиль Калдера. Из точки подвеса уходит цепочка коромысел-дуг;
   на одном конце каждого коромысла висит шаг проверки (лист или диск), на другом — следующее коромысло.
   Плечи уравновешены по площади (тяжёлое ближе к оси), каждое коромысло качается вокруг своей оси
   гармониками одного периода. Пройденная проверка поднимается и оседает, блок ложится на пол плоско,
   его нить провисает. */
(function () {
  'use strict';
  var R = window.RELIEF, G = R.gate, O = R.org, I = R.ink;
  var D2R = Math.PI / 180;

  function rot(p, c, a) { var s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; }

  function layout(ctx, M, tr, tsec) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), S = Math.min(W, H) * (W / H < 1.05 ? 1 : 1.08), n = M.steps.length;
    var narrow = W / H < 1.05, gapK = (+P.gap || 22) / 22, still = ctx.reduced, flt = +P.float || 0;
    var size = function (s) {
      if (s.role === 'request') return { kind: 'rect', w: S * 0.27, h: S * 0.16 };
      if (s.role === 'decision') return { kind: 'circle', w: S * 0.17 };
      return s.kind === 'disc' ? { kind: 'circle', w: S * 0.115 } : { kind: 'rect', w: S * 0.21, h: S * 0.125 };
    };
    var area = function (s) { var z = size(s); return z.kind === 'circle' ? Math.PI * z.w * z.w / 4 : z.w * z.h; };
    var rest = []; for (var i = n - 1, acc = 0; i >= 0; i--) { acc += area(M.steps[i]); rest[i] = acc; }
    var p = [W * (narrow ? 0.52 : 0.5), H * 0.2], side = -1, ang = 0;
    var els = [], wires = [], rings = [];
    var ceil = [p[0] - S * 0.03, -4];
    var prevEnd = ceil;
    for (var k = 0; k < n; k++) {
      var s = M.steps[k], z = size(s), last = k === n - 1, st = tr.steps[k];
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
  }

  /* габарит в покое → масштаб и сдвиг (канон кинематики, закон 9): мобиль целиком в поле кадра */
  function fit(ctx, Lo, Lr) {
    var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    Lr.els.forEach(function (e) {
      var hw = e.z.w / 2 + (e.z.kind === 'circle' ? 0 : 0), hh = (e.z.h || e.z.w) / 2, lab = e.z.kind === 'circle' && e.step.role !== 'decision' ? 150 * Lo.ui : 0;
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
  }

  R.def = {
    id: 'gate', title: 'Gate · Mobile',
    blurb: 'Check before action as a Calder mobile: each check hangs on its own arm; a passed check lifts and settles, a blocked one lies flat on the floor.',
    groups: G.rows,
    init: function (ctx) { O.attach(ctx.canvas, function () { }); },
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), M = G.pick(data, P), tsec = R.motion.time(ctx);
      var tr = G.track(P, M, tsec, ctx.reduced, null);
      var Lo = fit(ctx, layout(ctx, M, tr, tsec), layout(Object.assign({}, ctx, { reduced: true }), M, tr, 0)), ui = Lo.ui;
      var V = O.frame(ctx, Lo.els.map(function (e, i) {
        return { id: e.step.id, x: e.x, y: e.y, r: (e.z.kind === 'circle' ? e.z.w / 2 : Math.max(e.z.w, e.z.h) / 2),
          nb: [Lo.els[i - 1], Lo.els[i + 1]].filter(Boolean).map(function (q) { return q.step.id; }) };
      }));
      var plates = Lo.els.map(function (e, i) {
        var o = V.off(e.step.id), lift = V.lift(e.step.id), zp = G.zpx(e.st.lv + lift * 0.9, P, ui);
        var sp = O.toScreen(e.x + o.x, e.y + o.y, zp);
        e.sx = sp[0]; e.sy = sp[1];
        return { id: e.step.id, kind: e.z.kind, x: sp[0], y: sp[1], w: e.z.w * V.k, h: (e.z.h || e.z.w) * V.k, r: e.z.kind === 'rect' ? 3 * ui : null,
          rot: e.rot, z: zp, env: e.st.env, step: e.step, el: e };
      });
      O.state.nodes.forEach(function (n, i) { n.sx = Lo.els[i].sx; n.sy = Lo.els[i].sy; });
      var scr = function (p) { return O.toScreen(p[0], p[1], 0); };
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) {
          G.header(g, F, M, tr);
          // нити и коромысла: одна толщина, мягкие кривые, узлы подвеса кольцами (ни одного прямого угла)
          Lo.wires.forEach(function (w) {
            var pts = w.pts.map(scr);
            if (w.el != null) { var e = Lo.els[w.el]; pts[0] = [e.sx + (pts[0][0] - scr([e.x, e.y])[0]), e.sy - e.half * V.k];
              if (e.st.flat) { var q = pts[pts.length - 1]; pts.splice(1, 0, [(pts[0][0] + q[0]) / 2 + 14 * ui, (pts[0][1] + q[1]) / 2 + 10 * ui]); } }
            if (w.dec != null) { var d = Lo.els[w.dec]; pts[2] = [d.sx, d.sy - d.half * V.k]; }
            O.stem(g, F, pts, { tone: w.tone, alpha: w.a, t: 0.6 });
          });
          Lo.rings.forEach(function (r) { var q = scr(r); g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8);
            g.beginPath(); g.arc(q[0], q[1], 3.2 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); });
          // подписи дисков на полу, наружу от оси мобиля
          plates.forEach(function (s) {
            if (s.kind !== 'circle' || s.step.role === 'decision') return;
            var right = s.x > F.W * 0.47 && s.x + s.w / 2 + 150 * ui < F.W, x = s.x + (right ? 1 : -1) * (s.w / 2 + 10 * ui);
            R.ink.text(g, F, G.sub(s.step, tr), x, s.y + 4 * ui, { s: G.ts(F, 0), mono: true, tone: s.el.st.st === 'fail' ? 'ink' : 'ink3', align: right ? 'left' : 'right', alpha: V.dim(s.id) });
          });
        },
        print: function (g, s, F) {
          var src = s.src;
          if (src.kind === 'rect') G.printSheet(g, s, F, src.step, tr, { alpha: V.dim(src.id) });
          else G.printDisc(g, s, F, src.step, tr, { alpha: V.dim(src.id) });
        },
        above: function (g, F) {
          F.plates.forEach(function (s) {
            var e = s.src.el;
            if (e && e.st.st === 'fail') G.blockRing(g, F, s);
            if (O.state.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, Math.max(s.w, s.h) / 2 + 9 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
