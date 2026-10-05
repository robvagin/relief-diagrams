/* agents · v1 «Mobile»: подвесная люстра Калдера. Сверху точка подвеса — модель, на нитях висят
   пять листов агентов на разной высоте: заходят друг на друга и роняют тени друг на друга и на пол.
   Листы качаются маятником вокруг подвеса (гармоники одного периода), внизу запись займа, в которую
   сходятся линии от него во всех пяти видах. Морф: один большой лист на нити перебирает виды. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org, TAU = Math.PI * 2;
  var DROP = [46, 0, 84, 14, 58], ZL = [2, 3, 1, 3, 2], TILT = [-5, 3, -2, 5, -4];
  AGENTS.make({
    name: 'Mobile', swingRot: true,
    layout: function (ctx, ui, P, ws, wind, morph) {
      var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, hub = { x: W / 2, y: m + 74 * ui, r: 11 * ui, z: R.zh(3, P, ui) };
      var rec = { x: W / 2, y: H - m - 96 * ui, r: 40 * ui, z: R.zh(2, P, ui) };
      var sheets = [], springs = [];
      var gap = (+P.spacing || 0) * ui;
      if (morph) {
        var w0 = Math.min(W * 0.62, 640 * ui), h0 = Math.min(w0 * 0.62, rec.y - hub.y - 150 * ui);
        sheets.push({ id: 'stage', a: 'A1', x: W / 2, y: hub.y + 60 * ui + h0 / 2, w: w0, h: h0, z: R.zh(2, P, ui), rot: -0.03 });
      } else {
        var w = Math.min(280 * ui, (W - 2 * m) / 3.9 + gap * 0.2), h = Math.min(w * 0.9, (rec.y - hub.y - 230 * ui));
        for (var i = 0; i < 5; i++) {
          var L = 120 * ui + DROP[i] * ui, ph = O.hash01('mobile' + i) * TAU;
          var th = wind * 1.3 * Math.PI / 180 * (0.7 * Math.sin(ws + ph) + 0.3 * Math.sin(2 * ws + ph * 1.6));
          var bx = W / 2 + (i - 2) * (w * 0.84 + gap), by = hub.y + L + h / 2;
          sheets.push({ id: 'A' + (i + 1), a: 'A' + (i + 1), x: bx + (by - hub.y) * Math.sin(th), y: by - (by - hub.y) * (1 - Math.cos(th)),
            w: w, h: h, z: R.zh(ZL[i], P, ui), rot: TILT[i] * Math.PI / 180 + th * 0.6 });
        }
      }
      sheets.forEach(function (s) { springs.push(['hub', s.id, Math.hypot(s.x - hub.x, s.y - hub.y), 4]); });
      return { sheets: sheets, hub: hub, record: rec, springs: springs };
    },
    // нити подвеса: от точки подвеса к верхней кромке каждого листа, провисают под весом
    floor: function (g, F, ctx, L, S) {
      if (L.hub.sx == null) return;
      L.sheets.forEach(function (s) {
        if (s.sx == null) return;
        var c = Math.cos(s.srot), sn = Math.sin(s.srot), tx = s.sx + (0) * c - (-s.sh / 2) * sn, ty = s.sy + 0 * sn + (-s.sh / 2) * c;
        O.thread(g, F, [L.hub.sx, L.hub.sy], [tx, ty], 10 * F.ui, { alpha: 0.42 });
        g.beginPath(); g.arc(tx, ty, 1.8 * F.ui, 0, TAU); g.fillStyle = R.color.css(F.T.ink, 0.45); g.fill();
      });
      R.ink.text(g, F, 'model of record', L.hub.sx + L.hub.sr + 8 * F.ui, L.hub.sy, { s: 0, mono: true, tone: 'ink3', base: 'middle' });
    }
  });
})();
