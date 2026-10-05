/* gate · v2 «Росток»: проверка растёт растением. Из корня у пола поднимается стебель с натяжением,
   на черешках по очереди сторон висят проверки (листья-листы и плоды-диски), на верхушке раскрывается
   решение. Ветер качает стебель сильнее к верхушке (гармоники одного периода). Пройденная проверка
   поднимается и оседает, блок опадает на пол плоско, его черешок провисает. */
(function () {
  'use strict';
  var R = window.RELIEF, G = R.gate, O = R.org;
  var D2R = Math.PI / 180;

  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }

  function layout(ctx, M, tr, tsec, still) {
    var P = ctx.P, W = ctx.W, H = ctx.H, ui = R.ui(W, H), S = Math.min(W, H) * 1.05, n = M.steps.length;
    var flt = +P.float || 0, gapK = (+P.gap || 22) / 22;
    // стебель: корень у пола, лёгкий изгиб вправо, верхушка над центром
    var wind = still ? 0 : O.swing(ctx.seed, 'wind', tsec, P, S * 0.05 * flt, 1);
    var wind2 = still ? 0 : O.swing(ctx.seed, 'wind2', tsec, P, S * 0.025 * flt, 1);
    var p0 = [W * 0.44, H * 0.98], p1 = [W * 0.38 + wind2 * 0.3, H * 0.66], p2 = [W * 0.6 + wind * 0.6, H * 0.46], p3 = [W * 0.54 + wind, H * 0.18];
    var size = function (s) {
      if (s.role === 'request') return { kind: 'rect', w: S * 0.27, h: S * 0.16 };
      if (s.role === 'decision') return { kind: 'circle', w: S * 0.18 };
      return s.kind === 'disc' ? { kind: 'circle', w: S * 0.12 } : { kind: 'rect', w: S * 0.22, h: S * 0.13 };
    };
    var els = [], stems = [];
    var samples = []; for (var q = 0; q <= 40; q++) samples.push(bez(p0, p1, p2, p3, q / 40));
    stems.push({ pts: samples.filter(function (_, i) { return i % 4 === 0 || i === 40; }), tone: 'ink', a: 0.85 });
    // корни: три коротких мягких кривых у пола
    [-1, 0.3, 1].forEach(function (d, i) {
      stems.push({ pts: [p0, [p0[0] + d * S * 0.05, p0[1] + S * 0.004], [p0[0] + d * S * (0.09 + i * 0.01), p0[1] - S * 0.01 * (i - 1)]], tone: 'ink2', a: 0.45 });
    });
    for (var k = 0; k < n; k++) {
      var s = M.steps[k], z = size(s), st = tr.steps[k], last = k === n - 1;
      var f = last ? 1 : 0.16 + k * (0.7 / Math.max(1, n - 2)) * gapK * 0.9;
      f = Math.min(0.92, f);
      var base = bez(p0, p1, p2, p3, f), side = k % 2 ? 1 : -1;
      var half = z.kind === 'circle' ? z.w / 2 : Math.max(z.w, z.h) / 2;
      var sway = O.swing(ctx.seed, 'leaf' + k, tsec, P, 6 * D2R * flt, still ? 0 : 1);
      if (last) {
        var c = [base[0], base[1] - z.w * 0.48];
        els.push({ step: s, z: z, x: c[0], y: c[1], rot: 0, st: st, half: z.w / 2, att: base });
        continue;
      }
      var ang = (side < 0 ? 200 : -20) * D2R + side * (12 + k * 4) * D2R + sway;   // черешок вверх-наружу
      var len = S * (0.17 + (k % 2) * 0.04);
      var tip = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len - S * 0.02];
      var cE = [tip[0] + Math.cos(ang) * half * 0.85, tip[1] + Math.sin(ang) * half * 0.5];
      var tilt = z.kind === 'rect' ? (side * (5 + k * 1.2)) * D2R + sway * 0.8 : 0;
      els.push({ step: s, z: z, x: cE[0], y: cE[1], rot: tilt, st: st, half: half, att: base, tip: tip, side: side });
    }
    return { els: els, stems: stems, ui: ui, S: S };
  }

  /* габарит в покое → масштаб и сдвиг: растение целиком в поле кадра (кинематика, закон 9) */
  function fit(ctx, Lo, Lr) {
    var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    Lr.els.forEach(function (e) {
      var hw = e.z.w / 2 + (e.z.kind === 'circle' && e.step.role !== 'decision' ? 140 * Lr.ui : 0), hh = (e.z.h || e.z.w) / 2;
      x0 = Math.min(x0, e.x - hw); x1 = Math.max(x1, e.x + hw); y0 = Math.min(y0, e.y - hh); y1 = Math.max(y1, e.y + hh);
    });
    Lr.stems.forEach(function (s) { s.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); });
    var top = m + 80 * Lr.ui, bw = W - 2 * m, bh = H - top - m * 1.3;
    var k = Math.min(1.1, bw / (x1 - x0), bh / (y1 - y0)) * 0.94;            // запас на ветер и опадание
    var dx = m + (bw - (x1 - x0) * k) / 2 - x0 * k, dy = top + (bh - (y1 - y0) * k) * 0.6 - y0 * k;
    var T = function (p) { return [p[0] * k + dx, p[1] * k + dy]; };
    Lo.els.forEach(function (e) { var q = T([e.x, e.y]); e.x = q[0]; e.y = q[1]; e.att = T(e.att); if (e.tip) e.tip = T(e.tip); e.half *= k;
      e.z = { kind: e.z.kind, w: e.z.w * k, h: e.z.h ? e.z.h * k : undefined }; });
    Lo.stems.forEach(function (s) { s.pts = s.pts.map(T); });
    return Lo;
  }

  R.def = {
    id: 'gate', title: 'Gate · Sprout',
    blurb: 'Check before action grown as a plant: checks hang as leaves and fruit along one stem, the decision opens at the tip; a blocked leaf falls flat.',
    groups: G.rows,
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), M = G.pick(data, P), tsec = R.motion.time(ctx);
      var tr = G.track(P, M, tsec, ctx.reduced, null);
      var Lo = fit(ctx, layout(ctx, M, tr, tsec, !!ctx.reduced), layout(ctx, M, tr, 0, true)), ui = Lo.ui;
      var V = O.frame(ctx, 'gate2/' + M.dec.id + '/' + M.steps.length, Lo.els.map(function (e, i) {
        return { id: e.step.id, x: e.x, y: e.y, r: (e.z.kind === 'circle' ? e.z.w / 2 : Math.max(e.z.w, e.z.h) / 2),
          nb: [Lo.els[i - 1], Lo.els[i + 1]].filter(Boolean).map(function (q) { return q.step.id; }) };
      }));
      var TN = R.material.tints(R.tokens(ctx.theme, P.accent), +P.temp || 0);
      var plates = Lo.els.map(function (e) {
        var zp = G.zpx(e.st.lv + (e.st.flat ? 0 : V.lift(e.step.id) * 0.9), P, ui), sp = V.pos(e.step.id, zp);
        // опавший лист соскальзывает к полу вдоль стебля: вниз на треть своего размера
        if (e.st.flat && e.step.role !== 'decision') sp = [sp[0] + e.side * e.half * 0.12, sp[1] + e.half * 0.22];
        e.sx = sp[0]; e.sy = sp[1];
        return { id: e.step.id, kind: e.z.kind, x: sp[0], y: sp[1], w: e.z.w * V.k, h: (e.z.h || e.z.w) * V.k, r: e.z.kind === 'rect' ? 3 * ui : null,
          rot: e.rot, z: zp, env: e.st.env, step: e.step, el: e, fill: V.fade(e.step.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.step.id)) : null };
      });
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) {
          G.header(g, F, M, tr);
          Lo.stems.forEach(function (s) { O.stem(g, F, s.pts.map(function (p) { return V.pt(p, 0); }), { tone: s.tone, alpha: s.a, t: 0.7 }); });
          // черешки: от стебля к плашке мягкой дугой; у опавшего провисает
          plates.forEach(function (s) {
            var e = s.el, a = V.pt(e.att, 0), b = [s.x, s.y];
            if (e.step.role === 'decision') { O.stem(g, F, [a, [b[0], (a[1] + b[1]) / 2], [b[0], b[1] + s.w / 2]], { tone: 'ink', alpha: 0.85 }); return; }
            var tip = V.pt(e.tip, 0), end = [b[0] - (b[0] - tip[0]) * 0.35, b[1] - (b[1] - tip[1]) * 0.35];
            var mid = [a[0] + (tip[0] - a[0]) * 0.45, Math.min(a[1], tip[1]) - (e.st.flat ? -18 * ui : 22 * ui)];
            O.stem(g, F, [a, mid, e.st.flat ? end : tip], { tone: 'ink2', alpha: e.st.flat ? 0.4 : 0.8, t: 0.7 });
            if (s.kind === 'circle') {
              var right = e.side > 0 && s.x + s.w / 2 + 150 * ui < F.W, x = s.x + (right ? 1 : -1) * (s.w / 2 + 10 * ui);
              R.ink.text(g, F, G.sub(e.step, tr), x, s.y + 4 * ui, { s: G.ts(F, 0), mono: true, tone: e.st.st === 'fail' ? 'ink' : 'ink3', align: right ? 'left' : 'right', alpha: V.dim(s.id) });
            }
          });
        },
        print: function (g, s, F) {
          var src = s.src;
          if (src.kind === 'rect') G.printSheet(g, s, F, src.step, tr, { alpha: V.dim(src.id) });
          else G.printDisc(g, s, F, src.step, tr, { alpha: V.dim(src.id) });
        },
        above: function (g, F) {
          F.plates.forEach(function (s) {
            if (s.src.el.st.st === 'fail') G.blockRing(g, F, s);
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, Math.max(s.w, s.h) / 2 + 9 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
