/* gate · v1 «Мобиль»: проверка как подвесной мобиль Калдера. Из точки подвеса уходит цепочка коромысел-дуг;
   на одном конце каждого коромысла висит шаг проверки (лист или диск), на другом — следующее коромысло.
   Плечи уравновешены по площади (тяжёлое ближе к оси), каждое коромысло качается вокруг своей оси
   гармониками одного периода. Пройденная проверка поднимается и оседает, блок ложится на пол плоско,
   его нить провисает. */
(function () {
  'use strict';
  var R = window.RELIEF, G = R.gate, O = R.org, I = R.ink;
  var D2R = Math.PI / 180;

  R.def = {
    id: 'gate', title: 'Gate · Mobile',
    blurb: 'Check before action as a Calder mobile: each check hangs on its own arm; a passed check lifts and settles, a blocked one lies flat on the floor.',
    groups: G.rows,
    draw: function (ctx) {
      var P = ctx.P, data = ctx.data || R.data(), M = G.pick(data, P), tsec = R.motion.time(ctx);
      var tr = G.track(P, M, tsec, ctx.reduced, null);
      var size = function (st) { return function (S) {
        if (st.role === 'request') return { kind: 'rect', w: S * 0.27, h: S * 0.16 };
        if (st.role === 'decision') return { kind: 'circle', w: S * 0.17 };
        return st.kind === 'disc' ? { kind: 'circle', w: S * 0.115 } : { kind: 'rect', w: S * 0.21, h: S * 0.125 }; }; };
      var items = M.steps.map(function (st, k) { return { id: st.id, step: st, z: size(st), st: tr.steps[k], lab: st.kind === 'disc' && st.role !== 'decision', role: st.role }; });
      var Lo = O.fitMobile(ctx, O.mobile(ctx, items, tsec), O.mobile(Object.assign({}, ctx, { reduced: true }), items, 0)), ui = Lo.ui;
      var V = O.frame(ctx, 'gate1/' + M.dec.id + '/' + M.steps.length, Lo.els.map(function (e, i) {
        return { id: e.step.id, x: e.x, y: e.y, r: (e.z.kind === 'circle' ? e.z.w / 2 : Math.max(e.z.w, e.z.h) / 2),
          nb: [Lo.els[i - 1], Lo.els[i + 1]].filter(Boolean).map(function (q) { return q.step.id; }) };
      }));
      var TN = R.material.tints(R.tokens(ctx.theme, P.accent), +P.temp || 0);
      var plates = Lo.els.map(function (e) {
        var lift = V.lift(e.step.id), zp = G.zpx(e.st.lv + (e.st.flat ? 0 : lift * 0.9), P, ui);
        var sp = V.pos(e.step.id, zp);
        e.sx = sp[0]; e.sy = sp[1]; e.k = V.k;
        return { id: e.step.id, kind: e.z.kind, x: sp[0], y: sp[1], w: e.z.w * V.k, h: (e.z.h || e.z.w) * V.k, r: e.z.kind === 'rect' ? 3 * ui : null,
          rot: e.rot, z: zp, env: e.st.env, step: e.step.step, el: e, fill: V.fade(e.step.id) > 0.01 ? O.fadeFill({ tn: TN }, V.fade(e.step.id)) : null };
      });
      var scr = function (p) { return V.pt(p, 0); };
      R.frame(ctx, {
        plates: plates,
        floor: function (g, F) {
          G.header(g, F, M, tr);
          // нити и коромысла: одна толщина, мягкие кривые, узлы подвеса кольцами (ни одного прямого угла)
          Lo.wires.forEach(function (w) {
            var pts = w.pts.map(scr);
            if (w.el != null) { var e = Lo.els[w.el]; pts = O.threadTo(pts[0], e.sx, e.sy, e.half * V.k, e.st.flat, ui); }
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
            if (V.focus === s.id) { g.save(); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.8); g.setLineDash([3 * ui, 3 * ui]);
              g.beginPath(); g.arc(s.x, s.y, Math.max(s.w, s.h) / 2 + 9 * ui, 0, Math.PI * 2); g.stroke(); g.restore(); }
          });
        }
      });
    }
  };
})();
