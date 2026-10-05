/* agents · v2 «Column»: пять агентов z2 колонкой слева, широкие и низкие; справа узел
   записи займа, в который линии от каждого вида приходят горизонтально — геометрия
   донора 04-converge как есть: горизонтальный старт и приход, монотонные углы входа,
   собирающая дуга внутри узла. Под узлом плашка записи z2: пять прочтений одного займа. */
(function () {
  'use strict';
  var R = window.RELIEF;
  AGENTS.make({
    variant: '02', name: 'Column',
    layout: function (ctx, U, P) {
      var m = U.margin * 0.6, W = ctx.W, H = ctx.H;
      var model = [m, m, W - 2 * m, H - 2 * m];
      var pad = 14 * U.ui, head = U.fs(1) * 1.6 + U.fs(3) * 1.4 + 18 * U.ui;
      var top = model[1] + pad + head, colW = model[2] * 0.6, avail = model[3] - head - pad * 2;
      var gap = (+P.spacing) * U.ui * 0.6, h = (avail - 4 * gap) / 5;
      var agents = [0, 1, 2, 3, 4].map(function (i) { return [model[0] + pad, top + i * (h + gap), colW, h]; });
      var stage = [model[0] + pad, top, colW, avail];
      var hx = model[0] + pad + colW + (model[2] - colW - pad) * 0.42, hy = top + avail * 0.5;
      var cw = Math.min(model[0] + model[2] - pad - (model[0] + pad + colW + 4 * U.u), 300 * U.ui);
      var card = [model[0] + model[2] - pad - cw, hy + 34 * U.ui, cw, U.fs(1) * 1.45 * 6 + 24 * U.ui];
      return { model: model, agents: agents, stage: stage, hub: [hx, hy, 18 * U.ui], axis: 'horizontal', hubLabel: 'none', card: card };
    },
    // плашка записи: пять прочтений одного займа, строка на агента
    extra: function (ctx, U, L, S, plates) {
      var l = S.byId.get(S.sel); if (!l) return;
      var c = L.card;
      plates.push({ id: 'record', kind: 'rect', x: c[0], y: c[1], w: c[2], h: c[3], z: U.z(2), env: 0.6,
        print: function (g, T, U2, p) {
          var x = p.cx - p.dx - p.w / 2 + 12 * U2.ui, y = p.cy - p.dy - p.h / 2 + 12 * U2.ui, lh = U2.fs(1) * 1.45;
          g.textBaseline = 'top'; g.textAlign = 'left';
          R.font(g, U2, 2, 500); g.fillStyle = R.rgba(T.ink); g.fillText(l.id + ' · one record', x, y);
          y += U2.fs(2) * 1.4;
          ctx.data.agents.forEach(function (a) {
            R.font(g, U2, 1, 500, true); g.fillStyle = R.rgba(T.ink2); g.fillText(a.id, x, y);
            R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.fillText(AGENTS.tipOf(a.id, l), x + 28 * U2.ui, y);
            y += lh;
          });
        } });
    }
  });
  R.boot();
})();
