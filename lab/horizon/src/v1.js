/* horizon · v1 «Disk»: канонический диск Пуанкаре в центре кадра, горизонт окружностью,
   подписи радиально наружу. Композиция Лэмпинга как есть. */
(function () {
  'use strict';
  var R = window.RELIEF, TAU = Math.PI * 2;
  var G = { cx: 0, cy: 0, r: 1 };
  HORIZON.make({
    variant: '01', name: 'Disk',
    frame: function (S, ctx, U) {
      G.cx = ctx.W / 2; G.cy = ctx.H / 2 + U.fs(1);
      G.r = Math.max(40, Math.min(ctx.W, ctx.H) / 2 - U.margin * 1.1);
    },
    map: function (w) { return [G.cx + w[0] * G.r, G.cy + w[1] * G.r]; },
    unmap: function (p) { return HYPER.clampDisk([(p[0] - G.cx) / G.r, (p[1] - G.cy) / G.r], 0.97); },
    size: function (w) { return 1 - (w[0] * w[0] + w[1] * w[1]); },
    origin: function () { return [G.cx, G.cy]; },
    horizon: function (g, T, U) {
      g.beginPath(); g.arc(G.cx, G.cy, G.r, 0, TAU);
      g.strokeStyle = R.rgba(T.ink, 0.12); g.lineWidth = U.lineW; g.stroke();
    }
  });
  R.boot();
})();
