/* horizon · v3 «Horizon line»: тот же диск, увиденный через преобразование Кэли
   в верхнюю полуплоскость. Край диска становится прямой линией горизонта внизу кадра:
   фокус стоит над ней, основания вокруг, всё остальное буквально уходит к горизонту.
   Корень раскладывает детей клином вниз: у точки «бесконечности» пусто, контекст не улетает. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, C = H.C, TAU = Math.PI * 2;
  var G = { cx: 0, yH: 0, s: 1, beta: -Math.PI / 2, W: 0, H: 0, m: 0 };
  function cayley(w) {
    var z = C.mul(w, C.polar(1, -G.beta));
    return C.div(C.mul([0, 1], C.add([1, 0], z)), C.sub([1, 0], z));   // i(1+z)/(1−z)
  }
  HORIZON.make({
    variant: '03', name: 'Horizon line',
    focusLabelAngle: -Math.PI / 2,
    // корень раскладывает детей клином ±112° вниз, к горизонту: сектор у бесконечности пуст
    wedge: [Math.PI / 2, Math.PI * 0.62],
    frame: function (S, ctx, U) {
      G.W = ctx.W; G.H = ctx.H; G.m = U.margin;
      G.cx = ctx.W / 2;
      G.yH = ctx.H - U.margin - U.fs(1) * 6.2;
      G.s = Math.max(40, Math.min(G.yH - (U.margin + U.fs(3) * 6), (ctx.W / 2 - U.margin) / 1.2));
    },
    map: function (w) {
      var c = cayley(w), x = G.cx + G.s * c[0], y = G.yH - G.s * c[1];
      var vis = x > -G.m && x < G.W + G.m && y > -G.m && isFinite(x) && isFinite(y);
      return [x, y, vis];
    },
    unmap: function (p) {
      var c = [(p[0] - G.cx) / G.s, Math.max(0.03, (G.yH - p[1]) / G.s)];
      var z = C.div(C.sub(c, [0, 1]), C.add(c, [0, 1]));
      return H.clampDisk(C.mul(z, C.polar(1, G.beta)), 0.97);
    },
    size: function (w) { return Math.min(Math.pow(Math.max(0, cayley(w)[1]), 0.4), 1 - (w[0] * w[0] + w[1] * w[1])); },
    origin: function () { return [G.cx, G.yH - G.s]; },
    horizon: function (g, T, U, ctx) {
      g.lineWidth = U.lineW;
      g.beginPath(); g.moveTo(U.margin, G.yH); g.lineTo(ctx.W - U.margin, G.yH);
      g.strokeStyle = R.rgba(T.ink, 0.12); g.stroke();
      // засечки прибора: шаг 2u, через пять длиннее
      for (var i = 0, x = G.cx; x < ctx.W - U.margin; i++, x += 2 * U.u) {
        [x, 2 * G.cx - x].forEach(function (xx, j) {
          if (j === 1 && i === 0) return;
          if (xx < U.margin) return;
          g.beginPath(); g.moveTo(xx, G.yH); g.lineTo(xx, G.yH + (i % 5 === 0 ? 5 : 2.5) * U.ui);
          g.strokeStyle = R.rgba(T.ink, i % 5 === 0 ? 0.22 : 0.12); g.stroke();
        });
      }
      R.font(g, U, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillText('horizon · the rest of the model', ctx.W - U.margin, G.yH - 4 * U.ui);
      g.textAlign = 'left'; g.textBaseline = 'top';
    }
  });
  R.boot();
})();
