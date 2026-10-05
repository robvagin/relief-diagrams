/* agents · v3 «Stage»: одна большая плашка-сцена z2 перебирает пять взглядов морфом
   (точки держат идентичность, переход 900 мс, ступенька 15 мс), справа пять прочтений
   выбранного займа строками-плашками z2; текущий агент поднят на z3. Линии от строк
   сходятся в узел записи между сценой и колонкой (донор 04, горизонтальная ось),
   из узла одна линия идёт к займу на сцене. «Ряд» = выбор агента кликом по строке. */
(function () {
  'use strict';
  var R = window.RELIEF, TAU = Math.PI * 2;
  var rowsAt = [];
  AGENTS.make({
    variant: '03', name: 'Stage', single: true,
    defaults: { view: 'morph' },
    layout: function (ctx, U, P) {
      var m = U.margin * 0.6, W = ctx.W, H = ctx.H;
      var model = [m, m, W - 2 * m, H - 2 * m];
      var pad = 14 * U.ui, head = U.fs(1) * 1.6 + U.fs(3) * 1.4 + 18 * U.ui;
      var top = model[1] + pad + head, avail = model[3] - head - pad * 2;
      var stageW = model[2] * 0.6, stage = [model[0] + pad, top, stageW, avail];
      var colW = Math.min(280 * U.ui, model[2] * 0.27), colX = model[0] + model[2] - pad - colW;
      var gap = Math.max(4 * U.ui, (+P.spacing) * U.ui * 0.5), rh = Math.min(62 * U.ui, (avail - 4 * gap) / 5);
      var y0 = top + avail / 2 - (rh * 5 + gap * 4) / 2;
      var rows = [0, 1, 2, 3, 4].map(function (i) { return [colX, y0 + i * (rh + gap), colW, rh]; });
      var hx = stage[0] + stage[2] + (colX - stage[0] - stage[2]) * 0.5;
      return { model: model, agents: [], stage: stage, rows: rows, hub2: [hx, top + avail / 2, 16 * U.ui], noPolyline: true };
    },
    extra: function (ctx, U, L, S, plates, cards, ms) {
      var l = S.byId.get(S.sel); if (!l) return;
      var e = R.EASE(R.clamp(ms.tau / 0.5, 0, 1));
      rowsAt = L.rows;
      L.rows.forEach(function (rc, i) {
        var a = ctx.data.agents[i], lv = i === ms.cur ? R.mix(1, 2, e) : i === ms.prev ? R.mix(2, 1, e) : 1;
        plates.push({ id: 'read/' + a.id, kind: 'rect', x: rc[0], y: rc[1], w: rc[2], h: rc[3], z: U.z(2) + (U.z(3) - U.z(2)) * (lv - 1),
          print: function (g, T, U2, p) {
            var x = p.cx - p.dx - p.w / 2 + 12 * U2.ui, y = p.cy - p.dy;
            g.textBaseline = 'middle'; g.textAlign = 'left';
            R.font(g, U2, 2, 500); g.fillStyle = R.rgba(T.ink); g.fillText(a.id + ' · ' + a.name, x, y - U2.fs(1) * 0.62);
            R.font(g, U2, 1, 400, true); g.fillStyle = R.rgba(T.ink3); g.fillText(AGENTS.tipOf(a.id, l), x, y + U2.fs(1) * 0.75);
            if (i === ms.cur) { g.beginPath(); g.arc(p.cx - p.dx + p.w / 2 - 12 * U2.ui, y, 2.5 * U2.ui, 0, TAU); g.fillStyle = R.rgba(T.ink2); g.fill(); }
          } });
      });
      plates.push({ id: 'hub', kind: 'disc', x: L.hub2[0], y: L.hub2[1], r: L.hub2[2], z: U.z(2), env: 0,
        print: function (g, T, U2, p) { g.beginPath(); g.arc(p.cx - p.dx, p.cy - p.dy, 2.6 * U2.ui, 0, TAU); g.fillStyle = R.rgba(T.accent); g.fill(); } });
    },
    // сходимость: строки прочтений → узел (приход справа), узел → займ на сцене
    modelPrint: function (g, T, U, ctx, L, cards, pts) {
      if (!+ctx.P.trace) return;
      var hx = L.hub2[0], hy = L.hub2[1], rc = L.hub2[2] * 0.45, N = L.rows.length;
      g.lineWidth = U.lineW; g.strokeStyle = R.rgba(T.ink, 0.5);
      L.rows.forEach(function (r, i) {
        var t = i / (N - 1), a = (-0.38 + 0.76 * t) * Math.PI;
        var p0 = [r[0] - 3 * U.ui, r[1] + r[3] / 2], p3 = [hx + rc * Math.cos(a), hy + rc * Math.sin(a)], sw = (p0[0] - p3[0]) * 0.55;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.bezierCurveTo(p0[0] - sw, p0[1], p3[0] + sw, p3[1], p3[0], p3[1]); g.stroke();
      });
      var c = cards[0];
      if (c && c.selLocal) {
        var q0 = [hx - L.hub2[2], hy], q3 = [c.rect[0] + c.rect[2] + 3 * U.ui, c.selLocal[1]], s2 = (q0[0] - q3[0]) * 0.5;
        g.beginPath(); g.moveTo(q0[0], q0[1]); g.bezierCurveTo(q0[0] - s2, q0[1], q3[0] + s2, q3[1], q3[0], q3[1]);
        g.strokeStyle = R.rgba(T.ink, 0.42); g.setLineDash([2 * U.ui, 3 * U.ui]); g.stroke(); g.setLineDash([]);
      }
    },
    click: function (ctx, S, x, y, ts) {
      for (var i = 0; i < rowsAt.length; i++) {
        var r = rowsAt[i];
        if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) {
          var cur = S.cards && S.cards[0] ? S.cards[0].idx : S.manual;
          S.manualFrom = cur; S.manual = i; S.manualAt = ts;
          if (ctx.P.view === 'morph') Scene.set('view', 'row');
          return true;
        }
      }
      return false;
    }
  });
  R.boot();
})();
