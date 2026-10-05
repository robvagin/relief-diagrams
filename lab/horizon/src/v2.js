/* horizon · v2 «Octopus»: фокус — тело в центре, каждая ветвь онтологии — щупальце, мягкая
   кривая с натяжением (Catmull-Rom) через бусины-узлы. Под водой: по щупальцу бежит волна,
   кончики ходят сильнее основания; гармоники кратны периоду, цикл замкнут. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, O = R.org, TAU = Math.PI * 2;
  var G = { cx: 0, cy: 0, r: 1 };
  function anc1(t) { while (t.parent && t.parent.parent) t = t.parent; return t; }
  HORIZON.make({
    name: 'Octopus',
    legend: 'Each tentacle is one line of grounds · beads further out are further from the focus',
    frame: function (S, ctx, ui) {
      G.cx = ctx.W / 2; G.cy = ctx.H / 2 + 8 * ui;
      G.r = Math.max(60, Math.min(ctx.W * 0.5, ctx.H * 0.56) - Math.min(ctx.W, ctx.H) * 0.06);
    },
    map: function (S, ctx, w) { return [G.cx + w[0] * G.r, G.cy + w[1] * G.r]; },
    unmap: function (S, ctx, p) { return H.clampDisk([(p[0] - G.cx) / G.r, (p[1] - G.cy) / G.r], 0.97); },
    origin: function () { return [G.cx, G.cy]; },
    // волна вдоль щупальца: фаза отстаёт с глубиной, амплитуда растёт к кончику
    wind: function (S, t, w, base, ws, k, ui) {
      if (!t.depth || !k) return [0, 0];
      var ph = O.hash01(anc1(t).id) * TAU, a = Math.atan2(base[1] - G.cy, base[0] - G.cx), d = Math.pow(t.depth, 1.35) * 6 * ui * k;
      var s = 0.72 * Math.sin(ws - t.depth * 1.1 + ph) + 0.28 * Math.sin(2 * ws - t.depth * 1.9 + ph * 1.3);
      var rad = 0.35 * d * Math.sin(ws - t.depth * 0.8 + ph * 0.7);
      s += (ph > Math.PI ? 1 : -1) * 0.9;   // щупальце завито в свою сторону, волна идёт поверх завитка
      return [-Math.sin(a) * d * s + Math.cos(a) * rad, Math.cos(a) * d * s + Math.sin(a) * rad];
    },
    // щупальце: сегмент a→b с касательными через деда и первого внука (непрерывно по цепочке)
    links: function (g, F, a, b, alpha, nodes, by) {
      var pa = a.t.parent ? by.get(a.t.parent) : null, kid = b.t.kids && b.t.kids.length ? by.get(b.t.kids[0]) : null;
      var p0 = pa ? [pa.x, pa.y] : [a.x - (b.x - a.x) * 0.3, a.y - (b.y - a.y) * 0.3];
      var p3 = kid ? [kid.x, kid.y] : [b.x + (b.x - a.x) * 0.5, b.y + (b.y - a.y) * 0.5];
      var t = 0.5;
      g.save(); g.lineWidth = F.lineW; g.lineCap = 'round';
      g.strokeStyle = R.color.css(F.T.ink, alpha);
      g.beginPath(); g.moveTo(a.x, a.y);
      g.bezierCurveTo(a.x + (b.x - p0[0]) * t / 3, a.y + (b.y - p0[1]) * t / 3, b.x - (p3[0] - a.x) * t / 3, b.y - (p3[1] - a.y) * t / 3, b.x, b.y);
      g.stroke(); g.restore();
    },
    horizon: function (g, F, ctx, S) {
      // вода: два мягких круга глубины вокруг тела, без контура диска; едут с камерой
      var c = O.toScreen(S.sim, ctx, G.cx, G.cy, 0), z = S.sim.zoom();
      [0.5, 0.86].forEach(function (k, i) {
        g.beginPath(); g.arc(c[0], c[1], G.r * k * z, 0, TAU); g.lineWidth = F.lineW;
        g.strokeStyle = R.color.css(F.T.ink, i ? 0.07 : 0.05); g.stroke();
      });
    }
  });
})();
