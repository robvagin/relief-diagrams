/* horizon · v3 «Plant»: фокус — корень у земли, онтология растёт вверх стеблями. Стебли —
   мягкие дуги с натяжением, листья — листы бумаги, плоды — диски. Ветер качает каждую ветку
   вокруг её узла, верх сильнее низа. Ход Мёбиуса ведёт новый фокус к корню, родитель уходит вниз. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, O = R.org, C = H.C, TAU = Math.PI * 2;
  var G = { cx: 0, cy: 0, r: 1, rot: 0, ground: 0 };
  function spin(w, a) { var c = Math.cos(a), s = Math.sin(a); return [w[0] * c - w[1] * s, w[0] * s + w[1] * c]; }
  HORIZON.make({
    name: 'Plant',
    wedge: [-Math.PI / 2, Math.PI * 0.44],
    legend: 'Grows from the focus · leaves are documents, fruit are parties and decisions',
    frame: function (S, ctx, ui) {
      var m = Math.min(ctx.W, ctx.H) * 0.06;
      G.ground = ctx.H - m - 44 * ui; G.cx = ctx.W / 2; G.cy = G.ground - 40 * ui;
      G.r = Math.max(60, Math.min(G.cy - m - 70 * ui, ctx.W / 2 - m));
      // поворот: родитель текущего центра смотрит вниз, к земле (сглажено по кадрам)
      var c = S.nav.anim ? S.nav.anim.target : S.nav.center, ct = c && S.tree.all.filter(function (t) { return t.id === c; })[0];
      var target = 0;
      if (ct && ct.parent) { var wp = H.apply(S.nav.m, ct.parent.z); if (C.abs(wp) > 1e-4) target = Math.PI / 2 - Math.atan2(wp[1], wp[0]); }
      var d = Math.atan2(Math.sin(target - G.rot), Math.cos(target - G.rot));
      G.rot += d * (ctx.reduced ? 1 : 0.08);
    },
    map: function (S, ctx, w) { var q = spin(w, G.rot); return [G.cx + q[0] * G.r, G.cy + q[1] * G.r * 1.04]; },
    unmap: function (S, ctx, p) { return H.clampDisk(spin([(p[0] - G.cx) / G.r, (p[1] - G.cy) / (G.r * 1.04)], -G.rot), 0.97); },
    origin: function () { return [G.cx, G.cy]; },
    // ветер: ветка поворачивается вокруг своего узла, угол растёт с высотой
    wind: function (S, t, w, base, ws, k, ui) {
      if (!t.depth || !k) return [0, 0];
      var ph = O.hash01(t.id + 'w') * 0.9, gust = 0.75 + 0.25 * Math.sin(ws + 1.3);
      var th = (1.1 + 0.7 * t.depth) * Math.PI / 180 * k * gust * (0.7 * Math.sin(ws + ph) + 0.3 * Math.sin(2 * ws + ph * 2));
      var hgt = Math.max(0, G.cy - base[1]);
      return [hgt * th, 0];
    },
    // стебель: мягкая дуга, выгнутая вверх-наружу (без углов)
    links: function (g, F, a, b, alpha) {
      var dx = b.x - a.x, dy = b.y - a.y, side = dx >= 0 ? -1 : 1;
      O.arc(g, F, [a.x, a.y], [b.x, b.y], 0.16 * side * (dy < 0 ? 1 : -1), { alpha: alpha });
    },
    horizon: function (g, F, ctx, S) {
      var gy = O.toScreen(S.sim, ctx, G.cx, G.ground, 0)[1];
      var m = Math.min(F.W, F.H) * 0.06, gr = g.createLinearGradient(m, 0, F.W - m, 0);
      gr.addColorStop(0, R.color.css(F.T.ink, 0)); gr.addColorStop(0.5, R.color.css(F.T.ink, 0.16)); gr.addColorStop(1, R.color.css(F.T.ink, 0));
      g.save(); g.strokeStyle = gr; g.lineWidth = F.lineW;
      g.beginPath(); g.moveTo(m, gy); g.quadraticCurveTo(F.W / 2, gy + 6 * F.ui, F.W - m, gy); g.stroke(); g.restore();
    }
  });
})();
