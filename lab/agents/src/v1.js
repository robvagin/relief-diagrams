/* agents · v1 «Row»: модель z1 во всё поле, пять агентов z2 в ряд равной ширины,
   под рядом узел займа: от каждого вида линия сходится в него сверху (вертикальная ось
   донора 04), ломаная следа видна в зазорах между агентами. Морф = ряд схлопывается
   в одну плашку, которая перебирает виды. */
(function () {
  'use strict';
  var R = window.RELIEF;
  AGENTS.make({
    variant: '01', name: 'Row',
    layout: function (ctx, U, P) {
      var m = U.margin * 0.6, W = ctx.W, H = ctx.H;
      var model = [m, m, W - 2 * m, H - 2 * m];
      var pad = 14 * U.ui, head = U.fs(1) * 1.6 + U.fs(3) * 1.4 + 18 * U.ui;
      var top = model[1] + pad + head, rowH = (model[3] - head) * 0.6;
      var gap = (+P.spacing) * U.ui, w = (model[2] - 2 * pad - 4 * gap) / 5;
      var agents = [0, 1, 2, 3, 4].map(function (i) { return [model[0] + pad + i * (w + gap), top, w, rowH]; });
      var stage = [model[0] + pad, top, model[2] - 2 * pad, rowH];
      var hr = 16 * U.ui, hy = top + rowH + (model[1] + model[3] - top - rowH) * 0.42;
      return { model: model, agents: agents, stage: stage, hub: [W / 2, hy, hr], axis: 'vertical' };
    }
  });
  R.boot();
})();
