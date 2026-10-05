/* agents · v2 «Flower»: запись займа — сердцевина, пять агентов — лепестки-листы веером вокруг,
   прямые лучи из сердцевины с засечками (Satellites). Лепестки дышат: раскрываются и
   закрываются за период, линии от займа на каждом лепестке сходятся в сердцевину. */
(function () {
  'use strict';
  var R = window.RELIEF, O = R.org, TAU = Math.PI * 2;
  var ZL = [2, 1, 3, 2, 1];
  AGENTS.make({
    name: 'Flower',
    layout: function (ctx, ui, P, ws, wind, morph) {
      var W = ctx.W, H = ctx.H, m = Math.min(W, H) * 0.06, cx = W / 2, cy = H / 2 + 18 * ui;
      var rec = { x: cx, y: cy, r: 52 * ui, z: R.zh(3, P, ui) }, sheets = [], springs = [];
      if (morph) {
        rec.x = m + 120 * ui;
        var w0 = Math.min(W - rec.x - 140 * ui - m, 680 * ui), h0 = Math.min(H - 2 * m - 120 * ui, w0 * 0.66);
        sheets.push({ id: 'stage', a: 'A1', x: W - m - w0 / 2, y: cy, w: w0, h: h0, z: R.zh(2, P, ui), rot: 0.03 });
      } else {
        var D = Math.min(W * 0.33, H * 0.36) + (+P.spacing || 0) * ui * 0.5, w = Math.min(250 * ui, D * 0.95), h = w * 0.72;
        for (var i = 0; i < 5; i++) {
          var a = -Math.PI / 2 + i * TAU / 5, ph = O.hash01('petal' + i) * TAU;
          var bloom = 1 + 0.025 * wind * Math.sin(ws + ph), sway = 0.02 * wind * (0.7 * Math.sin(ws + ph * 1.3) + 0.3 * Math.sin(2 * ws + ph));
          var aa = a + sway, dd = D * bloom;
          sheets.push({ id: 'A' + (i + 1), a: 'A' + (i + 1), x: cx + dd * Math.cos(aa) * 1.12, y: cy + dd * Math.sin(aa) * 0.92,
            w: w, h: h, z: R.zh(ZL[i], P, ui), rot: Math.cos(a) * 5 * Math.PI / 180 + sway * 0.8 });
        }
      }
      sheets.forEach(function (s) { springs.push(['record', s.id, Math.hypot(s.x - rec.x, s.y - rec.y), 5]); });
      return { sheets: sheets, record: rec, springs: springs };
    },
    floor: function (g, F, ctx, L, S) {
      if (L.record.sx == null) return;
      var c = [L.record.sx, L.record.sy];
      L.sheets.forEach(function (s) { if (s.sx != null) O.ray(g, F, c, [s.sx, s.sy], { ra: L.record.sr, rb: 0, alpha: 0.4, ticks: true }); });
    }
  });
})();
