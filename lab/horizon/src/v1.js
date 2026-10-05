/* horizon · v1 «Flower»: диск Пуанкаре раскрыт цветком. Сердцевина — фокус, первое кольцо —
   лепестки (листы бумаги и диски вперемешку), дальше веер мелких дисков на прямых лучах из своих
   хабов с засечками (Satellites network). Лепестки колышутся по кругу, кончики сильнее основания. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, O = R.org, TAU = Math.PI * 2;
  var G = { cx: 0, cy: 0, r: 1 };
  HORIZON.make({
    name: 'Flower',
    legend: 'Distance from the heart = steps from the focus · ticks every tenth of a ray',
    frame: function (S, ctx, ui) {
      G.cx = ctx.W / 2; G.cy = ctx.H / 2 + 10 * ui;
      G.r = Math.max(60, Math.min(ctx.W, ctx.H) / 2 - Math.min(ctx.W, ctx.H) * 0.08);
    },
    map: function (S, ctx, w) { return [G.cx + w[0] * G.r, G.cy + w[1] * G.r]; },
    unmap: function (S, ctx, p) { return H.clampDisk([(p[0] - G.cx) / G.r, (p[1] - G.cy) / G.r], 0.97); },
    origin: function () { return [G.cx, G.cy]; },
    // ветер: качание по касательной вокруг сердцевины, амплитуда растёт с кольцом (гармоники одного периода)
    wind: function (S, t, w, base, ws, k, ui) {
      if (!t.depth || !k) return [0, 0];
      var ph = O.hash01(t.id) * TAU, a = Math.atan2(base[1] - G.cy, base[0] - G.cx), d = Math.pow(t.depth, 1.2) * 4.5 * ui * k;
      var s = 0.7 * Math.sin(ws + ph) + 0.3 * Math.sin(2 * ws + ph * 1.7);
      return [-Math.sin(a) * d * s, Math.cos(a) * d * s];
    },
    links: function (g, F, a, b, alpha) {
      O.ray(g, F, [a.x, a.y], [b.x, b.y], { ra: a.hw || 2, rb: b.hw || 2, alpha: alpha, ticks: b.ring <= 2 });
    },
    horizon: function (g, F) {
      g.beginPath(); g.arc(G.cx, G.cy, G.r, 0, TAU); g.lineWidth = F.lineW; g.strokeStyle = R.color.css(F.T.ink, 0.1); g.stroke();
    }
  });
})();
