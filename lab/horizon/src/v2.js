/* horizon · v2 «Lens»: диск сдвинут влево, справа колонка оснований — первое кольцо
   фокуса плашками z1 со связью и числом; от каждой плашки линия сходится в фокус
   по правилам донора 04-converge (горизонтальный старт и приход, монотонный порядок
   входа, собирающая дуга внутри узла). Фокус и основания читаются вместе. */
(function () {
  'use strict';
  var R = window.RELIEF, H = window.HYPER, TAU = Math.PI * 2;
  var G = { cx: 0, cy: 0, r: 1, col: null, rows: [], top: 0, rowH: 0 };
  HORIZON.make({
    variant: '02', name: 'Lens',
    focusLabelAngle: -Math.PI / 2 - 0.9,
    frame: function (S, ctx, U) {
      var colW = Math.max(150 * U.ui, Math.min(260 * U.ui, ctx.W * 0.26));
      var left = U.margin, right = ctx.W - U.margin - colW - 4 * U.u;
      G.r = Math.max(40, Math.min((right - left) / 2, ctx.H / 2 - U.margin * 1.1));
      G.cx = left + (right - left) / 2; G.cy = ctx.H / 2 + U.fs(1);
      G.col = [ctx.W - U.margin - colW, colW];
    },
    map: function (w) { return [G.cx + w[0] * G.r, G.cy + w[1] * G.r]; },
    unmap: function (p) { return H.clampDisk([(p[0] - G.cx) / G.r, (p[1] - G.cy) / G.r], 0.97); },
    size: function (w) { return 1 - (w[0] * w[0] + w[1] * w[1]); },
    origin: function () { return [G.cx, G.cy]; },
    reserve: function (boxes, ctx, U) { boxes.push([G.col[0] - 3 * U.u, 0, ctx.W, ctx.H, null]); },
    horizon: function (g, T, U) {
      g.beginPath(); g.arc(G.cx, G.cy, G.r, 0, TAU);
      g.strokeStyle = R.rgba(T.ink, 0.12); g.lineWidth = U.lineW; g.stroke();
    },
    // колонка: плашки z1 первого кольца по порядку их высоты в диске (линии не пересекаются)
    plates: function (S, ctx, U, plates) {
      var rows = S.nodes.filter(function (n) { return n.ring === 1 && !n.t.more && n.vis; })
        .sort(function (a, b) { return a.y - b.y; }).slice(0, 8);
      var N = rows.length;
      G.rows = rows; G.rowH = Math.min(48 * U.ui, (ctx.H - U.margin * 5) / Math.max(N, 1)); G.top = ctx.H / 2 - G.rowH * N / 2 + U.fs(1);
      rows.forEach(function (n, i) {
        plates.push({
          id: 'row/' + n.t.id, kind: 'rect', x: G.col[0], y: G.top + G.rowH * i + 3 * U.ui, w: G.col[1], h: G.rowH - 6 * U.ui,
          z: U.z(1), print: function (g, T, U2, p) {
            var x = p.cx - p.dx - p.w / 2 + 10 * U2.ui, y = p.cy - p.dy;
            g.textBaseline = 'middle'; g.textAlign = 'left';
            R.font(g, U2, 2, 500); g.fillStyle = R.rgba(T.ink); g.fillText(HORIZON.name1(n.t), x, y - U2.fs(1) * 0.55);
            R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3);
            g.fillText(HORIZON.REL[n.t.rel] || '', x, y + U2.fs(1) * 0.75);
            var v = n.t.n.value ? HORIZON.money(n.t.n.value) : (n.t.n.status || n.t.n.type);
            g.textAlign = 'right'; R.font(g, U2, 1, 500, true); g.fillStyle = R.rgba(T.ink2);
            g.fillText(String(v), p.cx - p.dx + p.w / 2 - 10 * U2.ui, y);
            if (n.t.n.status === 'blocked') {   // одна тёплая точка у заблокированного решения
              g.beginPath(); g.arc(p.cx - p.dx + p.w / 2 - 10 * U2.ui - g.measureText(String(v)).width - 8 * U2.ui, y, 2.5 * U2.ui, 0, TAU);
              g.fillStyle = R.rgba(T.accent); g.fill();
            }
          }
        });
      });
    },
    // сходимость оснований в фокус (печать на полу, под плашками)
    floorExtra: function (g, T, U, ctx, S, nodes) {
      var f = nodes.filter(function (n) { return n.ring === 0; })[0], N = G.rows.length;
      if (!f || !N) return;
      var rCol = f.rho * 0.45;
      g.lineWidth = U.lineW;
      G.rows.forEach(function (n, i) {
        var t = N === 1 ? 0.5 : i / (N - 1);
        var a = -Math.PI / 2 * 0.8 + t * Math.PI * 0.8;          // правило 2: монотонный вход
        var p0x = G.col[0] - 3 * U.ui, p0y = G.top + G.rowH * i + G.rowH / 2;
        var p3x = f.x + rCol * Math.cos(a), p3y = f.y + rCol * Math.sin(a);
        var sh = (p0x - p3x) * 0.55;                             // правило 3: плечи горизонтальны
        g.beginPath(); g.moveTo(p0x, p0y);
        g.bezierCurveTo(p0x - sh, p0y, p3x + sh, p3y, p3x, p3y);
        g.strokeStyle = R.rgba(T.ink, 0.28); g.stroke();
      });
    },
    overlayExtra: function (g, T, U) {
      if (!G.rows.length) return;
      R.caps(g, U, 1); g.fillStyle = R.rgba(T.ink3); g.textBaseline = 'bottom'; g.textAlign = 'left';
      g.fillText('GROUNDS OF THE FOCUS', G.col[0], G.top - 4 * U.ui);
      g.textBaseline = 'top';
    }
  });
  R.boot();
})();
