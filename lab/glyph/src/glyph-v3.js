/* glyph · v3 «Росток»: эпизод агента A4 растёт стеблем. Платёж D-7781 → D-7782: на связи → читает →
   сверяет → блок → ждёт согласования → действует → готово. Каждая станция распускается диском на черешке
   по очереди сторон, когда до неё доходит время; текущая крупнее и несёт живой знак в размере ручки,
   пройденные оседают и печатают свой знак мельче. В конце круга стебель сворачивается в почку (цикл замкнут).
   Без листа: растение раскрыто целиком, подсвечены станции выбранного состояния. */
(function () {
  'use strict';
  var R = window.RELIEF, GL = R.glyph, O = R.org, G = R.gate;
  var D2R = Math.PI / 180;

  function episode(data) {
    var d1 = data.decisions.filter(function (d) { return d.id === 'D-7781'; })[0], d2 = data.decisions.filter(function (d) { return d.id === 'D-7782'; })[0];
    return [
      { state: 'idle', dur: 2, title: 'On call', sub: d1.loan },
      { state: 'work', verb: 'read', dur: 2.5, title: 'Read', sub: d1.loan + ' · schedule' },
      { state: 'work', verb: 'check', dur: 2.5, title: 'Check', sub: d1.checks[0].ref + ' · ' + d1.checks[1].ref },
      { state: 'error', dur: 2, title: 'Blocked', sub: d1.id + ' · approval ' + d1.checks[2].result },
      { state: 'wait', dur: 4, title: 'Wait', sub: 'Director approval' },
      { state: 'work', verb: 'act', dur: 1.5, title: 'Act', sub: d2.action },
      { state: 'done', dur: 3, title: 'Done', sub: d2.id + ' · allowed' }
    ];
  }
  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }

  R.def = {
    id: 'glyph', title: 'Glyph · Sprout',
    blurb: 'Agent state over one payment, grown as a plant: each station opens as a disc on the stem, the current one carries the live glyph.',
    groups: GL.rows,
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), tsec = R.motion.time(ctx), W = ctx.W, H = ctx.H, ui = R.ui(W, H);
      var EP = episode(data), n = EP.length, total = EP.reduce(function (a, s) { return a + s.dur; }, 0), cyc = total + 1.6;
      var play = +P.sheet && !ctx.reduced, flt = +P.float || 0, size = Math.round(+P.size || 48);
      var tt = play ? ((tsec % cyc) + cyc) % cyc : total - 0.01, acc = 0, cur = 0;
      EP.forEach(function (s, i) { s.t0 = acc; acc += s.dur; if (tt >= s.t0) cur = i; });
      if (!play) cur = n - 1;
      var fold = play ? Math.max(0, Math.min(1, (tt - total - 0.6) / 0.9)) : 0; fold = fold * fold * (3 - 2 * fold);
      var S = Math.min(W, H), m = S * 0.06, top = m + 86 * ui, bot = H - m;
      var wind = ctx.reduced ? 0 : O.swing(ctx.seed, 'wind', tsec, P, S * 0.04 * flt, 1), wind2 = ctx.reduced ? 0 : O.swing(ctx.seed, 'wind2', tsec, P, S * 0.02 * flt, 1);
      function geom(still) {
        var wd = still ? 0 : wind, wd2 = still ? 0 : wind2;
        var C = [[W * 0.42, bot], [W * 0.36 + wd2 * 0.3, top + (bot - top) * 0.62], [W * 0.68 + wd * 0.6, top + (bot - top) * 0.45], [W * 0.56 + wd, top + (bot - top) * 0.08]];
        var out = [];
        EP.forEach(function (s, i) {
          var f = 0.12 + 0.86 * i / (n - 1), side = i % 2 ? 1 : -1;
          var since = tt - s.t0, open = still ? 1 : play ? (i <= cur ? R.motion.spring(0, 1, since) : 0) * (1 - fold) : 1;
          var base = bez(C[0], C[1], C[2], C[3], f), sway = still ? 0 : O.swing(ctx.seed, 'lf' + i, tsec, P, 7 * D2R * flt, ctx.reduced ? 0 : 1);
          var isCur = play ? i === cur : s.state === P.stateG, gs = isCur ? size : 28;
          var ang = (side < 0 ? 196 : -16) * D2R + side * 10 * D2R + sway, len = S * 0.14 * (0.4 + 0.6 * open);
          var c = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len - S * 0.02];
          out.push({ id: 'st' + i, i: i, s: s, x: c[0], y: c[1], base: base, w: Math.max(S * (isCur ? 0.16 : 0.105), gs * 1.75) * Math.max(open, 0.05), gs: gs, cur: isCur, open: open, side: side,
            since: play ? since : 99, past: play && i < cur });
        });
        return { C: C, els: out };
      }
      // габарит полностью выросшего растения в покое → масштаб и сдвиг: стебель, корни, станции и подписи в кадре
      var full = geom(true), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, lab = 170 * ui;
      full.els.forEach(function (e) { var r = e.w / 2; x0 = Math.min(x0, e.x - r - (e.side < 0 ? lab : 0)); x1 = Math.max(x1, e.x + r + (e.side > 0 ? lab : 0)); y0 = Math.min(y0, e.y - r); y1 = Math.max(y1, e.y + r); });
      for (var qq = 0; qq <= 20; qq++) { var sp0 = bez(full.C[0], full.C[1], full.C[2], full.C[3], qq / 20); x0 = Math.min(x0, sp0[0]); x1 = Math.max(x1, sp0[0]); y0 = Math.min(y0, sp0[1]); y1 = Math.max(y1, sp0[1]); }
      x0 = Math.min(x0, full.C[0][0] - S * 0.11); x1 = Math.max(x1, full.C[0][0] + S * 0.11); y1 = Math.max(y1, full.C[0][1] + S * 0.01);
      var bw = W - 2 * m, bh = H - top - m * 1.4, kf = Math.min(1.25, bw / (x1 - x0), bh / (y1 - y0)) * 0.95;
      var ox = m + (bw - (x1 - x0) * kf) / 2 - x0 * kf, oy = top + (bh - (y1 - y0) * kf) / 2 - y0 * kf;
      var TF = function (p) { return [p[0] * kf + ox, p[1] * kf + oy]; };
      var live = geom(false), p0 = TF(live.C[0]), p1 = TF(live.C[1]), p2 = TF(live.C[2]), p3 = TF(live.C[3]);
      var els = live.els.map(function (e) { var c = TF([e.x, e.y]); e.x = c[0]; e.y = c[1]; e.base = TF(e.base); e.w = Math.max(e.w * kf, e.gs * 1.75 * Math.max(e.open, 0.05)); return e; });
      S = S * kf;
      // верхушка стебля идёт за самой высокой распустившейся станцией (рост = время эпизода)
      var stemEnd = play ? 0.06 : 1;
      if (play) els.forEach(function (e) { stemEnd = Math.max(stemEnd, Math.min(1, (0.12 + 0.86 * e.i / (n - 1)) * Math.min(1, e.open * 1.4) + 0.05 * e.open)); });
      var stemPts = []; for (var q = 0; q <= 24; q++) stemPts.push(bez(p0, p1, p2, p3, q / 24 * stemEnd));
      var V = O.frame(ctx, 'glyph3/' + (+P.sheet) + '/' + P.stateG + '/' + size, els.map(function (e, k) {
        return { id: e.id, x: e.x, y: e.y, r: e.w / 2, nb: [els[k - 1], els[k + 1]].filter(Boolean).map(function (q) { return q.id; }) };
      }));
      var T = R.tokens(ctx.theme, P.accent), TN = R.material.tints(T, +P.temp || 0);
      var plates = [], dots = [];
      els.forEach(function (e) {
        if (e.open < 0.02) { V.pos(e.id, 0); return; }        // узел есть всегда, станция ещё почка
        var lv = e.cur ? 2 : (e.s.state === 'error' && e.past ? 0 : 1), zp = G.zpx(lv * e.open + V.lift(e.id) * 0.9, P, ui), sp = V.pos(e.id, zp);
        e.sx = sp[0]; e.sy = sp[1];
        plates.push({ id: e.id, kind: 'circle', x: sp[0], y: sp[1], w: e.w * V.k, z: zp, env: e.past ? 0 : 1, el: e,
          fill: V.fade(e.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.id)) : null });
        var o = { state: e.s.state, size: e.gs, base: zp };
        if (GL.raised(o) && e.open > 0.9) dots.push(GL.disc({ P: P, ui: ui, ink: T.ink }, sp[0], sp[1], o));
      });
      R.frame(ctx, {
        plates: plates.concat(dots),
        floor: function (g, F) {
          var I = R.ink;
          I.text(g, F, 'AGENT STATE · A4 SERVICING · D-7781 → D-7782', m, m * 0.95, { s: G.ts(F, 0), mono: true, caps: true, tone: 'ink3' });
          I.text(g, F, 'One payment, one agent, five states.', m, m * 0.95 + G.lh(F, G.ts(F, 3)), { s: G.ts(F, 3), w: 500 });
          if (play) I.text(g, F, Math.min(tt, total).toFixed(1) + ' s / ' + total.toFixed(1) + ' s', m, m * 0.95 + G.lh(F, G.ts(F, 3)) + G.lh(F, G.ts(F, 0)) * 1.4, { s: G.ts(F, 0), mono: true, tone: 'ink2' });
          I.fictional(g, F);
          // корни и стебель: мягкие кривые одной толщины; черешки от стебля к станциям
          [-1, 0.4, 1].forEach(function (d, i) { O.stem(g, F, [V.pt(p0, 0), V.pt([p0[0] + d * S * 0.05, p0[1] + S * 0.004], 0), V.pt([p0[0] + d * S * (0.09 + i * 0.01), p0[1] - S * 0.01 * (i - 1)], 0)], { tone: 'ink2', alpha: 0.45 }); });
          O.stem(g, F, stemPts.map(function (p) { return V.pt(p, 0); }), { tone: 'ink', alpha: 0.85, t: 0.7 });
          plates.forEach(function (s) {
            var e = s.el, a = V.pt(e.base, 0), mid = [a[0] + (s.x - a[0]) * 0.5, Math.min(a[1], s.y) - 14 * ui];
            O.stem(g, F, [a, mid, [s.x - (s.x - a[0]) * (s.w / 2) / Math.max(1, Math.hypot(s.x - a[0], s.y - a[1])), s.y - (s.y - a[1]) * (s.w / 2) / Math.max(1, Math.hypot(s.x - a[0], s.y - a[1]))]],
              { tone: 'ink2', alpha: 0.75 * e.open, t: 0.7 });
            var right = e.side > 0 && s.x + s.w / 2 + 170 * ui < F.W, x = s.x + (right ? 1 : -1) * (s.w / 2 + 10 * ui);
            if (e.open > 0.5) O.label(g, F, x, s.y - 2 * ui, e.s.title + (e.s.verb ? ' · ' + e.s.verb : ''), e.s.sub,
              { align: right ? 'left' : 'right', s: G.ts(F, e.cur ? 2 : 1), ss: G.ts(F, 0), lh: G.lh(F, G.ts(F, e.cur ? 2 : 1)), alpha: V.dim(s.id) * (e.cur || !play ? 1 : 0.7) });
          });
        },
        print: function (g, s, F) {
          if (s.src.glyphDot) return;
          var e = s.src.el; if (e.open < 0.6) return;
          GL.draw(g, F, s.x, s.y, { state: e.s.state, size: e.gs, t: F.tsec, since: e.since, verb: e.s.verb, reduced: ctx.reduced || e.past, alpha: V.dim(s.src.id) * (e.past ? 0.8 : 1) });
        },
        above: function (g, F) {
          F.plates.forEach(function (s) {
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, s.w / 2 + 9 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
